import axios from 'axios';
import debounce from 'lodash/debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PaginatedSelectData, SelectPageInfo } from '@/components/ui/select';

import type { AutoCompleteAsyncData, AutoCompleteNewSuggestion, SuggestionItem } from '../types';
import { suggestionItemsEqual } from '../utils/suggestion-items-equal';

const { isCancel } = axios;

interface UseAutoCompleteSuggestionsParams<T> {
    data?: SuggestionItem<T>[] | AutoCompleteAsyncData<T>;
    valueProp: SuggestionItem<T>;
    selected: SuggestionItem<T>[];
    newSuggestion?: AutoCompleteNewSuggestion<T>;
    onSelect?: (item: SuggestionItem<T>) => void;
    closeOnSelect: boolean;
    staging: boolean;
    pendingSelected: SuggestionItem<T>[];
}

export const useAutoCompleteSuggestions = <T>({
    data,
    valueProp,
    selected,
    newSuggestion,
    onSelect,
    closeOnSelect,
    staging,
    pendingSelected,
}: UseAutoCompleteSuggestionsParams<T>) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [value, setValue] = useState('');
    const [searchQuery, setSearchQuery] = useState(valueProp ? valueProp.label || '' : '');
    const [isExactMatch, setIsExactMatch] = useState(true);
    const [list, setList] = useState<SuggestionItem<T>[]>([]);
    const [pageInfo, setPageInfo] = useState<SelectPageInfo | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const maxLength = newSuggestion?.maxLength || 0;

    const isAsync = typeof data === 'function';

    const applySelectedAndExactMatch = useCallback(
        (results: SuggestionItem<T>[], inputTrim: string, isPage0: boolean) => {
            let next = results.slice();

            if (selected.length > 0) {
                next = next.filter(
                    (res) => !selected.some((item) => JSON.stringify(item.value) === JSON.stringify(res.value)),
                );
            }
            if (newSuggestion?.enabled && isPage0) {
                const matchArray = next.filter((e) => {
                    if (e.searchLabel) return e.searchLabel === inputTrim;

                    return e.label === inputTrim;
                });

                setIsExactMatch(matchArray.length !== 0);
            }

            return next;
        },
        [newSuggestion?.enabled, selected],
    );

    const fetchList = useCallback(
        async (query: string, page: number = 0) => {
            if (!isAsync || typeof data !== 'function') return;

            if (page === 0) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            try {
                const result = await data(query, page);
                const inputTrim = value.trim();
                let rawList: SuggestionItem<T>[];
                let pi: SelectPageInfo | null = null;

                if (result && typeof result === 'object' && 'list' in result && 'pageInfo' in result) {
                    rawList = (result as PaginatedSelectData<T>).list as SuggestionItem<T>[];
                    pi = (result as PaginatedSelectData<T>).pageInfo;
                } else {
                    rawList = result as SuggestionItem<T>[];
                }

                const filtered = applySelectedAndExactMatch(rawList, inputTrim, page === 0);

                if (page === 0) {
                    setList(filtered);
                } else {
                    setList((prev) => [...prev, ...filtered]);
                }
                setPageInfo(pi);
            } catch (err) {
                if (!isCancel(err)) {
                    console.error(err);
                }
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [applySelectedAndExactMatch, data, isAsync, value],
    );

    const paginationRef = useRef({
        isAsync,
        loading,
        loadingMore,
        pageInfo,
        searchValue: searchQuery,
        fetchList,
    });

    useEffect(() => {
        paginationRef.current = {
            isAsync,
            loading,
            loadingMore,
            pageInfo,
            searchValue: searchQuery,
            fetchList,
        };
    });

    const tryLoadMore = useCallback(() => {
        const {
            isAsync: asyncMode,
            loading: ldg,
            loadingMore: ldgMore,
            pageInfo: pi,
            searchValue: sv,
            fetchList: fetch,
        } = paginationRef.current;

        if (asyncMode && !ldg && !ldgMore && pi && pi.page < pi.total_pages - 1) {
            void fetch(sv, pi.page + 1);
        }
    }, []);

    const sentinelCallbackRef = useCallback(
        (node: HTMLDivElement | null) => {
            observerRef.current?.disconnect();
            observerRef.current = null;

            if (!node) return;

            observerRef.current = new IntersectionObserver(
                ([entry]) => {
                    if (!entry.isIntersecting) return;
                    tryLoadMore();
                },
                { threshold: 0 },
            );

            observerRef.current.observe(node);
        },
        [tryLoadMore],
    );

    const lastItemTrackingValue = useMemo(() => {
        if (!isAsync || list.length === 0) return null;
        const lastIndex = list.length - 1;
        const last = list[lastIndex];
        const isPrimitive = typeof last.value === 'string' || typeof last.value === 'number';

        return isPrimitive ? String(last.value) : `${last.label}-${lastIndex}`;
    }, [isAsync, list]);

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'ArrowDown' || !lastItemTrackingValue) return;

        const root = e.currentTarget;
        const selectedEl = root.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]');
        const selectedValue = selectedEl?.getAttribute('data-value');

        if (selectedValue && selectedValue === lastItemTrackingValue) {
            const { isAsync: asyncMode, pageInfo: pi } = paginationRef.current;
            const serverHasMore = Boolean(asyncMode && pi && pi.page < pi.total_pages - 1);

            if (serverHasMore) {
                e.preventDefault();
                tryLoadMore();
            }
        }
    };

    const debouncedSearch = useCallback(
        debounce(
            (nextValue: string) => {
                setSearchQuery(nextValue);

                if (isAsync) {
                    void fetchList(nextValue, 0);
                } else {
                    setLoading(true);
                }
            },
            500,
            { leading: false, trailing: true },
        ),
        [fetchList, isAsync],
    );

    useEffect(() => {
        if (!loading) return;

        if (data && Array.isArray(data)) {
            let results = data.filter((item) => item.label.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1);

            if (selected.length > 0) {
                results = results.filter((res) => !selected.some((item) => item.label === res.label));
            }
            if (newSuggestion?.enabled) {
                const matchArray = results.filter((e) => {
                    if (e.searchLabel) return e.searchLabel === value.trim();

                    return e.label === value.trim();
                });

                setIsExactMatch(matchArray.length !== 0);
            }
            setList(results);
            setLoading(false);
        }
    }, [searchQuery, loading, data, selected, newSuggestion?.enabled, value]);

    const clearQueryAndReload = () => {
        debouncedSearch.cancel();
        setValue('');
        setSearchQuery('');

        if (isAsync) {
            setPageInfo(null);
            void fetchList('', 0);
        } else {
            setLoading(true);
        }
    };

    const selectSuggestion = (item: SuggestionItem<T>) => {
        onSelect?.(item);
        if (item.label !== '') {
            if (staging) {
                return;
            }
            if (closeOnSelect) {
                setOpen(false);
            } else {
                clearQueryAndReload();
            }
        }
    };

    const addNewTag = (item: SuggestionItem<T>) => {
        if (newSuggestion?.enabled) {
            newSuggestion.action(item);
            if (staging) {
                return;
            }
            if (closeOnSelect) {
                setOpen(false);
            } else {
                clearQueryAndReload();
            }
        }
    };

    const isPendingItem = (item: SuggestionItem<T>) => pendingSelected.some((p) => suggestionItemsEqual(p, item));

    const showAddNew = Boolean(
        newSuggestion?.enabled &&
        ((list.length > 0 && value && (!isExactMatch || list.length <= maxLength)) ||
            (list.length === 0 && (newSuggestion?.label || value))),
    );

    return {
        open,
        setOpen,
        loading,
        setLoading,
        loadingMore,
        value,
        setValue,
        searchQuery,
        list,
        pageInfo,
        isAsync,
        fetchList,
        debouncedSearch,
        clearQueryAndReload,
        selectSuggestion,
        addNewTag,
        isPendingItem,
        showAddNew,
        sentinelCallbackRef,
        handleCommandKeyDown,
    };
};

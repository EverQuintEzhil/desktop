import type { SortingState } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TableUrlState {
    pageIndex: number;
    pageSize: number;
    search: string;
    sort: SortingState;
    setSearch: (value: string) => void;
    setPageIndex: (value: number) => void;
    setPageSize: (value: number) => void;
    setSort: (value: SortingState) => void;
    setPagination: (state: { pageIndex: number; pageSize: number }) => void;
    patch: (updates: Record<string, string | null>) => void;
    /** Read an arbitrary param from the active source (URL, falling back to stored params on a cold load). */
    getParam: (key: string) => string | null;
}

export interface TableUrlParamsOptions {
    defaultPageSize?: number;
    defaultSort?: SortingState;
    storageKey?: string;
}

const DEFAULT_PAGE_SIZE = 10;

function parseSortParam(raw: string | null): SortingState {
    if (!raw) return [];

    return raw.split(',').flatMap((entry) => {
        const [id, direction] = entry.split(':');

        if (!id || (direction !== 'asc' && direction !== 'desc')) return [];

        return [{ id, desc: direction === 'desc' }];
    });
}

function serializeSortParam(sort: SortingState): string | null {
    if (!sort.length) return null;

    return sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',');
}

export function useTableUrlParams(options: TableUrlParamsOptions = {}): TableUrlState {
    const { defaultPageSize = DEFAULT_PAGE_SIZE, defaultSort = [], storageKey } = options;
    const [searchParams, setSearchParams] = useSearchParams();

    const storedParams = useMemo(() => {
        if (!storageKey || searchParams.toString()) return null;

        const stored = localStorage.getItem(storageKey);

        return stored ? new URLSearchParams(stored) : null;
    }, [storageKey, searchParams]);

    const activeParams = storedParams ?? searchParams;

    const rawPage = Number(activeParams.get('page') ?? 1);
    const pageIndex = Math.max(0, rawPage - 1);

    const rawSize = Number(activeParams.get('size'));
    const pageSize = rawSize > 0 ? rawSize : defaultPageSize;

    const search = activeParams.get('search') ?? '';

    const rawSort = parseSortParam(activeParams.get('sort'));
    const sort = rawSort.length > 0 ? rawSort : defaultSort;

    const getParam = useCallback((key: string) => activeParams.get(key), [activeParams]);

    const patch = useCallback(
        (updates: Record<string, string | null>) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);

                    for (const [key, value] of Object.entries(updates)) {
                        if (value === null || value === '') {
                            next.delete(key);
                        } else {
                            next.set(key, value);
                        }
                    }

                    if (storageKey) {
                        localStorage.setItem(storageKey, next.toString());
                    }

                    return next;
                },
                { replace: true },
            );
        },
        [setSearchParams, storageKey],
    );

    const setSearch = useCallback((value: string) => patch({ search: value || null, page: null }), [patch]);

    const setPageIndex = useCallback(
        (value: number) => patch({ page: value <= 0 ? null : String(value + 1) }),
        [patch],
    );

    const setPageSize = useCallback(
        (value: number) => patch({ size: value === defaultPageSize ? null : String(value), page: null }),
        [patch, defaultPageSize],
    );

    const setSort = useCallback((value: SortingState) => patch({ sort: serializeSortParam(value) }), [patch]);

    const setPagination = useCallback(
        (state: { pageIndex: number; pageSize: number }) =>
            patch({
                page: state.pageIndex <= 0 ? null : String(state.pageIndex + 1),
                size: state.pageSize === defaultPageSize ? null : String(state.pageSize),
            }),
        [patch, defaultPageSize],
    );

    useEffect(() => {
        if (!storageKey) return;
        if (searchParams.toString()) return;

        const stored = localStorage.getItem(storageKey);

        if (!stored) return;

        setSearchParams(new URLSearchParams(stored), { replace: true });
    }, [storageKey, searchParams, setSearchParams]);

    return {
        pageIndex,
        pageSize,
        search,
        sort,
        setSearch,
        setPageIndex,
        setPageSize,
        setSort,
        setPagination,
        patch,
        getParam,
    };
}

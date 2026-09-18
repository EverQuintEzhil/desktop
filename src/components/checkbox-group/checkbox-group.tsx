import axios from 'axios';
import debounce from 'lodash/debounce';
import { type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import useIsMounted from '@/hooks/use-is-mounted';
import { cn } from '@/lib/utils';
import { getElementTopAndBottom } from '@/utils';

const { isCancel } = axios;

const SemiCircle = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn('size-4 animate-spin rounded-full border-2 border-white border-t-[#dadada]', className)}
        {...props}
    />
);

export interface CheckBoxOptionObj {
    key?: string;
    label: string;
    prefix?: string;
    suffix?: string;
    value?: string;
    disabled?: boolean;
}

export interface ListWithPageInfo {
    list: Array<CheckBoxOptionObj>;
    pageInfo: {
        page: number;
        totalPages: number;
    };
}

export interface ICheckboxGroupProps {
    data:
        | Array<CheckBoxOptionObj>
        | ((
              searchQuery: string,
              pageNo: number,
              axiosCancelRef: React.MutableRefObject<(() => void) | null>,
          ) => Promise<ListWithPageInfo | Array<CheckBoxOptionObj>>);
    icon?: {
        icon: LucideIcon;
        colorValue?: string;
    };
    label?: (option: CheckBoxOptionObj) => string;
    name: string;
    placeholder?: string;
    required?: boolean;
    search?: boolean;
    styles?: string;
    value: Array<CheckBoxOptionObj>;
    onChange: (value: Array<CheckBoxOptionObj>) => void;
    reload?: boolean;
    showSelectAll?: boolean;
    className?: string;
}

export interface CheckboxGroupState {
    list: Array<CheckBoxOptionObj>;
    loading: boolean;
    page: number;
    showMoreLoading: boolean;
    totalPages: number;
}

interface RenderCheckboxListProps extends CheckboxGroupState {
    fetchData: (pageNo: number) => void;
    infiniteLoading: boolean;
    name: string;
    selected: Array<CheckBoxOptionObj>;
    onChange: (option: CheckBoxOptionObj, checked: boolean) => void;
    showSelectAll?: boolean;
    propOnChange: (value: Array<CheckBoxOptionObj>) => void;
}

const compareValue = (v: CheckBoxOptionObj, s?: string) => (typeof v === 'string' ? v === s : v.value === s);

const RenderCheckboxList = (props: RenderCheckboxListProps) => {
    const {
        fetchData,
        infiniteLoading,
        list,
        loading,
        name,
        onChange,
        page,
        selected,
        showMoreLoading,
        totalPages,
        propOnChange,
        showSelectAll,
    } = props;

    const [didScroll, setDidScroll] = React.useState<boolean>(false);
    const timerRef = React.useRef<number | null>(null);
    const listRef = React.useRef<HTMLUListElement>(null);

    const handleScroll = () => {
        if (timerRef.current !== null) {
            setDidScroll(false);
            window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
            setDidScroll(true);
        }, 500);
    };

    React.useEffect(() => {
        if (didScroll && infiniteLoading) {
            const { top: scrollTop, scrollHeight } = getElementTopAndBottom(listRef.current);

            if (listRef?.current && Math.ceil(listRef.current.offsetHeight + scrollTop) >= scrollHeight) {
                if (!showMoreLoading && fetchData && totalPages - page > 1) {
                    fetchData(page + 1);
                }
            }
        }
    }, [didScroll, infiniteLoading]);

    React.useEffect(() => {
        const scrollEl = listRef.current;

        if (scrollEl && infiniteLoading) {
            scrollEl.addEventListener('scroll', handleScroll, { passive: true });

            return () => {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                }
                scrollEl.removeEventListener('scroll', handleScroll);
            };
        }

        return () => {};
    }, [loading, list, infiniteLoading]);

    if (loading) {
        return (
            <div className="flex justify-center p-4">
                <Spinner />
            </div>
        );
    }

    const isAllSelected = list.length === selected.length;

    return (
        <ul
            className="scrollbar-controller scrollbar-vertical m-0 flex max-h-[200px] w-full list-none flex-col gap-2 p-0"
            ref={listRef}
        >
            <li>
                {showSelectAll && list.length > 0 ? (
                    <Checkbox
                        checked={isAllSelected}
                        indeterminate={selected.length > 0 && !isAllSelected}
                        label="Select / Unselect All"
                        name={`select-all-${name}`}
                        onChange={(_, isChecked) => {
                            if (isChecked) {
                                propOnChange(list);
                            } else {
                                propOnChange([]);
                            }
                        }}
                    />
                ) : null}
            </li>
            {list.map((option: CheckBoxOptionObj) => (
                <li key={`checkboxgroup-${name}-item-${option.key}`}>
                    <Checkbox
                        checked={selected.findIndex((v: CheckBoxOptionObj) => compareValue(v, option.value)) !== -1}
                        disabled={!!option.disabled}
                        id={`checkboxgroup-${name}-item-${option.key}`}
                        label={`${option.prefix || ''}${option.label}${option.suffix || ''}`}
                        name={`checkboxgroup-${name}-item-${option.key}`}
                        value={option.value}
                        onChange={(_, isChecked) => onChange(option, isChecked)}
                    />
                </li>
            ))}
            {infiniteLoading && showMoreLoading && (
                <li className="flex items-center justify-center p-2">
                    <SemiCircle />
                </li>
            )}
        </ul>
    );
};

const CheckboxGroup = (props: ICheckboxGroupProps) => {
    const {
        data,
        name,
        value: propValue,
        onChange: propOnChange,
        styles = '',
        className = '',
        reload = false,
        showSelectAll,
        search,
        placeholder,
        icon,
    } = props;

    const [searchTerm, setSearchTerm] = React.useState('');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [value, setValue] = React.useState<Array<CheckBoxOptionObj>>([]);
    const isMountedRef = useIsMounted();
    const axiosCancelRef = React.useRef<(() => void) | null>(null);
    const [state, setState] = React.useState<CheckboxGroupState>({
        list: [],
        page: -1,
        totalPages: -1,
        showMoreLoading: false,
        loading: true,
    });

    React.useEffect(() => {
        if (state.loading) {
            fetchData(0);
        }
    }, [state.loading]);

    React.useEffect(() => {
        if (!state.loading) {
            setState({
                list: [],
                page: -1,
                totalPages: -1,
                showMoreLoading: false,
                loading: true,
            });
        }
    }, [searchQuery]);

    React.useEffect(() => {
        if (reload) {
            setState({
                list: [],
                page: -1,
                totalPages: -1,
                showMoreLoading: false,
                loading: true,
            });
        }
    }, [reload]);

    const fetchData = async (pageNo: number = 0) => {
        try {
            if (data && Array.isArray(data)) {
                const searchData = data.slice();
                const escapedValue = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`${escapedValue}`, 'i');
                const filterted = searchData.filter((el) => regex.test(el.label));

                setState({
                    ...state,
                    list: filterted,
                    loading: false,
                });
            }
            if (data && typeof data === 'function') {
                if (axiosCancelRef.current && typeof axiosCancelRef.current === 'function') {
                    axiosCancelRef.current();
                }
                const response: ListWithPageInfo | Array<CheckBoxOptionObj> = await data(
                    searchQuery,
                    pageNo,
                    axiosCancelRef,
                );

                axiosCancelRef.current = null;
                if (isMountedRef.current) {
                    if (Array.isArray(response)) {
                        setState({
                            ...state,
                            list: response,
                            loading: false,
                        });
                    } else if (response && Array.isArray(response.list)) {
                        setState({
                            loading: false,
                            list: [...state.list, ...response.list],
                            page: response.pageInfo.page,
                            totalPages: response.pageInfo.totalPages,
                            showMoreLoading: false,
                        });
                    } else {
                        setState({
                            ...state,
                            loading: false,
                        });
                    }
                }
            }
        } catch (err) {
            setState({
                ...state,
                loading: false,
                showMoreLoading: false,
            });
            if (!isCancel(err)) {
                console.error(err);
            }
        }
    };

    React.useEffect(() => {
        if (propValue) {
            setValue(propValue);
        } else {
            setValue([]);
        }
    }, [propValue]);

    const onChange = ({ label: l, value: v }: CheckBoxOptionObj, checked: boolean) => {
        if (checked) {
            propOnChange([...value, { label: l, value: v }]);
        } else {
            propOnChange(value.filter((item) => !compareValue(item, v)));
        }
    };

    const debouncedSearch = React.useCallback(
        debounce(
            (nextValue) => {
                setSearchQuery(nextValue);
            },
            500,
            { leading: false, trailing: true },
        ),
        [],
    );

    const renderSearch = () => {
        if (search) {
            const SearchIcon = icon?.icon;

            return (
                <div className="checkbox-group-search relative mb-2 w-full">
                    {SearchIcon && (
                        <SearchIcon
                            className="absolute top-1/2 left-2 z-1 size-4 -translate-y-1/2 text-muted-foreground"
                            style={icon.colorValue ? { color: icon.colorValue } : undefined}
                        />
                    )}
                    <Input
                        placeholder={placeholder}
                        value={searchTerm}
                        className={cn(SearchIcon && 'pl-10')}
                        onChange={(e) => {
                            setSearchTerm(e.currentTarget.value);
                            debouncedSearch(e.currentTarget.value);
                        }}
                    />
                </div>
            );
        }

        return null;
    };

    return (
        <div
            className={cn('flex w-full flex-col', className)}
            style={
                styles
                    ? {
                          ...Object.fromEntries(
                              styles
                                  .split(';')
                                  .filter(Boolean)
                                  .map((s) => s.split(':').map((x) => x.trim())),
                          ),
                      }
                    : undefined
            }
        >
            {renderSearch()}
            <RenderCheckboxList
                name={name}
                selected={value}
                onChange={onChange}
                infiniteLoading={state.totalPages > 1}
                fetchData={(pageNo: number) => {
                    setState({
                        ...state,
                        showMoreLoading: true,
                    });
                    fetchData(pageNo);
                }}
                propOnChange={propOnChange}
                showSelectAll={showSelectAll}
                {...state}
            />
        </div>
    );
};

export { CheckboxGroup };

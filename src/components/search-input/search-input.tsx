import debounce from 'lodash/debounce';
import { SearchIcon, XIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    searchOnChange?: boolean;
    autoFocus?: boolean;
    debounceWait?: number;
    /**
     * Commit a still-pending term when the input unmounts instead of dropping it. For an input
     * inside content that comes and goes (a tab panel, a collapsible section), where leaving
     * mid-typing would otherwise lose what was typed.
     */
    flushOnUnmount?: boolean;
    onChange: (val: string) => void;
    search: string;
    placeholder?: string;
    inputClassName?: string;
}

const SearchInput = (props: Props) => {
    const {
        searchOnChange = false,
        autoFocus = true,
        debounceWait = 750,
        flushOnUnmount = false,
        onChange,
        search: searchProp,
        placeholder,
        inputClassName,
        className,
        ...rest
    } = props;

    const [search, setSearch] = useState(searchProp);

    useEffect(() => {
        setSearch(searchProp);
    }, [searchProp]);

    // Called through a ref so the debounced function can be built once. Keying it on `onChange`
    // instead would rebuild it on every parent re-render, and lodash keeps the pending timer on
    // the instance that scheduled it — so a re-render mid-typing would drop that keystroke.
    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const debouncedSearch = useMemo(
        () =>
            debounce(
                (nextValue: string) => {
                    onChangeRef.current(nextValue);
                },
                debounceWait,
                { leading: false, trailing: true },
            ),
        [debounceWait],
    );

    useEffect(() => {
        return () => {
            if (flushOnUnmount) {
                debouncedSearch.flush();

                return;
            }

            debouncedSearch.cancel();
        };
    }, [debouncedSearch, flushOnUnmount]);

    // Enter and the clear button commit right away, which makes anything the debouncer still has
    // queued stale. Left queued, a term typed just before clearing lands one `debounceWait` later
    // and the `searchProp` sync above then puts it back in the box the user just emptied.
    const commitNow = (nextValue: string) => {
        debouncedSearch.cancel();
        setSearch(nextValue);
        onChange(nextValue);
    };

    return (
        <div className={cn('search-input relative w-full [&:focus-within_i]:text-primary', className)} {...rest}>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
            <Input
                className={cn(
                    'pl-7 shadow-surface dark:border dark:border-(--neutral-border-2) dark:shadow-none',
                    search !== '' && 'pr-10',
                    inputClassName,
                )}
                placeholder={placeholder || 'Search'}
                autoFocus={autoFocus}
                value={search}
                onEnter={commitNow}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = e.currentTarget.value;

                    setSearch(val);
                    if (searchOnChange) {
                        debouncedSearch(val);
                    }
                }}
            />
            {search !== '' && (
                <Button
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-1/2 right-2 size-7 min-h-7 -translate-y-1/2 rounded-full p-0"
                    onClick={() => commitNow('')}
                >
                    <XIcon />
                </Button>
            )}
        </div>
    );
};

export default SearchInput;

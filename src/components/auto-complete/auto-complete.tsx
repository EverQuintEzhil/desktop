import React, { useCallback, useRef } from 'react';

import { Command, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

import SpinnerBlade from '../ui/spinner';

import StagingFooter from './components/staging-footer';
import SuggestionsList from './components/suggestions-list';
import { useAutoCompleteSuggestions } from './hooks';
import type { AutoCompleteProps, SuggestionItem } from './types';
import { isRadixOutsideTargetWithin } from './utils/is-radix-outside-target-within';
import './auto-complete.scss';

export { suggestionItemsEqual } from './utils/suggestion-items-equal';
export type { AutoCompleteAsyncData, SuggestionItem } from './types';

const AutoComplete = <T,>(props: AutoCompleteProps<T>) => {
    const {
        isError,
        trim = true,
        onFocus,
        value: valueProp,
        onSelect,
        newSuggestion,
        onBlur,
        onKeyDown: onKeyDownProp,
        onChange: onChangeProp,
        onEnter,
        data,
        selected = [],
        closeOnSelect = true,
        staging = false,
        pendingSelected = [],
        stagingFooterActions,
        labelPosition,
        ...rest
    } = props;

    const rootRef = useRef<HTMLDivElement | null>(null);
    const popoverContentRef = useRef<HTMLDivElement | null>(null);

    const addNew = newSuggestion?.enabled;
    const newSuggestionLabel = newSuggestion?.label || '';
    const allowChangeWithoutAction = newSuggestion?.allowChangeWithoutAction;

    const {
        open,
        setOpen,
        loading,
        setLoading,
        loadingMore,
        value,
        setValue,
        list,
        pageInfo,
        isAsync,
        fetchList,
        debouncedSearch,
        selectSuggestion,
        addNewTag,
        isPendingItem,
        showAddNew,
        sentinelCallbackRef,
        handleCommandKeyDown,
    } = useAutoCompleteSuggestions({
        data,
        valueProp,
        selected,
        newSuggestion,
        onSelect,
        closeOnSelect,
        staging,
        pendingSelected,
    });

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setTimeout(() => {
            const active = document.activeElement;
            const insideAnchor = Boolean(active && rootRef.current?.contains(active));
            const insidePopover = Boolean(active && popoverContentRef.current?.contains(active));

            if (insideAnchor || insidePopover) {
                return;
            }

            setOpen(false);
            onBlur?.(e);
        }, 0);
    };

    const preventPopoverDismissWhenAnchorTarget = useCallback((event: Event) => {
        if (isRadixOutsideTargetWithin(event, rootRef.current)) {
            event.preventDefault();
        }
    }, []);

    /** Modal Sheet/Dialog uses RemoveScroll (shard = panel); portaled popovers on body lose wheel scroll. */
    const modalPortalContainer = !open
        ? undefined
        : (() => {
              const root = rootRef.current;
              const el = root?.closest('[data-slot=sheet-content]') ?? root?.closest('.dialog-block');

              return el instanceof HTMLElement ? el : undefined;
          })();

    return (
        <div
            ref={rootRef}
            className={`auto-complete flex flex-wrap${isError ? ' has-error' : ''}${labelPosition === 'overlay' ? ' label-overlay' : ''}`}
            data-trim={trim ? 'true' : undefined}
        >
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverAnchor asChild>
                    <div className="input-holder relative w-full">
                        {loading && (
                            <div className="pointer-events-none absolute top-1/2 right-2.5 z-1 -translate-y-1/2 text-muted-foreground">
                                <SpinnerBlade className="size-4" />
                            </div>
                        )}
                        <Input
                            {...rest}
                            type="text"
                            value={value}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const v = e.currentTarget.value;

                                setValue(v);
                                debouncedSearch(v);
                                if (v === '') {
                                    selectSuggestion({ label: '', value: null } as SuggestionItem<T>);
                                } else if (allowChangeWithoutAction) {
                                    selectSuggestion({ label: v, value: v } as SuggestionItem<T>);
                                }
                                if (!open) setOpen(true);
                                onChangeProp?.(e);
                            }}
                            onFocus={(e) => {
                                setOpen(true);

                                if (isAsync) {
                                    void fetchList(value, 0);
                                } else {
                                    setLoading(true);
                                }
                                onFocus?.(e);
                            }}
                            onBlur={handleInputBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape' && staging && stagingFooterActions) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    stagingFooterActions.onCancel();

                                    return;
                                }
                                if (e.key === 'Enter' && onEnter) {
                                    onEnter(e as unknown as KeyboardEvent);
                                }
                                onKeyDownProp?.(e as unknown as KeyboardEvent);
                            }}
                        />
                    </div>
                </PopoverAnchor>
                <PopoverContent
                    ref={popoverContentRef}
                    align="start"
                    className="flex max-w-[220px] flex-col overflow-x-hidden"
                    container={modalPortalContainer}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerDownOutside={preventPopoverDismissWhenAnchorTarget}
                    onFocusOutside={preventPopoverDismissWhenAnchorTarget}
                >
                    <Command
                        shouldFilter={false}
                        loop
                        tabIndex={0}
                        className="min-w-0 focus-visible:outline-none"
                        onKeyDown={handleCommandKeyDown}
                    >
                        <CommandList className={'outline-none focus:outline-none focus-visible:outline-none'}>
                            <SuggestionsList
                                loading={loading}
                                loadingMore={loadingMore}
                                list={list}
                                value={value}
                                staging={staging}
                                isAsync={isAsync}
                                addNew={addNew}
                                newSuggestionLabel={newSuggestionLabel}
                                showAddNew={showAddNew}
                                pageInfo={pageInfo}
                                isPendingItem={isPendingItem}
                                selectSuggestion={selectSuggestion}
                                addNewTag={addNewTag}
                                sentinelCallbackRef={sentinelCallbackRef}
                            />
                        </CommandList>
                    </Command>
                    {staging && stagingFooterActions ? (
                        <StagingFooter
                            pendingSelectedCount={pendingSelected.length}
                            stagingFooterActions={stagingFooterActions}
                        />
                    ) : null}
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default AutoComplete;

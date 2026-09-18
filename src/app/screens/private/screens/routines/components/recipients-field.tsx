import { useQuery } from '@tanstack/react-query';
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import Avatar from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { adminUsersApi, USERS_LIST_QUERY_KEY } from '@/lib/api/admin/users';
import { cn } from '@/lib/utils';
import { ROUTINE_MAX_RECIPIENTS } from '@/types/routines';

import { optionFromUser, type RecipientOption } from '../utils/recipients';

export interface RecipientErrorAction {
    label: string;
    isPending: boolean;
    onClick: () => void;
}

export interface Props {
    value: RecipientOption[];
    onChange: (value: RecipientOption[]) => void;
    /** Marks the viewer's own row "(you)". */
    currentUserId?: string;
    /** The api's own rejection sentence, rendered exactly as it wrote it. */
    error?: string | null;
    /** Present only for a `RECIPIENT_NO_SPACE_ACCESS` refusal — the one an admin can fix here. */
    errorAction?: RecipientErrorAction | null;
}

const SEARCH_DEBOUNCE_MS = 300;

const CANDIDATE_PAGE_SIZE = 10;

const RecipientRowSkeleton = () => (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 flex-1 rounded" />
    </div>
);

const RecipientsField = ({ value, onChange, currentUserId, error, errorAction }: Props) => {
    const listboxId = useId();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [term, setTerm] = useState('');

    const isEmpty = value.length === 0;

    useEffect(() => {
        const timer = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [search]);

    // Only while open: a routine form that is never expanded should not fetch a user list.
    const { data: candidates, isFetching } = useQuery({
        queryKey: [...USERS_LIST_QUERY_KEY, 'recipient-search', term],
        queryFn: ({ signal }) =>
            adminUsersApi.list({ page: 0, size: CANDIDATE_PAGE_SIZE, ...(term ? { search: term } : {}) }, { signal }),
        enabled: open,
        staleTime: 60_000,
    });

    const isFull = value.length >= ROUTINE_MAX_RECIPIENTS;
    const selectedIds = new Set(value.map((option) => option.userId));

    const remove = (userId: string) => onChange(value.filter((option) => option.userId !== userId));

    const toggle = (option: RecipientOption) => {
        if (selectedIds.has(option.userId)) {
            remove(option.userId);

            return;
        }
        if (isFull) return;

        onChange([...value, option]);
    };

    const options = (candidates?.values ?? []).map(optionFromUser);

    const renderChips = () => {
        if (value.length === 0) {
            return <span className="truncate px-1 text-sm text-muted-foreground">Add people to email...</span>;
        }

        return (
            <div className="recipients-field-chips flex flex-wrap items-center gap-1">
                {value.map((option) => (
                    <span
                        key={option.userId}
                        className="recipients-field-chip flex max-w-full items-center gap-1 rounded-sm bg-accent px-2 py-0.5 text-primary"
                    >
                        <span className="truncate text-sm">{option.name}</span>
                        <button
                            type="button"
                            aria-label={`Remove ${option.name}`}
                            className="cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring)"
                            onClick={(e) => {
                                e.stopPropagation();
                                remove(option.userId);
                            }}
                        >
                            <XIcon aria-hidden="true" className="pointer-events-none size-3" />
                        </button>
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="recipients-field flex flex-col gap-1.5">
            <Label className="text-sm text-text-secondary">Recipients</Label>
            <Popover open={open} onOpenChange={setOpen} modal>
                {/* A div, not a Button: each chip carries its own remove control, and an
                    interactive descendant of a button is ignored or double-fired by screen readers. */}
                <PopoverTrigger asChild>
                    <div
                        role="combobox"
                        tabIndex={0}
                        aria-expanded={open}
                        aria-controls={listboxId}
                        aria-label="Recipients"
                        onClick={() => setOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return;
                            e.preventDefault();
                            setOpen(true);
                        }}
                        className={cn(
                            'flex min-h-8 cursor-pointer items-center gap-2 rounded-md border bg-card px-2 py-0.5 text-sm outline-none',
                            'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:ring-offset-2',
                            error ? 'border-destructive' : 'border-border-secondary',
                            open && !error ? 'border-primary' : '',
                        )}
                    >
                        <div className="flex min-w-0 flex-1 items-center justify-start overflow-hidden">
                            {renderChips()}
                        </div>
                        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    id={listboxId}
                    // max-w, not just w: the primitive's own `max-w-xs` otherwise caps the list at
                    // 320px under a much wider field, truncating every address in it.
                    className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) min-w-[200px] p-0"
                    align="start"
                >
                    {/* cmdk filters on its own item text, which would fight the api's own search. */}
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Search by name or email..."
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList className="max-h-[200px]">
                            {isFetching ? (
                                <CommandGroup>
                                    <RecipientRowSkeleton />
                                    <RecipientRowSkeleton />
                                    <RecipientRowSkeleton />
                                </CommandGroup>
                            ) : null}
                            {!isFetching && options.length === 0 ? <CommandEmpty>No people found</CommandEmpty> : null}
                            {!isFetching ? (
                                <CommandGroup>
                                    {options.map((option) => {
                                        const isSelected = selectedIds.has(option.userId);

                                        return (
                                            <CommandItem
                                                key={option.userId}
                                                value={option.userId}
                                                disabled={isFull && !isSelected}
                                                onSelect={() => toggle(option)}
                                                className="flex cursor-pointer items-center gap-2.5"
                                            >
                                                <Avatar
                                                    size="sm"
                                                    alt={option.name}
                                                    src={option.avatar}
                                                    className="shrink-0"
                                                />
                                                <span className="flex min-w-0 flex-1 flex-col">
                                                    {/* Pinned, because `.command-item` turns a hovered row primary and the address
                                                        below it does not follow — a half-purple person reads as a link. */}
                                                    <span className="truncate text-sm text-(--text-primary)">
                                                        {option.name}
                                                        {option.userId === currentUserId ? (
                                                            <span className="text-(--text-secondary)"> (you)</span>
                                                        ) : null}
                                                    </span>
                                                    {option.email ? (
                                                        <span className="truncate text-xs text-(--text-secondary)">
                                                            {option.email}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <CheckIcon
                                                    className={cn(
                                                        'size-4 shrink-0 text-primary',
                                                        isSelected ? 'opacity-100' : 'opacity-0',
                                                    )}
                                                />
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            ) : null}
                        </CommandList>
                    </Command>
                    {isFull ? (
                        <p className="border-t border-border px-3 py-2 text-xs text-(--text-secondary)">
                            {`A routine can email up to ${ROUTINE_MAX_RECIPIENTS} people. Remove one to add another.`}
                        </p>
                    ) : null}
                </PopoverContent>
            </Popover>
            {error ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-destructive">
                    {error}
                    {errorAction ? (
                        <button
                            type="button"
                            onClick={errorAction.onClick}
                            disabled={errorAction.isPending}
                            className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline disabled:cursor-default disabled:opacity-60"
                        >
                            {errorAction.isPending ? 'Adding…' : errorAction.label}
                        </button>
                    ) : null}
                </span>
            ) : null}
            {!error && isEmpty ? (
                <span className="text-xs text-(--text-secondary)">
                    With nobody picked, only the routine&apos;s owner is emailed. To stop the emails, set Notification
                    to Off.
                </span>
            ) : null}
        </div>
    );
};

export default RecipientsField;

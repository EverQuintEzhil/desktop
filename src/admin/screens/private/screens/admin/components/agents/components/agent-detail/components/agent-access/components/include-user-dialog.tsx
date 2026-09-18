import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import SearchInput from '@/components/search-input/search-input';
import ShowMoreButton from '@/components/show-more-button';
import Avatar from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { adminUsersApi, USERS_LIST_QUERY_KEY } from '@/lib/api/admin/users';
import { cn } from '@/lib/utils';
import type { UserType } from '@/types/admin';

const USERS_SEARCH_PAGE_SIZE = 10;

/** Bound on the auto-paging below, so a tenant of already-included users cannot spin forever. */
const MAX_AUTO_PAGES = 10;

interface IncludeUserDialogProps {
    isOpen: boolean;
    existingUserIds: string[];
    onClose: () => void;
    /** Resolves false when the write failed, so the dialog can stay open with the selection intact. */
    onInclude: (userIds: string[]) => Promise<boolean>;
}

const fullName = (user: UserType): string => `${user.name?.first ?? ''} ${user.name?.last ?? ''}`.trim();

const IncludeUserDialog = (props: IncludeUserDialogProps) => {
    const { isOpen, existingUserIds, onClose, onInclude } = props;

    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isIncluding, setIsIncluding] = useState(false);
    const [pageCount, setPageCount] = useState(1);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIds([]);
            setPageCount(1);
        }
    }, [isOpen]);

    // A single page would hide anyone past the tenth match, so the list grows a page at a time
    // rather than silently making some users unpickable.
    const candidatesQuery = useQuery({
        queryKey: [...USERS_LIST_QUERY_KEY, 'access-include', search, USERS_SEARCH_PAGE_SIZE * pageCount],
        queryFn: () => adminUsersApi.list({ page: 0, size: USERS_SEARCH_PAGE_SIZE * pageCount, search }),
        enabled: isOpen,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });

    const fetched = candidatesQuery.data?.values ?? [];
    const candidates = fetched.filter((user) => !existingUserIds.includes(user._id));
    // Candidates are filtered AFTER fetching, so paging keys off what the server still has, not off
    // what survived the filter — otherwise a page of already-included users reads as "nobody
    // matched" and the eleventh user can never be reached.
    const hasMore = (candidatesQuery.data?.pageInfo.totalCount ?? 0) > fetched.length;

    // An agent whose first page is entirely people who already have access would otherwise show an
    // empty list next to a Show more button. Keep pulling pages until someone selectable appears.
    useEffect(() => {
        if (candidates.length === 0 && hasMore && !candidatesQuery.isFetching && pageCount < MAX_AUTO_PAGES) {
            setPageCount((count) => count + 1);
        }
    }, [candidates.length, hasMore, candidatesQuery.isFetching, pageCount]);

    const toggle = (userId: string) =>
        setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

    const handleInclude = async () => {
        if (selectedIds.length === 0) return;

        setIsIncluding(true);
        try {
            if (await onInclude(selectedIds)) onClose();
        } finally {
            setIsIncluding(false);
        }
    };

    const renderCandidate = (user: UserType) => {
        const name = fullName(user);
        const isSelected = selectedIds.includes(user._id);

        return (
            <button
                key={user._id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(user._id)}
                className={cn(
                    'include-user-dialog-candidate flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left',
                    isSelected ? 'bg-accent' : 'hover:bg-accent/50',
                )}
            >
                <Checkbox checked={isSelected} tabIndex={-1} className="pointer-events-none" />
                <Avatar size="sm" src={user.avatar} alt={name} />
                <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{name}</span>
                    <span className="truncate text-xs text-text-secondary">{user.email}</span>
                </span>
            </button>
        );
    };

    const renderCandidates = () => {
        if (candidatesQuery.isPending) {
            return (
                <div className="flex items-center gap-2 p-2 text-sm text-text-secondary">
                    <Spinner className="size-4" />
                </div>
            );
        }

        // A failed search must not read as "nobody matched" — that is a different answer.
        if (candidatesQuery.isError) {
            return (
                <div className="flex items-center gap-2 p-2 text-sm text-destructive">
                    <CircleAlert className="size-4 shrink-0" />
                    Could not load users.
                    <Button size="xs" variant="outline" onClick={() => candidatesQuery.refetch()}>
                        Retry
                    </Button>
                </div>
            );
        }

        // Past the auto-page cap this must fall through to Show more, or the spinner never ends and
        // the next page is unreachable.
        if (candidates.length === 0 && hasMore && pageCount < MAX_AUTO_PAGES) {
            return (
                <div className="flex items-center gap-2 p-2 text-sm text-text-secondary">
                    <Spinner className="size-4" />
                    Looking for users without access…
                </div>
            );
        }

        return (
            <>
                {candidates.length === 0 ? (
                    <span className="p-2 text-sm text-text-secondary">
                        {fetched.length === 0 ? 'No users match.' : 'Everyone who matches already has access.'}
                    </span>
                ) : (
                    candidates.map(renderCandidate)
                )}
                <ShowMoreButton
                    hasMore={hasMore}
                    isLoading={candidatesQuery.isFetching}
                    onClick={() => setPageCount((count) => count + 1)}
                />
            </>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="include-user-dialog max-w-lg">
                <DialogHeader>
                    <DialogTitle>Include users</DialogTitle>
                    <DialogDescription>Gives the people you pick access to this agent.</DialogDescription>
                </DialogHeader>

                <DialogBody className="include-user-dialog-body flex flex-col gap-3 py-4">
                    <SearchInput
                        search={search}
                        onChange={(value) => {
                            setSearch(value);
                            setPageCount(1);
                        }}
                        searchOnChange
                        placeholder="Search users…"
                        debounceWait={300}
                    />

                    <div className="include-user-dialog-list scrollbar-controller scrollbar-vertical flex max-h-72 flex-col gap-0.5">
                        {renderCandidates()}
                    </div>
                </DialogBody>

                <DialogFooter className="include-user-dialog-footer items-center justify-between">
                    <span className="text-sm text-text-secondary">
                        {selectedIds.length > 0 && `${selectedIds.length} selected`}
                    </span>
                    <span className="flex items-center gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleInclude} disabled={selectedIds.length === 0 || isIncluding}>
                            {isIncluding && <Spinner className="size-4" />}
                            Include
                        </Button>
                    </span>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IncludeUserDialog;

import { useQueryClient } from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import { CheckIcon, ChevronDownIcon, LinkIcon, SearchIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import { adminUsersApi, USERS_LIST_QUERY_KEY } from '@/lib/api/admin/users';
import { cn } from '@/lib/utils';
import type { UserType } from '@/types/admin';
import type { ProjectMember, ProjectMemberRole } from '@/types/project';
import { showErrorToast, showSuccessToast } from '@/utils';

const USERS_SEARCH_PAGE_SIZE = 10;

type MemberRoleInput = 'viewer' | 'editor';

interface Props {
    isOpen: boolean;
    projectName: string;
    members: ProjectMember[];
    owner: { _id: string; name: string; email: string; avatar?: string };
    currentUserId: string;
    shareUrl: string;
    onClose: () => void;
    onAddMember: (userId: string, role: MemberRoleInput) => Promise<void>;
    onChangeRole: (userId: string, role: MemberRoleInput) => Promise<void>;
    onRemoveMember: (userId: string) => Promise<void>;
    onLeaveSpace?: () => void;
}

const initialsOf = (value: string): string => value.trim().charAt(0).toUpperCase() || '?';

const displayName = (user: UserType): string =>
    [user.name?.first, user.name?.last].filter(Boolean).join(' ') || user.email || 'User';

const roleLabel = (role: ProjectMemberRole): string => (role === 'editor' ? 'Can edit' : 'Can view');

const Avatar = ({ label, src }: { label: string; src?: string }) => {
    const [errored, setErrored] = useState(false);

    if (src && !errored) {
        return (
            <img
                src={src}
                alt={label}
                onError={() => setErrored(true)}
                className="size-10 shrink-0 rounded-full border border-white object-cover shadow-sm ring-1 ring-border-secondary"
            />
        );
    }

    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-1 ring-primary/15">
            {initialsOf(label)}
        </span>
    );
};

const ProjectShareModal = (props: Props) => {
    const {
        isOpen,
        projectName,
        members,
        owner,
        currentUserId,
        shareUrl,
        onClose,
        onAddMember,
        onChangeRole,
        onRemoveMember,
    } = props;

    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<UserType[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const latestTermRef = useRef('');

    const memberIds = useMemo(() => members.map((m) => m._id), [members]);
    const displayMembers = useMemo(
        () => members.filter((m) => m.role !== 'owner' && m._id !== owner._id),
        [members, owner._id],
    );

    const runSearch = useMemo(
        () =>
            debounce(async (query: string) => {
                const trimmed = query.trim();

                latestTermRef.current = trimmed;
                if (!trimmed) {
                    setResults([]);
                    setIsSearching(false);

                    return;
                }
                try {
                    const response = await queryClient.fetchQuery({
                        queryKey: [...USERS_LIST_QUERY_KEY, 'search', trimmed, 0],
                        queryFn: () =>
                            adminUsersApi.list({
                                page: 0,
                                size: USERS_SEARCH_PAGE_SIZE,
                                search: trimmed,
                            }),
                        staleTime: 60_000,
                    });

                    if (latestTermRef.current !== trimmed) return;
                    setResults(response.values);
                } catch {
                    if (latestTermRef.current === trimmed) setResults([]);
                    showErrorToast('Failed to search people');
                } finally {
                    if (latestTermRef.current === trimmed) setIsSearching(false);
                }
            }, 400),
        [queryClient],
    );

    useEffect(() => () => runSearch.cancel(), [runSearch]);

    useEffect(() => {
        if (!isOpen) {
            setSearch('');
            setResults([]);
        }
    }, [isOpen]);

    const onSearchChange = (value: string) => {
        setSearch(value);
        setIsSearching(Boolean(value.trim()));
        runSearch(value);
    };

    const withPending = useCallback(async (id: string, action: () => Promise<void>, failMessage: string) => {
        setPendingId(id);
        try {
            await action();
        } catch {
            showErrorToast(failMessage);
        } finally {
            setPendingId(null);
        }
    }, []);

    const addUser = (user: UserType) => {
        if (memberIds.includes(user._id)) return;
        setSearch('');
        setResults([]);
        withPending(user._id, () => onAddMember(user._id, 'viewer'), 'Failed to add member');
    };

    const changeRole = (userId: string, role: MemberRoleInput) =>
        withPending(
            userId,
            async () => {
                await onChangeRole(userId, role);
                if (userId === currentUserId && role === 'viewer') {
                    onClose();
                }
            },
            'Failed to update access',
        );

    const removeMember = (userId: string) =>
        withPending(
            userId,
            async () => {
                await onRemoveMember(userId);
                if (userId === currentUserId && props.onLeaveSpace) {
                    props.onLeaveSpace();
                }
            },
            'Failed to remove member',
        );

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            showSuccessToast('Link copied');
        } catch {
            showErrorToast('Failed to copy link');
        }
    };

    const visibleResults = results.filter(
        (user) => !memberIds.includes(user._id) && user._id !== owner._id && user._id !== currentUserId,
    );

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                className="max-h-[90vh] max-w-[560px] grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-border-secondary shadow-[0_24px_80px] shadow-(color:--shadow-color)/18"
                overlayClassName="bg-black/45 backdrop-blur-[2px]"
            >
                <DialogHeader className="flex-row items-center justify-between gap-3 px-6 py-5">
                    <DialogTitle className="text-xl leading-7">Share {`"${projectName}"`}</DialogTitle>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-primary hover:bg-primary/10"
                        aria-label="Close"
                        onClick={onClose}
                    >
                        <XIcon />
                    </Button>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-6 px-6 py-5">
                    <div className="flex flex-col gap-2.5">
                        <span className="text-sm font-semibold text-foreground">Add people by email</span>
                        <div className="relative">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="h-12 rounded-xl border-border-secondary pl-11 text-base shadow-[0_1px_2px] shadow-(color:--shadow-color)/5 focus:border-primary"
                                placeholder="Search by name or email..."
                                value={search}
                                onChange={(e) => onSearchChange(e.currentTarget.value)}
                            />
                            {search.trim() ? (
                                <div
                                    className={cn(
                                        'scrollbar-controller scrollbar-vertical absolute top-full right-0 left-0 z-30 mt-2 max-h-64',
                                        'rounded-xl border border-border-secondary bg-popover',
                                        'shadow-[0_16px_40px] shadow-(color:--shadow-color)/16',
                                        'scrollbar-vertical scrollbar-controller',
                                    )}
                                >
                                    {isSearching ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Spinner />
                                        </div>
                                    ) : null}
                                    {!isSearching && visibleResults.length === 0 ? (
                                        <div className="px-3 py-4 text-center text-sm text-text-secondary">
                                            No people found
                                        </div>
                                    ) : null}
                                    {!isSearching &&
                                        visibleResults.map((user) => (
                                            <button
                                                key={user._id}
                                                type="button"
                                                disabled={Boolean(pendingId)}
                                                onClick={() => addUser(user)}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 disabled:opacity-50"
                                            >
                                                <Avatar label={displayName(user)} src={user.avatar} />
                                                <span className="flex min-w-0 flex-col">
                                                    <span className="truncate text-sm font-medium">
                                                        {displayName(user)}
                                                    </span>
                                                    <span className="truncate text-xs text-text-secondary">
                                                        {user.email}
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <span className="text-sm font-semibold text-foreground">People with access</span>
                        <div className="overflow-hidden rounded-2xl border border-border-secondary bg-card">
                            <ul className="scrollbar-vertical scrollbar-controller flex max-h-[42vh] flex-col">
                                <li className="flex items-center gap-3 px-4 py-3.5">
                                    <Avatar label={owner.name} src={owner.avatar} />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-medium">
                                            {owner.name}
                                            {owner._id === currentUserId ? (
                                                <span className="text-text-secondary"> (you)</span>
                                            ) : null}
                                        </span>
                                        {owner.email ? (
                                            <span className="truncate text-xs text-text-secondary">{owner.email}</span>
                                        ) : null}
                                    </span>
                                    <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-medium text-text-secondary">
                                        Owner
                                    </span>
                                </li>
                                {displayMembers.map((member) => (
                                    <li
                                        key={member._id}
                                        className="flex items-center gap-3 border-t border-border-secondary px-4 py-3.5"
                                    >
                                        <Avatar label={member.name} src={member.avatar} />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-sm font-medium">{member.name}</span>
                                            {member.email ? (
                                                <span className="truncate text-xs text-text-secondary">
                                                    {member.email}
                                                </span>
                                            ) : null}
                                        </span>
                                        <DropdownMenuRoot>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 rounded-full px-3 text-primary hover:bg-primary/10"
                                                    disabled={pendingId === member._id}
                                                >
                                                    {pendingId === member._id ? (
                                                        <Spinner className="size-4" />
                                                    ) : (
                                                        <>
                                                            {roleLabel(member.role)}
                                                            <ChevronDownIcon className="mt-0.5 size-4" />
                                                        </>
                                                    )}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                side="bottom"
                                                className="z-60 max-w-[280px]"
                                            >
                                                <DropdownMenuItem
                                                    className="cursor-pointer flex-col items-start gap-0.5"
                                                    onClick={() => changeRole(member._id, 'viewer')}
                                                >
                                                    <span className="flex w-full items-center justify-between gap-2">
                                                        Can view
                                                        <CheckIcon
                                                            className={cn(
                                                                'size-4',
                                                                member.role === 'viewer' ? 'opacity-100' : 'opacity-0',
                                                            )}
                                                        />
                                                    </span>
                                                    <span className="text-xs text-text-secondary">
                                                        Read space content and chat with it
                                                    </span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-pointer flex-col items-start gap-0.5"
                                                    onClick={() => changeRole(member._id, 'editor')}
                                                >
                                                    <span className="flex w-full items-center justify-between gap-2">
                                                        Can edit
                                                        <CheckIcon
                                                            className={cn(
                                                                'size-4',
                                                                member.role === 'editor' ? 'opacity-100' : 'opacity-0',
                                                            )}
                                                        />
                                                    </span>
                                                    <span className="text-xs text-text-secondary">
                                                        Manage space content and members
                                                    </span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    className="cursor-pointer"
                                                    onClick={() => removeMember(member._id)}
                                                >
                                                    {member._id === currentUserId ? 'Leave space' : 'Remove access'}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenuRoot>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter className="justify-end border-t border-border-secondary bg-muted/20 px-6 py-5">
                    {shareUrl ? (
                        <Button variant="outline" size="sm" className="rounded-xl px-4" onClick={copyLink}>
                            <LinkIcon />
                            Copy link
                        </Button>
                    ) : null}
                    <Button size="sm" className="rounded-xl px-5" onClick={onClose}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectShareModal;

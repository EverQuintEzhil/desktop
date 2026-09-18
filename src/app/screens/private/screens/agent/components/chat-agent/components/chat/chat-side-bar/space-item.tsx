import {
    FolderIcon,
    FolderMinusIcon,
    FolderOpenIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PinIcon,
    PinOffIcon,
    ShareIcon,
    SquarePenIcon,
    TrashIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useProjectConversations } from '@/components/agent-chat/hooks/use-projects';
import DeleteConfirmationModal from '@/components/agent-chat/view/delete-confirmation-modal';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectChatType, ProjectType } from '@/types/project';
import { showErrorToast, showSuccessToast } from '@/utils';

import ExportConversationMenu from '../../export-conversation-menu';

import AddToProjectMenu from './add-to-project-menu';

interface Props {
    project: ProjectType;
    agent: ChatAgentType;
    isOwner: boolean;
    canEdit?: boolean;
    isPinned?: boolean;
    onMobileClose?: () => void;
    onTogglePin: (project: ProjectType) => void;
    onEdit: (project: ProjectType) => void;
    onDelete: (project: ProjectType) => void;
    onShare: (project: ProjectType) => void;
}

const SpaceItem = (props: Props) => {
    const {
        project,
        agent,
        isOwner,
        canEdit,
        isPinned = true,
        onMobileClose,
        onTogglePin,
        onEdit,
        onDelete,
        onShare,
    } = props;
    const navigate = useNavigate();
    const params = useParams();
    const [isExpanded, setIsExpanded] = useState(false);
    const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [pendingPinId, setPendingPinId] = useState<string | null>(null);
    const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
    const [isChatActioning, setIsChatActioning] = useState(false);

    const path = `spaces/${project._id}`;
    const spaceUrl = `/agent/${agent.slug}/${path}`;
    const isSpaceActive = params['*'] === path;

    const { chats, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage, chatActions } = useProjectConversations(
        agent._id,
        project._id,
        isExpanded,
    );

    const goToSpace = () => {
        onMobileClose?.();
        navigate(spaceUrl);
    };

    const toggleChatPin = async (chat: ProjectChatType) => {
        if (pendingPinId) return;
        setPendingPinId(chat._id);
        try {
            await chatActions.toggleFavorite(chat._id);
        } catch {
            showErrorToast('Failed to update pin');
        } finally {
            setPendingPinId(null);
        }
    };

    const startChatRename = (chat: ProjectChatType) => {
        setRenamingChatId(chat._id);
        setRenameValue(chat.title);
    };

    const cancelChatRename = () => {
        setRenamingChatId(null);
        setRenameValue('');
    };

    const submitChatRename = async (chatId: string) => {
        const trimmed = renameValue.trim();

        if (!trimmed) {
            cancelChatRename();

            return;
        }
        try {
            await chatActions.renameChat(chatId, trimmed);
        } catch {
            showErrorToast('Failed to rename chat');
        } finally {
            cancelChatRename();
        }
    };

    const changeChatSpace = async (chatId: string, targetProjectId: string | null) => {
        if (targetProjectId === project._id) return;
        try {
            await chatActions.moveChatToProject(chatId, targetProjectId);
            showSuccessToast(targetProjectId ? 'Moved to selected space' : 'Removed from space');
        } catch {
            showErrorToast('Failed to change space');
        }
    };

    const confirmChatDelete = async () => {
        if (!deleteChatId) return;
        setIsChatActioning(true);
        try {
            await chatActions.deleteChat(deleteChatId);
            if (params['*'] === `chat/${deleteChatId}`) {
                navigate(`/agent/${agent.slug}`);
            }
            setDeleteChatId(null);
        } catch {
            showErrorToast('Failed to delete chat');
        } finally {
            setIsChatActioning(false);
        }
    };

    const renderChatItem = (chat: ProjectChatType) => (
        <li
            key={chat._id}
            className={cn('nav-list-item chat-nav-list-item relative', params['*'] === `chat/${chat._id}` && 'active')}
        >
            {renamingChatId === chat._id ? (
                <div className="flex items-center rounded-lg bg-(--sidebar-primary) px-2 py-1">
                    <input
                        autoFocus
                        className="h-0 min-h-6 min-w-0 flex-1 bg-transparent px-1 text-sm text-(--sidebar-primary-foreground) outline-none placeholder:text-(--sidebar-primary-foreground)/60"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') submitChatRename(chat._id);
                            if (e.key === 'Escape') cancelChatRename();
                        }}
                        onBlur={() => submitChatRename(chat._id)}
                    />
                </div>
            ) : (
                <Link
                    to={`/agent/${agent.slug}/chat/${chat._id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1"
                    onClick={onMobileClose}
                >
                    <span className="line-clamp-1 text-sm" title={chat.title}>
                        {chat.title}
                    </span>
                    <div className="flex items-center gap-0.5">
                        <DropdownMenuRoot>
                            <Button
                                className="popup delete-button rounded-full"
                                size="icon-xs"
                                variant="secondary"
                                aria-label={chat.favorited ? 'Unpin' : 'Pin'}
                                disabled={pendingPinId === chat._id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    toggleChatPin(chat);
                                }}
                            >
                                {chat.favorited ? <PinOffIcon /> : <PinIcon />}
                            </Button>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    className="popup delete-button rounded-full"
                                    size="icon-xs"
                                    variant="secondary"
                                    aria-label="More"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                >
                                    <MoreHorizontalIcon />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" className="overflow-hidden">
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleChatPin(chat);
                                    }}
                                >
                                    {chat.favorited ? (
                                        <PinOffIcon className="size-3.5" />
                                    ) : (
                                        <PinIcon className="size-3.5" />
                                    )}
                                    {chat.favorited ? 'Unpin' : 'Pin'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        startChatRename(chat);
                                    }}
                                >
                                    <PencilIcon className="size-3.5" />
                                    Rename
                                </DropdownMenuItem>
                                <AddToProjectMenu
                                    agentId={agent._id}
                                    selectedProjectId={project._id}
                                    label="Change space"
                                    onSelect={(target) => changeChatSpace(chat._id, target)}
                                />
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        changeChatSpace(chat._id, null);
                                    }}
                                >
                                    <FolderMinusIcon className="size-3.5" />
                                    Remove from space
                                </DropdownMenuItem>
                                <ExportConversationMenu
                                    agentId={agent._id}
                                    conversationId={chat._id}
                                    title={chat.title}
                                />
                                <DropdownMenuItem
                                    variant="destructive"
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteChatId(chat._id);
                                    }}
                                >
                                    <TrashIcon className="size-3.5" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenuRoot>
                    </div>
                </Link>
            )}
        </li>
    );

    return (
        <>
            <li
                className={cn(
                    'nav-list-item chat-nav-list-item relative animate-in duration-200 fade-in slide-in-from-top-1 motion-reduce:animate-none',
                    isSpaceActive && 'active',
                )}
            >
                <div
                    role="button"
                    tabIndex={0}
                    className="nav-list-item-trigger flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1 text-left"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIsExpanded((prev) => !prev);
                        }
                    }}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        {isExpanded ? (
                            <FolderOpenIcon className="size-4 shrink-0" />
                        ) : (
                            <FolderIcon className="size-4 shrink-0" />
                        )}
                        <span className="line-clamp-1 text-sm" title={project.name}>
                            {project.name}
                        </span>
                    </span>
                    <div className="flex items-center gap-0.5">
                        <Button
                            className="popup delete-button rounded-full"
                            size="icon-xs"
                            variant="secondary"
                            aria-label="New chat in space"
                            onClick={(e) => {
                                e.stopPropagation();
                                goToSpace();
                            }}
                        >
                            <SquarePenIcon />
                        </Button>
                        <DropdownMenuRoot>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    className="popup delete-button rounded-full"
                                    size="icon-xs"
                                    variant="secondary"
                                    aria-label="More"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontalIcon />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" className="overflow-hidden">
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        goToSpace();
                                    }}
                                >
                                    <FolderOpenIcon className="size-3.5" />
                                    Open space
                                </DropdownMenuItem>
                                {(canEdit ?? isOwner) ? (
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onShare(project);
                                        }}
                                    >
                                        <ShareIcon className="size-3.5" />
                                        Share space
                                    </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin(project);
                                    }}
                                >
                                    {isPinned ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
                                    {isPinned ? 'Unpin' : 'Pin'}
                                </DropdownMenuItem>
                                {isOwner ? (
                                    <>
                                        <DropdownMenuItem
                                            className="cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit(project);
                                            }}
                                        >
                                            <PencilIcon className="size-3.5" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            variant="destructive"
                                            className="cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(project);
                                            }}
                                        >
                                            <TrashIcon className="size-3.5" />
                                            Delete
                                        </DropdownMenuItem>
                                    </>
                                ) : null}
                            </DropdownMenuContent>
                        </DropdownMenuRoot>
                    </div>
                </div>
            </li>
            {isExpanded && (
                <li className="nav-list-item">
                    <ul className="flex flex-col gap-0.5 pl-4">
                        {isLoading
                            ? ['a', 'b', 'c'].map((key) => (
                                  <li key={key} className="px-2 py-1">
                                      <Skeleton className="h-5 w-full rounded-md" />
                                  </li>
                              ))
                            : null}
                        {!isLoading && chats.length === 0 ? (
                            <li className="px-2 py-1 text-sm text-(--sidebar-foreground)/60">No chats yet</li>
                        ) : null}
                        {chats.map(renderChatItem)}
                        {hasNextPage ? (
                            <li className="nav-list-item">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-center text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-primary) hover:text-(--sidebar-primary-foreground)"
                                    disabled={isFetchingNextPage}
                                    onClick={() => fetchNextPage()}
                                >
                                    {isFetchingNextPage ? <Spinner className="text-sidebar-foreground" /> : 'Show more'}
                                </Button>
                            </li>
                        ) : null}
                    </ul>
                </li>
            )}
            <DeleteConfirmationModal
                isOpen={Boolean(deleteChatId)}
                onClose={() => setDeleteChatId(null)}
                onConfirm={confirmChatDelete}
                isLoading={isChatActioning}
            />
        </>
    );
};

export default SpaceItem;

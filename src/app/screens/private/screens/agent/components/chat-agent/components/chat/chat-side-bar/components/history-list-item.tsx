import {
    ChevronRightIcon,
    FolderIcon,
    FolderMinusIcon,
    MessageCircleIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PinIcon,
    PinOffIcon,
    TrashIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import ConversationStatusIndicator from '@/app/components/conversation-status-indicator';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks';
import { cn } from '@/lib/utils';
import type { HistoryType } from '@/types/chat';

import ExportConversationMenu from '../../../export-conversation-menu';
import AddToProjectMenu from '../add-to-project-menu';
import SpacePickerDrillDown from '../space-picker-drill-down';

interface Props {
    history: HistoryType;
    agentId: string;
    agentSlug?: string;
    spacesEnabled: boolean;
    isActive: boolean;
    isMoving: boolean;
    isUnread: boolean;
    showIcon?: boolean;
    isRenaming: boolean;
    renameValue: string;
    isRenameSubmitting: boolean;
    onRenameValueChange: (value: string) => void;
    onRenameSubmit: () => void;
    onRenameCancel: () => void;
    onStartRename: () => void;
    onToggleFavorite: () => void;
    onAddToProject: (projectId: string | null) => void;
    onDelete: () => void;
    onHistoryClick: () => void;
}

const HistoryListItem = (props: Props) => {
    const {
        history,
        agentId,
        agentSlug,
        spacesEnabled,
        isActive,
        isMoving,
        isUnread,
        showIcon = false,
        isRenaming,
        renameValue,
        isRenameSubmitting,
        onRenameValueChange,
        onRenameSubmit,
        onRenameCancel,
        onStartRename,
        onToggleFavorite,
        onAddToProject,
        onDelete,
        onHistoryClick,
    } = props;

    const [isPickingSpace, setIsPickingSpace] = useState(false);
    const isCompact = useMediaQuery('(max-width: 1023px)');

    const spaceLabel = history.chat_project_id ? 'Change space' : 'Add to space';
    const showSpacePicker = spacesEnabled && isCompact && isPickingSpace;

    const handleSpaceSelect = (projectId: string | null) => {
        setIsPickingSpace(false);
        onAddToProject(projectId);
    };

    const renderSpaceAction = () => {
        if (!isCompact) {
            return (
                <AddToProjectMenu
                    agentId={agentId}
                    selectedProjectId={history.chat_project_id}
                    label={spaceLabel}
                    onSelect={onAddToProject}
                />
            );
        }

        return (
            <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsPickingSpace(true);
                }}
            >
                <FolderIcon className="size-3.5" />
                {spaceLabel}
                <ChevronRightIcon className="ml-auto size-4" />
            </DropdownMenuItem>
        );
    };

    const renderMenuItems = () => (
        <>
            <DropdownMenuItem
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleFavorite();
                }}
                className="cursor-pointer"
            >
                {history.favorited ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
                {history.favorited ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onStartRename();
                }}
                className="cursor-pointer"
            >
                <PencilIcon className="size-3.5" />
                Rename
            </DropdownMenuItem>
            {spacesEnabled ? (
                <>
                    {renderSpaceAction()}
                    {history.chat_project_id ? (
                        <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onAddToProject(null);
                            }}
                        >
                            <FolderMinusIcon className="size-3.5" />
                            Remove from space
                        </DropdownMenuItem>
                    ) : null}
                </>
            ) : null}
            <ExportConversationMenu agentId={agentId} conversationId={history._id} title={history.title} />
            <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete();
                }}
                className="cursor-pointer"
            >
                <TrashIcon className="size-3.5" />
                Delete
            </DropdownMenuItem>
        </>
    );

    const renderMenuBody = () => {
        if (showSpacePicker) {
            return (
                <SpacePickerDrillDown
                    agentId={agentId}
                    selectedProjectId={history.chat_project_id}
                    label={spaceLabel}
                    onBack={() => setIsPickingSpace(false)}
                    onSelect={handleSpaceSelect}
                />
            );
        }

        return renderMenuItems();
    };

    if (isRenaming) {
        return (
            <li
                className={cn(
                    'nav-list-item chat-nav-list-item relative animate-in duration-200 fade-in slide-in-from-top-1 motion-reduce:animate-none',
                    isActive && 'active',
                    isMoving && 'pointer-events-none opacity-40 transition-opacity',
                )}
                aria-busy={isMoving || undefined}
            >
                <div className="flex items-center rounded-lg bg-(--sidebar-primary) px-2 py-1">
                    <input
                        autoFocus
                        className="min-w-0 flex-1 bg-transparent px-1 text-sm text-(--sidebar-primary-foreground) outline-none placeholder:text-(--sidebar-primary-foreground)/60"
                        value={renameValue}
                        disabled={isRenameSubmitting}
                        onChange={(e) => onRenameValueChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onRenameSubmit();
                            if (e.key === 'Escape') onRenameCancel();
                        }}
                        onBlur={onRenameSubmit}
                        style={{
                            minHeight: '24px',
                            height: '0px',
                        }}
                    />
                </div>
            </li>
        );
    }

    return (
        <li
            className={cn(
                'nav-list-item chat-nav-list-item relative animate-in duration-200 fade-in slide-in-from-top-1 motion-reduce:animate-none',
                isActive && 'active',
                isMoving && 'pointer-events-none opacity-40 transition-opacity',
            )}
            aria-busy={isMoving || undefined}
        >
            <Link
                to={`/agent/${agentSlug}/chat/${history._id}`}
                className="flex items-center justify-between rounded-lg px-2 py-1"
                onClick={onHistoryClick}
            >
                <span className="flex min-w-0 items-center gap-2" title={history.title}>
                    <ConversationStatusIndicator status={history.status} isUnread={isUnread} collapseWhenEmpty />
                    {showIcon && <MessageCircleIcon className="size-4 shrink-0" />}
                    <span className="line-clamp-1 text-sm">{history.title}</span>
                </span>
                <div className="flex items-center gap-0.5">
                    <DropdownMenuRoot
                        onOpenChange={(open) => {
                            if (!open) setIsPickingSpace(false);
                        }}
                    >
                        <Button
                            className="popup delete-button rounded-full"
                            size="icon-xs"
                            variant="secondary"
                            aria-label={history.favorited ? 'Unpin' : 'Pin'}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onToggleFavorite();
                            }}
                        >
                            {history.favorited ? <PinOffIcon /> : <PinIcon />}
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
                        <DropdownMenuContent
                            align="end"
                            side="bottom"
                            className={cn('overflow-hidden', showSpacePicker && 'w-[min(20rem,calc(100vw-2rem))] p-0')}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {renderMenuBody()}
                        </DropdownMenuContent>
                    </DropdownMenuRoot>
                </div>
            </Link>
        </li>
    );
};

export type { Props as HistoryListItemProps };
export default HistoryListItem;

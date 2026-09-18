import {
    LockIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PinIcon,
    PinOffIcon,
    ShareIcon,
    Trash2Icon,
    UsersIcon,
    WrenchIcon,
} from 'lucide-react';

import { useTextClamp } from '@/app/hooks';
import AgentNameLink, { agentDisplayName, type AgentRef } from '@/components/agent-chat/agent-name-link';
import Avatar from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getFilesDownloadUrl } from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectType } from '@/types/project';

import ChatToolsPanel from '../../chat-tools-panel';
import SpaceInstructionsCard from '../../space-instructions-card';
import { formatShortDate } from '../../utils/format-short-date';

export interface Props {
    agent: ChatAgentType;
    project: ProjectType;
    canEdit: boolean;
    isOwnerCurrentUser: boolean;
    isPinningSpace: boolean;
    onPin: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onShare: () => void;
    onSetInstructions: (instructions: string) => Promise<void>;
}

const renderPrivacyBadgeContent = (isPrivate: boolean) => {
    if (isPrivate) {
        return (
            <>
                <LockIcon className="size-3" />
                Private
            </>
        );
    }

    return (
        <>
            <UsersIcon className="size-3" />
            Shared
        </>
    );
};

const renderPrivacyBadge = (isPrivate: boolean) => (
    <Badge variant="outline" className="rounded-full">
        {renderPrivacyBadgeContent(isPrivate)}
    </Badge>
);

const renderCreator = (project: ProjectType, isOwnerCurrentUser: boolean) => {
    if (isOwnerCurrentUser || !project.creator) return null;

    return (
        <>
            <span className="flex items-center gap-1.5">
                <Avatar
                    size="sm"
                    className="size-5"
                    alt={project.creator.name}
                    src={project.creator.avatar ? getFilesDownloadUrl(project.creator.avatar) : undefined}
                />
                <span className="font-medium text-foreground">{project.creator.name}</span>
            </span>
            <span aria-hidden>·</span>
        </>
    );
};

const renderCreatorLine = (project: ProjectType, isOwnerCurrentUser: boolean, agent?: AgentRef | null) => (
    <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        {agentDisplayName(agent) ? (
            <>
                <AgentNameLink agent={agent} />
                <span aria-hidden>·</span>
            </>
        ) : null}
        {renderCreator(project, isOwnerCurrentUser)}
        <span>{isOwnerCurrentUser ? 'Created by you' : 'Shared with you'}</span>
        <span aria-hidden>·</span>
        <span>{formatShortDate(project.updatedAt)}</span>
    </div>
);

const renderDescription = (description: string, clamp: ReturnType<typeof useTextClamp<HTMLParagraphElement>>) => (
    <div className="project-detail-description flex w-full flex-col items-start gap-1">
        <p
            ref={clamp.ref}
            className={cn(
                'w-full text-sm leading-6 text-text-secondary',
                clamp.isExpanded ? 'line-clamp-none' : 'line-clamp-2',
            )}
        >
            {description}
        </p>
        {clamp.isClamped || clamp.isExpanded ? (
            <button
                type="button"
                onClick={() => clamp.setIsExpanded((prev) => !prev)}
                className="text-sm font-medium text-primary hover:underline"
            >
                {clamp.isExpanded ? 'Read less' : 'Read more'}
            </button>
        ) : null}
    </div>
);

const renderPinnedAt = (pinnedAt: ProjectType['pinnedAt']) => {
    if (pinnedAt) {
        return (
            <>
                <PinOffIcon className="size-3.5" />
                Unpin
            </>
        );
    }

    return (
        <>
            <PinIcon className="size-3.5" />
            Pin
        </>
    );
};

const renderOwnerActions = (isOwnerCurrentUser: boolean, onEdit: () => void, onDelete: () => void) => {
    if (!isOwnerCurrentUser) return null;

    return (
        <>
            <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                <PencilIcon className="size-3.5" />
                Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={onDelete}>
                <Trash2Icon className="size-3.5" />
                Delete
            </DropdownMenuItem>
        </>
    );
};

const renderMoreActionsMenu = (props: {
    project: ProjectType;
    isOwnerCurrentUser: boolean;
    isPinningSpace: boolean;
    onPin: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) => {
    const { project, isOwnerCurrentUser, isPinningSpace, onPin, onEdit, onDelete } = props;

    return (
        <DropdownMenuRoot>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="More actions"
                            className="shrink-0 rounded-full"
                        >
                            <MoreHorizontalIcon className="size-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">More actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem className="cursor-pointer" disabled={isPinningSpace} onClick={onPin}>
                    {renderPinnedAt(project.pinnedAt)}
                </DropdownMenuItem>
                {renderOwnerActions(isOwnerCurrentUser, onEdit, onDelete)}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

const ProjectHeader = ({
    agent,
    project,
    canEdit,
    isOwnerCurrentUser,
    isPinningSpace,
    onPin,
    onEdit,
    onDelete,
    onShare,
    onSetInstructions,
}: Props) => {
    const clamp = useTextClamp<HTMLParagraphElement>(project.description);

    return (
        <div className="project-detail-header flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="project-detail-header-titles flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h1 className="line-clamp-2 text-2xl font-semibold tracking-tight">{project.name}</h1>
                        {renderPrivacyBadge(project.isPrivate)}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                size="xs"
                                className="shrink-0 rounded-full lg:hidden"
                                aria-label="Connectors and skills"
                            >
                                <WrenchIcon className="size-3.5" />
                                Tools
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-full sm:max-w-md">
                            <SheetHeader>
                                <SheetTitle>Connectors &amp; skills</SheetTitle>
                            </SheetHeader>
                            <SheetBody>
                                <div className="flex flex-col gap-5">
                                    <SpaceInstructionsCard
                                        instructions={project.instructions || ''}
                                        canEdit={canEdit}
                                        onSave={onSetInstructions}
                                    />
                                    <ChatToolsPanel agent={agent} />
                                </div>
                            </SheetBody>
                        </SheetContent>
                    </Sheet>
                    {canEdit ? (
                        <Button variant="outline" size="xs" className="shrink-0 rounded-full" onClick={onShare}>
                            <ShareIcon className="size-3.5" />
                            Share
                        </Button>
                    ) : null}
                    {renderMoreActionsMenu({
                        project,
                        isOwnerCurrentUser,
                        isPinningSpace,
                        onPin,
                        onEdit,
                        onDelete,
                    })}
                </div>
            </div>
            {renderCreatorLine(project, isOwnerCurrentUser, agent)}
            {project.description ? renderDescription(project.description, clamp) : null}
        </div>
    );
};

export default ProjectHeader;

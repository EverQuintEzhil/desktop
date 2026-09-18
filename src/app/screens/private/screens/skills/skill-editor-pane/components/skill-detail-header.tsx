import { CopyPlusIcon, DownloadIcon, MoreVerticalIcon, PencilIcon, ReplaceIcon, Trash2Icon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuRoot as DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import type { SkillType } from '@/types/admin';

export interface Props {
    skill: SkillType;
    isOwner: boolean;
    isAdmin: boolean;
    isInUse: boolean;
    updatedAtLabel: string;
    isReplacingSkill: boolean;
    useSkillMutationPending: boolean;
    onToggleInUse: (disabled: boolean) => void;
    cloneSkillMutationPending: boolean;
    onSaveAsPersonal: () => void;
    onDownload: () => void;
    onReplace: () => void;
    onEditSkill: () => void;
    onDeleteRequest: () => void;
}

const SkillDetailHeader = ({
    skill,
    isOwner,
    isAdmin,
    isInUse,
    updatedAtLabel,
    isReplacingSkill,
    useSkillMutationPending,
    onToggleInUse,
    cloneSkillMutationPending,
    onSaveAsPersonal,
    onDownload,
    onReplace,
    onEditSkill,
    onDeleteRequest,
}: Props) => {
    const renderUseSkillButton = () => {
        if (isInUse) {
            return (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={useSkillMutationPending}
                    onClick={() => onToggleInUse(true)}
                >
                    {useSkillMutationPending && <Spinner className="size-4" />}
                    Disable
                </Button>
            );
        }

        return (
            <Button size="sm" disabled={useSkillMutationPending} onClick={() => onToggleInUse(false)}>
                {useSkillMutationPending && <Spinner className="size-4" />}
                Use skill
            </Button>
        );
    };

    return (
        <div className="skill-editor-pane-content-title-bar flex shrink-0 items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-bold tracking-tight">{skill.name}</h2>
                    {isOwner && (
                        <Badge
                            variant="secondary"
                            className="w-fit rounded-full border-transparent bg-primary/10 text-primary"
                        >
                            Custom
                        </Badge>
                    )}
                </div>
                {updatedAtLabel && <div className="text-sm text-muted-foreground">Updated {updatedAtLabel}</div>}
            </div>
            <div className="skill-editor-options flex shrink-0 items-center gap-3">
                {renderUseSkillButton()}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={isReplacingSkill}>
                        <Button variant="ghost" size="icon-xs" className="rounded-full" disabled={isReplacingSkill}>
                            <MoreVerticalIcon className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            disabled={isReplacingSkill}
                            onClick={onDownload}
                        >
                            <DownloadIcon className="size-3.5" />
                            <span>Download skill</span>
                        </DropdownMenuItem>
                        {!isOwner && (
                            <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                disabled={isReplacingSkill || cloneSkillMutationPending}
                                onClick={onSaveAsPersonal}
                            >
                                {cloneSkillMutationPending ? (
                                    <Spinner className="size-3.5" />
                                ) : (
                                    <CopyPlusIcon className="size-3.5" />
                                )}
                                <span>{cloneSkillMutationPending ? 'Forking…' : 'Fork skill'}</span>
                            </DropdownMenuItem>
                        )}
                        {(isOwner || isAdmin) && (
                            <>
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    disabled={isReplacingSkill}
                                    onClick={onReplace}
                                >
                                    <ReplaceIcon className="size-3.5" />
                                    <span>Replace skill</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    disabled={isReplacingSkill}
                                    onClick={onEditSkill}
                                >
                                    <PencilIcon className="size-3.5" />
                                    <span>Edit skill</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="destructive"
                                    className="cursor-pointer gap-2"
                                    disabled={isReplacingSkill}
                                    onClick={onDeleteRequest}
                                >
                                    <Trash2Icon className="size-3.5" />
                                    <span>Delete skill</span>
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};

export default SkillDetailHeader;

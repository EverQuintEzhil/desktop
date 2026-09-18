import {
    ArrowLeftIcon,
    DownloadIcon,
    Loader2Icon,
    MoreVertical,
    PencilIcon,
    SaveIcon,
    Trash2Icon,
    XIcon,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { actionBase, actionRemove, pickerFormWrapCls } from '@/app/components/picker/picker-shared';
import { RecommendedActionButton } from '@/app/components/picker/recommended-action-button';
import ExpandableText from '@/components/expandable-text';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    useDeleteSkillMutation,
    useDownloadSkillAsZipMutation,
    useSkillByIdQuery,
    useUpdateSkillMutation,
} from '@/lib/api/common/skills';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import type { UserType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import { btnCls } from '../../constants';
import { SkillFileViewer } from '../../skill-file-viewer';
import { getSkillAbbr, getSkillColor } from '../../utils/skill-visuals';

const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

const editNameInputCls =
    'w-full bg-transparent text-lg font-medium tracking-[-0.02em] text-(--text-primary) ' +
    'placeholder:text-text-secondary outline-none border-b border-border focus:border-primary transition-colors py-0.5';
const editDescTextareaCls =
    'w-full resize-none rounded-xl border bg-card px-5 py-4 text-sm leading-relaxed ' +
    'text-foreground outline-none focus:border-primary transition-colors scrollbar-controller scrollbar-vertical';

export interface SkillDetailPanelProps {
    skill: { _id: string; name: string; description?: string; creator?: UserType };
    isSelected: boolean;
    isRecommended?: boolean;
    onToggle: (skill: { _id: string; name: string }) => void;
    onUpdate?: (isRecommended: boolean) => void;
    onBack: () => void;
    onClose: () => void;
}

const SkillDetailPanel = ({
    skill,
    isSelected,
    isRecommended,
    onToggle,
    onUpdate,
    onBack,
    onClose,
}: SkillDetailPanelProps) => {
    const downloadSkillMutation = useDownloadSkillAsZipMutation();
    const updateSkillMutation = useUpdateSkillMutation();
    const deleteSkillMutation = useDeleteSkillMutation();
    const [isDeleting, setIsDeleting] = useState(false);
    const { data: fullSkill } = useSkillByIdQuery(isDeleting ? undefined : skill._id);
    const currentUser = useSelector(selectUser);

    const skillName = fullSkill?.name ?? skill.name;
    const skillDescription = fullSkill?.description ?? skill.description ?? '';
    const creatorId = fullSkill?.creator?._id ?? skill.creator?._id;
    const isOwner = !!creatorId && creatorId === currentUser._id;

    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [nameDraft, setNameDraft] = useState(skillName);
    const [descDraft, setDescDraft] = useState(skillDescription);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setNameDraft(skillName);
        setDescDraft(skillDescription);
    }, [skill._id, skillName, skillDescription]);

    useEffect(() => {
        if (isEditing) {
            nameInputRef.current?.focus();
            nameInputRef.current?.select();
        }
    }, [isEditing]);

    const handleToggleEditSkill = () => {
        setIsEditing((prev) => !prev);
    };

    const handleCloseButton = () => {
        if (isEditing) {
            setNameDraft(skillName);
            setDescDraft(skillDescription);
            setIsEditing(false);

            return;
        }
        onClose();
    };

    const handleSaveAndClose = async () => {
        if (updateSkillMutation.isPending) return;

        const trimmedName = nameDraft.trim();
        const trimmedDescription = descDraft.trim();

        if (!trimmedName) {
            setNameDraft(skillName);
            showErrorToast('Skill name cannot be empty.');

            return;
        }
        if (trimmedDescription.length > MAX_SKILL_DESCRIPTION_LENGTH) {
            showErrorToast(`Description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or less.`);

            return;
        }

        const data: { name?: string; description?: string } = {};

        if (trimmedName !== skillName) data.name = trimmedName;
        if (trimmedDescription !== skillDescription) data.description = trimmedDescription;

        if (Object.keys(data).length === 0) {
            setIsEditing(false);

            return;
        }

        try {
            await updateSkillMutation.mutateAsync({ id: skill._id, data });
            setIsEditing(false);
        } catch (error) {
            setNameDraft(skillName);
            setDescDraft(skillDescription);
            showErrorToast(error instanceof Error ? error.message : 'Failed to update skill.');
        }
    };

    const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void handleSaveAndClose();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCloseButton();
        }
    };

    const handleDownload = async () => {
        try {
            const blob = await downloadSkillMutation.mutateAsync(skill._id);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = `${skill.name}.zip`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } catch (error: unknown) {
            showErrorToast(error instanceof Error ? error.message : 'Failed to download skill zip.');
        }
    };

    const handleDelete = async () => {
        if (deleteSkillMutation.isPending) return;

        setIsDeleting(true);

        try {
            await deleteSkillMutation.mutateAsync(skill._id);
            showSuccessToast('Skill deleted successfully.');
            setShowDeleteConfirm(false);
            if (isSelected) onToggle({ _id: skill._id, name: skill.name });
            onBack();
        } catch (error) {
            setIsDeleting(false);
            const axiosError = error as { response?: { data?: { message?: string } }; message?: string };

            showErrorToast(axiosError.response?.data?.message || axiosError.message || 'Failed to delete skill.');
        }
    };

    const isDescriptionOverLimit = descDraft.trim().length > MAX_SKILL_DESCRIPTION_LENGTH;

    const renderRecommendedAction = () => {
        if (!isSelected || !onUpdate) {
            return null;
        }

        return <RecommendedActionButton isRecommended={!!isRecommended} onChange={onUpdate} />;
    };

    const renderFileViewer = () => {
        if (isDeleting) {
            return (
                <div className="flex h-full w-full items-center justify-center text-text-secondary">
                    <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
                </div>
            );
        }

        return <SkillFileViewer key={skill._id} skill={skill} readOnly={!isEditing} />;
    };

    let descriptionSection = null;

    if (isEditing) {
        descriptionSection = (
            <div className="skill-editor-pane-content-metadata flex min-w-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">Description</span>
                    <span
                        className={cn(
                            'text-xs tabular-nums',
                            isDescriptionOverLimit ? 'text-destructive' : 'text-text-secondary',
                        )}
                    >
                        {descDraft.trim().length}/{MAX_SKILL_DESCRIPTION_LENGTH}
                    </span>
                </div>
                <textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    placeholder="Describe what this skill does and when an agent should use it..."
                    aria-label="Skill description"
                    rows={3}
                    className={editDescTextareaCls}
                />
            </div>
        );
    } else if (skillDescription) {
        descriptionSection = (
            <ExpandableText
                maxLines={2}
                showMoreText="Read more"
                showLessText="Read less"
                textClassName="text-sm leading-relaxed text-foreground"
                buttonClassName="text-sm text-primary hover:text-primary/80 font-medium"
            >
                {skillDescription}
            </ExpandableText>
        );
    }

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-background">
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', btnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-h4 font-bold text-white"
                    style={{ background: getSkillColor(skill._id) }}
                >
                    {getSkillAbbr((isEditing ? nameDraft : skillName) || skillName)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    {isEditing ? (
                        <input
                            ref={nameInputRef}
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={handleNameKeyDown}
                            placeholder="Skill name"
                            aria-label="Skill name"
                            className={editNameInputCls}
                        />
                    ) : (
                        <div className="flex min-w-0 items-center gap-1.5">
                            <h3 className="truncate text-lg font-medium tracking-[-0.02em]">{skillName}</h3>
                        </div>
                    )}
                    <span className="text-sm text-text-secondary">Skill</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {isEditing ? (
                        <Button
                            type="button"
                            size="sm"
                            disabled={updateSkillMutation.isPending}
                            onClick={() => void handleSaveAndClose()}
                        >
                            {updateSkillMutation.isPending ? (
                                <Loader2Icon size={15} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <SaveIcon size={15} aria-hidden="true" />
                            )}
                            {updateSkillMutation.isPending ? 'Saving…' : 'Save'}
                        </Button>
                    ) : (
                        <>
                            <DropdownMenuRoot modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Skill actions"
                                        className={btnCls}
                                    >
                                        <MoreVertical size={17} aria-hidden="true" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        disabled={downloadSkillMutation.isPending}
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            void handleDownload();
                                        }}
                                    >
                                        {downloadSkillMutation.isPending ? (
                                            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                                        ) : (
                                            <DownloadIcon className="size-4" aria-hidden="true" />
                                        )}
                                        Download skill
                                    </DropdownMenuItem>
                                    {isOwner && (
                                        <DropdownMenuItem
                                            className="cursor-pointer"
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                handleToggleEditSkill();
                                            }}
                                        >
                                            <PencilIcon className="size-4" aria-hidden="true" />
                                            Edit skill
                                        </DropdownMenuItem>
                                    )}
                                    {isOwner && (
                                        <DropdownMenuItem
                                            variant="destructive"
                                            className="cursor-pointer"
                                            onSelect={() => setShowDeleteConfirm(true)}
                                        >
                                            <Trash2Icon className="size-4" aria-hidden="true" />
                                            Delete skill
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenuRoot>
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={btnCls}
                        aria-label={isEditing ? 'Cancel editing' : 'Close'}
                        disabled={updateSkillMutation.isPending}
                        onClick={handleCloseButton}
                    >
                        <XIcon size={17} aria-hidden="true" />
                    </Button>
                </div>
            </div>
            <div className="skill-detail-pane scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-6 bg-card p-6">
                {descriptionSection}
                <div className="flex min-h-0 min-h-[455px] flex-1 flex-col gap-2 overflow-hidden">
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
                        {renderFileViewer()}
                    </div>
                </div>
            </div>
            {!isEditing && (
                <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                    <div className={cn(pickerFormWrapCls, 'flex flex-col items-stretch gap-2')}>
                        {renderRecommendedAction()}
                        <button
                            className={cn(actionBase, isSelected && actionRemove)}
                            onClick={() => onToggle({ _id: skill._id, name: skill.name })}
                        >
                            {isSelected ? 'Remove' : 'Enable'}
                        </button>
                    </div>
                </div>
            )}
            <AlertDialog
                open={showDeleteConfirm}
                onOpenChange={(next) => {
                    if (!next && !deleteSkillMutation.isPending) setShowDeleteConfirm(false);
                }}
            >
                <AlertDialogContent
                    size="sm"
                    className="z-60 data-[size=sm]:max-w-lg"
                    overlayClassName="z-60"
                    showCloseButton
                    closeDisabled={deleteSkillMutation.isPending}
                >
                    <AlertDialogHeader
                        className={cn(
                            'place-items-center p-6 text-center',
                            'has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr]',
                            'has-data-[slot=alert-dialog-media]:gap-x-0',
                        )}
                    >
                        <AlertDialogMedia className="mx-auto mb-2 bg-destructive/10 text-destructive sm:row-span-1">
                            <Trash2Icon aria-hidden="true" />
                        </AlertDialogMedia>
                        <AlertDialogTitle className="col-start-auto">Delete skill</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-1 text-center text-sm text-muted-foreground">
                                <p>
                                    Are you sure you want to delete{' '}
                                    <span className="font-medium text-foreground" title={skillName}>
                                        &ldquo;
                                        {skillName}
                                        &rdquo;
                                    </span>
                                    ?
                                </p>
                                <p>This action cannot be undone.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="py-6">
                        <AlertDialogCancel disabled={deleteSkillMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="default"
                            className="border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteSkillMutation.isPending}
                            onClick={(e) => {
                                e.preventDefault();
                                void handleDelete();
                            }}
                        >
                            {deleteSkillMutation.isPending ? (
                                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default SkillDetailPanel;

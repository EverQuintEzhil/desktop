import { ChevronLeft, DownloadIcon, Loader2Icon, MoreVertical, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import SkillInstructions from '@/admin/screens/private/screens/admin/components/skills/components/skill-detail/components/skill-instructions/index';
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
import TextAreaForm from '@/components/ui/textarea-form';
import {
    useSkillByIdQuery,
    useUpdateSkillMutation,
    useDownloadSkillAsZipMutation,
    useDeleteSkillMutation,
} from '@/lib/api/common/skills';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import { showErrorToast, showSuccessToast, makeSafeDownloadFilename } from '@/utils';

import { useSkillInlineFields } from './use-skill-inline-fields';

const inlineFieldCls = cn(
    'w-full border-0 bg-transparent transition-[border-color] duration-150 outline-none',
    'border-b border-transparent pb-0.5',
    'focus:border-b-[color-mix(in_srgb,var(--primary)_72%,var(--border))]',
    'placeholder:text-text-secondary/70',
);

interface SkillEditProps {
    skillId?: string;
    onBack?: () => void;
    onDeleted?: (skillId: string) => void;
    onUpdated?: (skill: { _id: string; name: string }) => void;
    showTitleBackButton?: boolean;
    autoFocusName?: boolean;
}

const SkillEdit = ({
    skillId: skillIdProp,
    onBack,
    onDeleted,
    onUpdated,
    showTitleBackButton = true,
    autoFocusName = false,
}: SkillEditProps) => {
    const params = useParams();
    const navigate = useNavigate();
    const skillId = skillIdProp || params.skillId;

    const [isDeleting, setIsDeleting] = useState(false);
    const { data: fetchedSkill, isLoading, isError } = useSkillByIdQuery(isDeleting ? undefined : skillId);
    const lastSkillRef = useRef(fetchedSkill);

    if (fetchedSkill) lastSkillRef.current = fetchedSkill;
    const skill = fetchedSkill ?? (isDeleting ? lastSkillRef.current : undefined);
    const updateSkillMutation = useUpdateSkillMutation();
    const downloadSkillMutation = useDownloadSkillAsZipMutation();
    const deleteSkillMutation = useDeleteSkillMutation();
    const currentUser = useSelector(selectUser);

    const isOwner = !!skill?.creator?._id && skill.creator._id === currentUser._id;

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const {
        nameDraft,
        setNameDraft,
        descDraft,
        setDescDraft,
        isDescEditing,
        startDescEditing,
        handleNameKeyDown,
        handleNameBlur,
        handleDescKeyDown,
        handleDescBlur,
    } = useSkillInlineFields({
        skill,
        isOwner,
        updateSkillMutation,
        onUpdated,
    });

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate('/settings/skills');
        }
    };

    const handleDownload = async () => {
        if (!skillId || !skill) return;
        try {
            const blob = await downloadSkillMutation.mutateAsync(skillId);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = makeSafeDownloadFilename(skill.name, { extension: 'zip' });
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } catch (error) {
            const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage =
                axiosError.response?.data?.message || axiosError.message || 'Failed to download skill zip.';

            showErrorToast(errorMessage);
        }
    };

    const handleDelete = async () => {
        if (!skill || deleteSkillMutation.isPending) return;

        setIsDeleting(true);

        try {
            await deleteSkillMutation.mutateAsync(skill._id);
            showSuccessToast('Skill deleted successfully.');
            setShowDeleteConfirm(false);
            if (onDeleted) {
                onDeleted(skill._id);
            } else {
                handleBack();
            }
        } catch (error) {
            setIsDeleting(false);
            const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Failed to delete skill.';

            showErrorToast(errorMessage);
        }
    };

    const renderDescription = () => {
        if (isDescEditing) {
            return (
                <TextAreaForm
                    name="description"
                    value={descDraft}
                    aria-label="Skill description"
                    placeholder="Add a description..."
                    disabled={updateSkillMutation.isPending}
                    autoFocus
                    rows={3}
                    className={cn(
                        inlineFieldCls,
                        'max-h-40 min-h-[28px] resize-none rounded-none px-0 py-0.5 shadow-none',
                        'text-sm leading-relaxed text-text-secondary',
                        'focus-visible:border-b-[color-mix(in_srgb,var(--primary)_72%,var(--border))]',
                        'focus-visible:ring-0 focus-visible:outline-none',
                    )}
                    onChange={setDescDraft}
                    onBlur={handleDescBlur}
                    onKeyDown={handleDescKeyDown}
                    onCommandEnter={() => {
                        const active = document.activeElement;

                        if (active instanceof HTMLTextAreaElement) {
                            active.blur();
                        }
                    }}
                />
            );
        }

        if (!descDraft) {
            if (!isOwner) return null;

            return (
                <button
                    type="button"
                    className={cn(
                        inlineFieldCls,
                        'min-h-[28px] cursor-text text-left text-sm text-text-secondary/70 italic',
                    )}
                    onClick={startDescEditing}
                >
                    Add a description...
                </button>
            );
        }

        if (!isOwner) {
            return (
                <ExpandableText
                    maxLines={2}
                    showMoreText="Read more"
                    showLessText="Read less"
                    textClassName="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap"
                    buttonClassName="text-xs text-primary hover:text-primary/80"
                >
                    {descDraft}
                </ExpandableText>
            );
        }

        return (
            <div
                role="button"
                tabIndex={0}
                className="cursor-text outline-none"
                onClick={startDescEditing}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        startDescEditing();
                    }
                }}
            >
                <ExpandableText
                    maxLines={2}
                    showMoreText="Read more"
                    showLessText="Read less"
                    textClassName="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap"
                    buttonClassName="text-xs text-primary hover:text-primary/80"
                >
                    {descDraft}
                </ExpandableText>
            </div>
        );
    };

    const renderInstructions = () => {
        if (isDeleting || !skill) {
            return (
                <div className="flex h-full w-full items-center justify-center text-text-secondary">
                    <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
                </div>
            );
        }

        return <SkillInstructions skill={skill} readOnly={!isOwner} />;
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center text-text-secondary">
                <Loader2Icon className="mr-2 h-6 w-6 animate-spin" />
                <span className="text-sm font-medium">Loading skill...</span>
            </div>
        );
    }

    if (isError || !skill) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-text-secondary">
                <p className="text-sm">Failed to load skill details.</p>
                <Button variant="outline" size="sm" onClick={handleBack}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="skill-edit-pane flex h-full min-h-0 w-full flex-col gap-4 bg-background">
            <header className="skill-edit-pane-header flex shrink-0 flex-col items-start gap-3">
                <div className="skill-edit-pane-header-name-input flex w-full min-w-0 items-center gap-1.5">
                    {showTitleBackButton && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleBack}
                            className="hover:text-text-primary h-6 w-6 shrink-0 rounded-md text-text-secondary"
                            aria-label="Back to skills"
                        >
                            <ChevronLeft className="size-5" />
                        </Button>
                    )}
                    {isOwner ? (
                        <input
                            type="text"
                            value={nameDraft}
                            aria-label="Skill name"
                            placeholder="Skill name"
                            autoFocus={autoFocusName}
                            disabled={updateSkillMutation.isPending}
                            className={cn(
                                inlineFieldCls,
                                'text-text-primary h-6 min-w-0 flex-1 pb-0 text-lg font-semibold tracking-tight',
                            )}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={handleNameKeyDown}
                        />
                    ) : (
                        <h1 className="text-text-primary h-6 min-w-0 flex-1 truncate text-lg leading-6 font-semibold tracking-tight">
                            {nameDraft}
                        </h1>
                    )}
                    <span
                        className={cn(
                            'flex w-14 shrink-0 items-center justify-end gap-1 text-[11px] text-muted-foreground',
                            'transition-opacity duration-150',
                            updateSkillMutation.isPending ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-live="polite"
                        aria-hidden={!updateSkillMutation.isPending}
                    >
                        <Loader2Icon className="size-3 animate-spin" />
                        Saving
                    </span>
                    <DropdownMenuRoot modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Skill actions"
                                className="hover:text-text-primary h-6 w-6 shrink-0 rounded-md text-text-secondary"
                            >
                                <MoreVertical className="size-3.5" />
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
                </div>
                <div className="skill-edit-pane-header-description flex w-full min-w-0 flex-1 flex-col">
                    {renderDescription()}
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-clip rounded-xl border border-border bg-card shadow-sm [&_.file-editor]:p-0">
                {renderInstructions()}
            </div>

            <AlertDialog
                open={showDeleteConfirm}
                onOpenChange={(next) => {
                    if (!next && !deleteSkillMutation.isPending) setShowDeleteConfirm(false);
                }}
            >
                <AlertDialogContent
                    size="sm"
                    className="data-[size=sm]:max-w-lg"
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
                                    <span className="font-medium text-foreground" title={skill.name}>
                                        &ldquo;
                                        {skill.name}
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

export default SkillEdit;

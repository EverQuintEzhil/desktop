import { ChevronLeftIcon, Loader2Icon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import ExpandableText from '@/components/expandable-text';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import {
    useSkillByIdQuery,
    useSkillFilesQuery,
    useDeleteSkillMutation,
    useDownloadSkillAsZipMutation,
    useReplaceSkillFromZipMutation,
    useCloneSkillMutation,
} from '@/lib/api/common/skills';
import { filesApi } from '@/lib/api/files-client';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import { acceptValidFilesFromInput, showErrorToast, showSuccessToast } from '@/utils';

import SkillEdit from '../skill-edit';
import { DEFAULT_SKILL_FILE } from '../skill-tree';

import SkillDetailHeader from './components/skill-detail-header';
import SkillEmptyState from './components/skill-empty-state';
import SkillFileExplorerPopover from './components/skill-file-explorer-popover';
import SkillFileViewer from './components/skill-file-viewer';
import SkillNotFoundState from './components/skill-not-found-state';
import SkillReplacingOverlay from './components/skill-replacing-overlay';
import { useSkillFileContent } from './hooks/use-skill-file-content';
import { useSkillPreferenceToggle } from './hooks/use-skill-preference-toggle';
import { formatShortDate } from './utils/format-short-date';
import { getErrorToastMessage } from './utils/get-error-toast-message';

interface SkillEditorPaneProps {
    skillId?: string;
    selectedFile: string | null;
    onSelectFile: (path: string) => void;
    onBack?: () => void;
    className?: string;
    isAdmin?: boolean;
}

const SkillEditorPane = ({
    skillId,
    selectedFile,
    onSelectFile,
    onBack,
    className,
    isAdmin = false,
}: SkillEditorPaneProps) => {
    const { data: skill, isLoading: isSkillLoading } = useSkillByIdQuery(skillId);
    const { isFetching: isFetchingRoot, data: rootFiles } = useSkillFilesQuery(skillId, '');
    const deleteSkillMutation = useDeleteSkillMutation();
    const downloadSkillMutation = useDownloadSkillAsZipMutation();
    const replaceSkillMutation = useReplaceSkillFromZipMutation();
    const cloneSkillMutation = useCloneSkillMutation();
    const navigate = useNavigate();
    const currentUser = useSelector(selectUser);
    const replaceFileInputRef = useRef<HTMLInputElement>(null);

    const useSkillMutation = useSkillPreferenceToggle(skillId);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isReplacingSkill, setIsReplacingSkill] = useState(false);
    const [isExplorerOpen, setIsExplorerOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const { fileContent, isLoadingFile, mdViewMode, setMdViewMode, reloadCurrentFile } = useSkillFileContent(
        skillId,
        selectedFile,
    );

    useEffect(() => {
        setIsEditMode(false);
    }, [skillId]);

    useEffect(() => {
        if (!skillId || selectedFile) return;

        const rootPath = `skills/${skillId}/`;
        const hasDefaultFile = rootFiles?.some((f) => {
            const path = (f.path.startsWith(rootPath) ? f.path.substring(rootPath.length) : f.path).replace(/\/$/, '');
            const metadata = f.metadata as { isFolder?: boolean } | undefined;

            return path === DEFAULT_SKILL_FILE && f.kind !== 'folder' && !f.isFolder && !metadata?.isFolder;
        });

        if (hasDefaultFile) {
            onSelectFile(DEFAULT_SKILL_FILE);
        }
    }, [skillId, selectedFile, rootFiles, onSelectFile]);

    const handleReplaceUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const [file] = acceptValidFilesFromInput(event);

        if (!file || !skillId) return;

        try {
            setIsReplacingSkill(true);

            const formData = new FormData();

            formData.append('file', file);
            formData.append('origin.type', 'skill');
            formData.append('origin.skill_id', skillId);

            const uploadResponse = await filesApi.upload(formData);
            const fileId = uploadResponse.data?.value?.values?.[0]?._id;

            if (!fileId) {
                throw new Error('Failed to get file ID from upload response');
            }

            await replaceSkillMutation.mutateAsync({ id: skillId, fileId });
            showSuccessToast('Skill replaced successfully.');
            await reloadCurrentFile();
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, 'Failed to replace skill from zip.'));
        } finally {
            setIsReplacingSkill(false);
            if (replaceFileInputRef.current) {
                replaceFileInputRef.current.value = '';
            }
        }
    };

    const handleReplace = () => {
        if (!skillId || isReplacingSkill) return;

        replaceFileInputRef.current?.click();
    };

    const handleEditSkill = () => {
        setIsEditMode(true);
    };

    const closeEditMode = useCallback(() => {
        setIsEditMode(false);
        void reloadCurrentFile();
    }, [reloadCurrentFile]);

    if (!skillId) {
        return <SkillEmptyState className={className} />;
    }

    if (isSkillLoading) {
        return (
            <div className={cn('flex items-center justify-center rounded-xl', className)}>
                <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!skill) {
        return <SkillNotFoundState className={className} />;
    }

    const isOwner = skill.creator?._id === currentUser._id;
    const updatedAtLabel = formatShortDate(skill.updatedAt);
    // Mirror the backend's global-enabled default: an explicit preference row wins,
    // otherwise a skill you own is in use by default while enterprise skills are opt-in.
    const isInUse = skill.preference ? skill.preference.disabled === false : isOwner;

    const isAwaitingDefaultFile =
        !selectedFile &&
        Boolean(
            rootFiles?.some((f) => {
                const rootPath = `skills/${skillId}/`;
                const path = (f.path.startsWith(rootPath) ? f.path.substring(rootPath.length) : f.path).replace(
                    /\/$/,
                    '',
                );
                const metadata = f.metadata as { isFolder?: boolean } | undefined;

                return path === DEFAULT_SKILL_FILE && f.kind !== 'folder' && !f.isFolder && !metadata?.isFolder;
            }),
        );

    const handleDownload = async () => {
        if (!skillId || !skill) return;
        try {
            const blob = await downloadSkillMutation.mutateAsync(skillId);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = `${skill.name}.zip`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, 'Failed to download skill zip.'));
        }
    };

    const handleDelete = async () => {
        if (!skillId) return;
        try {
            await deleteSkillMutation.mutateAsync(skillId);
            setIsDeleteDialogOpen(false);
            if (onBack) onBack();
            navigate('/settings/skills');
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, 'Failed to delete skill.'));
        }
    };

    const handleSaveAsPersonal = () => {
        if (!skillId || cloneSkillMutation.isPending) return;

        cloneSkillMutation.mutate(skillId, {
            onSuccess: (newSkill) => {
                showSuccessToast('Saved as a personal skill.');
                navigate(`/settings/skills/${newSkill._id}`);
            },
            onError: () => showErrorToast("Couldn't save as personal. Please try again."),
        });
    };

    if (isEditMode) {
        return (
            <div className={cn('skill-editor-pane relative h-full', className)}>
                <div className="skill-editor-pane-content mx-auto flex h-full max-w-4xl flex-col gap-4">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2 w-fit shrink-0"
                        onClick={closeEditMode}
                    >
                        <ChevronLeftIcon className="size-4" />
                        Done editing
                    </Button>
                    <div className="min-h-0 flex-1">
                        <SkillEdit skillId={skillId} onBack={closeEditMode} showTitleBackButton={false} autoFocusName />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('skill-editor-pane relative h-full', className)}>
            <div className="skill-editor-pane-content mx-auto flex h-full max-w-4xl flex-col gap-4">
                {onBack && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2 w-fit lg:hidden"
                        onClick={onBack}
                        disabled={isReplacingSkill}
                    >
                        <ChevronLeftIcon className="size-4" />
                        Skills
                    </Button>
                )}
                <SkillDetailHeader
                    skill={skill}
                    isOwner={isOwner}
                    isAdmin={isAdmin}
                    isInUse={isInUse}
                    updatedAtLabel={updatedAtLabel}
                    isReplacingSkill={isReplacingSkill}
                    useSkillMutationPending={useSkillMutation.isPending}
                    onToggleInUse={(disabled) => useSkillMutation.mutate({ disabled })}
                    cloneSkillMutationPending={cloneSkillMutation.isPending}
                    onSaveAsPersonal={handleSaveAsPersonal}
                    onDownload={() => void handleDownload()}
                    onReplace={handleReplace}
                    onEditSkill={handleEditSkill}
                    onDeleteRequest={() => setIsDeleteDialogOpen(true)}
                />

                {/* Metadata row */}
                {skill.description ? (
                    <div className="skill-editor-pane-content-metadata flex min-w-0 flex-col gap-2">
                        <span className="text-sm font-semibold text-foreground">Description</span>
                        <div className="rounded-xl border bg-card px-5 py-4">
                            <ExpandableText
                                maxLines={2}
                                showMoreText="Read more"
                                showLessText="Read less"
                                textClassName="text-sm leading-relaxed text-foreground"
                                buttonClassName="text-sm text-primary hover:text-primary/80 font-medium"
                            >
                                {skill.description}
                            </ExpandableText>
                        </div>
                    </div>
                ) : null}

                {/* File viewer */}
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    <SkillFileExplorerPopover
                        skillId={skillId}
                        selectedFile={selectedFile}
                        onSelectFile={onSelectFile}
                        isExplorerOpen={isExplorerOpen}
                        onExplorerOpenChange={setIsExplorerOpen}
                        mdViewMode={mdViewMode}
                        onMdViewModeChange={setMdViewMode}
                    />
                    <div className="skill-editor-pane-content-editor relative min-h-[60svh] flex-1 overflow-hidden rounded-xl lg:min-h-0">
                        <SkillFileViewer
                            selectedFile={selectedFile}
                            fileContent={fileContent}
                            mdViewMode={mdViewMode}
                            isLoadingFile={isLoadingFile}
                            isFetchingRoot={isFetchingRoot}
                            isAwaitingDefaultFile={isAwaitingDefaultFile}
                        />
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={() => void handleDelete()}
                title="Delete Skill"
                message="Are you sure you want to delete this skill? This action cannot be undone."
                confirmButtonText="Delete"
                cancelButtonText="Cancel"
                isButtonLoading={deleteSkillMutation.isPending}
            />
            <input
                type="file"
                accept=".zip"
                ref={replaceFileInputRef}
                className="hidden"
                onChange={(e) => void handleReplaceUploadChange(e)}
            />
            <SkillReplacingOverlay isReplacing={isReplacingSkill} />
        </div>
    );
};

export default SkillEditorPane;

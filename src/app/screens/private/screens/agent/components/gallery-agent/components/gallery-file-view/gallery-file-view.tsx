import { AxiosError } from 'axios';
import { ChevronLeftIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAgentLauncherSidesheet } from '@/app/hooks';
import { Button } from '@/components/ui/button';
import { useUploadFilesContext } from '@/context';
import { appMediaApi } from '@/lib/api/app/media';
import type { GalleryAgentType, FileType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';
import { makeSafeDownloadFilename } from '@/utils';

import { useGalleryPromptOptions } from '../../hooks';
import {
    getImageUploadLimitMessage,
    getModelMaxImageUploads,
    isWithinImageUploadLimit,
    limitUploadedImages,
} from '../../utils/model-image-upload-limit';
import { showJobStatusToast, showJobErrorToast } from '../../utils/show-job-status-toast';
import { canUserChangeVisibility } from '../../utils/visibility';
import { LightboxMediaFileId } from '../lightbox-media';

interface Props {
    agent: GalleryAgentType;
    isVideo?: boolean;
}

const GalleryFileView = (props: Props) => {
    const { agent, isVideo = false } = props;
    const { fileId } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const { state: fileState, actions } = useUploadFilesContext();

    const {
        query,
        setQuery,
        textAreaRef,
        renderFiles,
        onChangeFile,
        plusDropdownOptions,
        getAddPhotoOption,
        handlePlusDropdownSelect,
        renderSelectedParameters,
        selectedModel,
        availableModels,
        setSelectedModel,
        isPublic,
        setIsPublic,
        showPublicPrivateToggle,
        parameters,
    } = useGalleryPromptOptions({ agent });

    const lightboxPlusDropdownOptions = [getAddPhotoOption(fileInputRef), ...plusDropdownOptions];
    const canChangeVisibility = canUserChangeVisibility(agent, 'my');

    const { launcherName, renderAgentDetailsSidesheet, renderInfoIcon } = useAgentLauncherSidesheet(agent);

    if (!fileId) return null;

    const handleClose = () => {
        navigate(`/agent/${agent.slug}`);
    };

    const onGenerate = async (promptArg: string, files: FileType[], maskUrl?: string, annotated?: boolean) => {
        const trimmedPrompt = promptArg.trim();

        if (!trimmedPrompt) return;

        const modelId = selectedModel?.value?.modelId;
        const maxImageUploads = getModelMaxImageUploads(selectedModel?.value);

        if (!isWithinImageUploadLimit(files, maxImageUploads)) {
            actions.setFiles(limitUploadedImages(files, maxImageUploads));
            showJobErrorToast(getImageUploadLimitMessage(maxImageUploads));

            return;
        }

        setIsGenerating(true);

        const parametersObject = Object.entries(parameters).reduce(
            (acc: Record<string, string | number | boolean>, [key, value]) => {
                if (typeof value === 'number' || typeof value === 'boolean') {
                    acc[key] = value;
                } else {
                    acc[key] = (value as { value: string }).value || '';
                }

                return acc;
            },
            {},
        );

        try {
            await appMediaApi.generateImage(
                {
                    agentIdOrIdentifier: agent._id,
                    modelId,
                    fileIds: files.length ? files.map((file) => file._id) : undefined,
                    arguments: {
                        prompt: trimmedPrompt,
                        ...parametersObject,
                        mask: selectedModel?.value?.options?.mask ? maskUrl : undefined,
                        annotated: annotated || undefined,
                    },
                    options: {
                        public: isPublic,
                        queue: true,
                    },
                },
                { headers: { 'Content-Type': 'application/json' } },
            );
            showJobStatusToast('Added to queue');
            setQuery('');
            textAreaRef.current?.changeText('');
            actions.setFiles([]);
            handleClose();
        } catch (err: unknown) {
            if (err instanceof AxiosError) {
                showJobErrorToast(err.response?.data?.message || 'Failed to generate content');
            } else {
                showJobErrorToast('Failed to generate content');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const onRemix = async (newPrompt: string, item: GeneratedItem, maskUrl?: string, editedFile?: FileType) => {
        if (!newPrompt.trim()) return;

        const fileToUse: FileType = editedFile ?? {
            name: item.title || 'generated-image',
            type: 'image',
            url: item.url,
            _id: item._id,
            tempId: `temp-${Date.now()}`,
            size: undefined,
            isUploading: false,
        };

        actions.setFiles([fileToUse]);
        setQuery(newPrompt);
        textAreaRef.current?.changeText(newPrompt);
        onGenerate(newPrompt, [fileToUse], maskUrl, Boolean(editedFile));
    };

    const headerLeft = () => (
        <div className="title-and-info flex items-center gap-2">
            <Button
                className="back-button"
                variant="ghost"
                size="icon-xs"
                onClick={() => navigate(`/agent/${agent.slug}`)}
            >
                <ChevronLeftIcon />
            </Button>
            <h2 className="font-semibold text-(--white)">{launcherName}</h2>
            {renderInfoIcon('ml-2')}
        </div>
    );

    return (
        <div className="gallery-file-view h-full w-full">
            <LightboxMediaFileId
                fileId={fileId}
                isVideo={isVideo}
                isOpen
                onClose={handleClose}
                downloadName={makeSafeDownloadFilename(null, { agentName: agent.name })}
                agent={agent}
                onRemix={isVideo ? undefined : onRemix}
                onEditPromptSubmit={(promptArg: string) => onGenerate(promptArg, fileState.files)}
                query={query}
                setQuery={setQuery}
                plusOptions={{
                    plusDropdownOptions: lightboxPlusDropdownOptions,
                    handlePlusDropdownSelect,
                    renderSelectedParameters,
                    selectedModel,
                    availableModels,
                    setSelectedModel,
                    isPublic,
                    setIsPublic,
                    showPublicPrivateToggle,
                    canChangeVisibility,
                    isNextLine: true,
                }}
                fileInputRef={fileInputRef}
                onChangeFile={onChangeFile}
                renderFiles={() => renderFiles(isGenerating)}
                fileInputDisabled={isGenerating || fileState.isUploading}
                escapeClosesLightbox={false}
                showCloseButton={false}
                renderHeaderLeft={headerLeft}
            />
            {renderAgentDetailsSidesheet()}
        </div>
    );
};

export default GalleryFileView;

import { AxiosError } from 'axios';
import { ChevronLeftIcon, UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAgentLauncherSidesheet, useAppSelector, useToastOffsetFromRef } from '@/app/hooks';
import SearchInput from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { useUploadFilesContext } from '@/context';
import { appMediaApi } from '@/lib/api/app/media';
import { selectUser } from '@/store/selectors';
import type { GalleryAgentType, FileType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';
import { showErrorToast } from '@/utils';

import { useGalleryPromptOptions } from '../../hooks';
import { useGalleryMediaState } from '../../hooks/use-gallery-media-state';
import {
    getImageUploadLimitMessage,
    getModelMaxImageUploads,
    isWithinImageUploadLimit,
    limitUploadedImages,
} from '../../utils/model-image-upload-limit';
import { showJobErrorToast, showJobStatusToast } from '../../utils/show-job-status-toast';
import { canUserChangeVisibility } from '../../utils/visibility';
import MasonryView from '../masonry-view';
import { PromptInputBox } from '../prompt-input-box';

interface Props {
    agent: GalleryAgentType;
    isVideo?: boolean;
}

const UserGalleryView = (props: Props) => {
    const { agent, isVideo = false } = props;
    const { userId: profileUserId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const galleryTitleRef = useRef<HTMLDivElement>(null);
    const masonryFileInputRef = useRef<HTMLInputElement>(null);
    const lightboxFileInputRef = useRef<HTMLInputElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [profileUserNamesById, setProfileUserNamesById] = useState<Record<string, string>>({});

    useToastOffsetFromRef(galleryTitleRef);

    const user = useAppSelector(selectUser);
    const currentUserId = user._id ?? '';
    const currentUserName = `${user.name.first} ${user.name.last}`;
    const { state: fileState, actions } = useUploadFilesContext();

    const {
        state,
        retryFetch,
        searchQuery,
        setSearchQuery,
        activeTab,
        loadMore,
        removeItem,
        onDeleteItemClicked,
        onItemChange,
        onLikeItemClicked,
        renderConfirmationModal,
        renderLightbox,
        renderLightboxFileId,
    } = useGalleryMediaState({
        agentId: agent._id,
        agentSlug: agent.slug,
        userId: currentUserId,
        userName: currentUserName,
        placeholderExtension: isVideo ? 'mp4' : 'png',
        isVideo,
        creatorId: profileUserId,
        fixedTab: 'firmwide',
    });

    const {
        query: prompt,
        setQuery: setPrompt,
        textAreaRef,
        fileInputRef,
        renderFiles,
        onChangeFile,
        plusDropdownOptions,
        getAddPhotoOption,
        handlePlusDropdownSelect,
        parameters,
        renderSelectedParameters,
        selectedModel,
        availableModels,
        setSelectedModel,
        isPublic,
        setIsPublic,
        showPublicPrivateToggle,
    } = useGalleryPromptOptions({ agent });

    const { launcherName, renderAgentDetailsSidesheet, renderInfoIcon } = useAgentLauncherSidesheet(agent);

    const profileUserName = profileUserId ? profileUserNamesById[profileUserId] || '' : '';

    useEffect(() => {
        if (!profileUserId || profileUserNamesById[profileUserId]) return;
        const creatorName = state.history.find((item) => item.creator_id === profileUserId)?.creator_name;

        if (creatorName) {
            setProfileUserNamesById((prevNames) => ({
                ...prevNames,
                [profileUserId]: creatorName,
            }));
        }
    }, [profileUserId, profileUserNamesById, state.history]);

    const canChangeVisibility = canUserChangeVisibility(agent, activeTab);

    const promptBoxPlusDropdownOptions = [getAddPhotoOption(fileInputRef), ...plusDropdownOptions];
    const masonryPlusDropdownOptions = [getAddPhotoOption(masonryFileInputRef), ...plusDropdownOptions];
    const lightboxPlusDropdownOptions = [getAddPhotoOption(lightboxFileInputRef), ...plusDropdownOptions];

    const onDeleteItemAsyncClicked = async (item: GeneratedItem) => {
        try {
            await appMediaApi.deleteFile(item._id);

            return removeItem(item._id);
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const onEditItemClicked = (item: GeneratedItem) => {
        if (isVideo) {
            setPrompt(item.title);
            textAreaRef.current?.changeText(item.title);
            textAreaRef.current?.focus();

            requestAnimationFrame(() => {
                const element = document.getElementById('gallery-prompt-textarea');

                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });

            return;
        }

        const newFile: FileType = {
            name: item.title || 'generated-image',
            type: 'image',
            url: item.url,
            _id: item._id,
            tempId: `temp-${Date.now()}`,
            size: undefined,
            isUploading: false,
        };

        actions.setFiles([newFile]);
    };

    const onGenerate = async (promptArg: string, files: FileType[], maskUrl?: string, annotated?: boolean) => {
        const trimmedPrompt = promptArg.trim();

        if (!trimmedPrompt) return;

        const modelId = selectedModel?.value?.modelId;

        if (maskUrl && !isVideo && !selectedModel?.value?.options?.mask) {
            showErrorToast('Mask is not supported for this model');
            setPrompt('');
            textAreaRef.current?.changeText('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            actions.setFiles([]);

            return;
        }

        const maxImageUploads = getModelMaxImageUploads(selectedModel?.value);

        if (!isWithinImageUploadLimit(files, maxImageUploads)) {
            actions.setFiles(limitUploadedImages(files, maxImageUploads));
            showErrorToast(getImageUploadLimitMessage(maxImageUploads));

            return;
        }

        setIsGenerating(true);

        try {
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

            const payload = {
                agentIdOrIdentifier: agent._id,
                modelId,
                fileIds: files.length ? files.map((file) => file._id) : undefined,
                arguments: {
                    prompt: trimmedPrompt,
                    ...parametersObject,
                    ...(isVideo
                        ? {}
                        : {
                              mask: selectedModel?.value?.options?.mask ? maskUrl : undefined,
                              annotated: annotated || undefined,
                          }),
                },
                options: isVideo
                    ? {
                          public: isPublic,
                          queue: true,
                          pollInterval: 10000,
                          maxWaitTime: 900000,
                      }
                    : {
                          public: isPublic,
                          queue: true,
                      },
            };

            if (isVideo) {
                await appMediaApi.generateVideo(payload, { headers: { 'Content-Type': 'application/json' } });
            } else {
                await appMediaApi.generateImage(payload, { headers: { 'Content-Type': 'application/json' } });
            }

            showJobStatusToast('Added to queue');
            setPrompt('');
            textAreaRef.current?.changeText('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            actions.setFiles([]);
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
        if (isVideo || !newPrompt.trim()) return;

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
        setPrompt(newPrompt);
        textAreaRef.current?.changeText(newPrompt);
        await onGenerate(newPrompt, [fileToUse], maskUrl, Boolean(editedFile));
    };

    const lightboxViewProps = {
        agent,
        query: prompt,
        setQuery: setPrompt,
        plusOptions: {
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
        },
        isVideo,
        downloadNamePrefix: isVideo ? 'video' : 'image',
        onRemix: isVideo ? undefined : onRemix,
        onEditPromptSubmit: (promptArg: string) => onGenerate(promptArg, fileState.files),
        onDeleteItemAsyncClicked,
        fileInputRef: lightboxFileInputRef,
        onChangeFile,
        renderFiles: () => renderFiles(isGenerating),
        fileInputDisabled: isGenerating || fileState.isUploading,
    };

    if (!profileUserId) return null;

    return (
        <div className="gallery-agent relative mx-auto min-h-svh w-full flex-col bg-background">
            <div
                ref={galleryTitleRef}
                className="gallery-title mx-auto flex w-full flex-col items-center justify-between gap-x-4 px-4 pb-4 lg:flex-row lg:pb-0"
            >
                <div className="title-and-info flex shrink-0 items-center gap-0.5 pt-4 pb-4 max-lg:w-full max-lg:pb-3">
                    <Button
                        className="back-button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/agent/${agent.slug}`)}
                    >
                        <ChevronLeftIcon className="size-6" />
                    </Button>
                    <h2 className="mx-auto text-xl font-semibold max-lg:mx-0">{launcherName}</h2>
                    {renderInfoIcon('ml-2')}
                </div>
                <div className="search-and-filters flex w-full flex-col-reverse items-center justify-end gap-2 sm:flex-row">
                    <SearchInput
                        search={searchQuery}
                        onChange={(val) => setSearchQuery(val)}
                        searchOnChange
                        debounceWait={400}
                        autoFocus={false}
                        placeholder={`Search ${profileUserName || 'user'} media`}
                        className="w-full max-w-[420px]"
                        inputClassName="rounded-3xl border-0 shadow-sm h-[38px]"
                    />
                    {profileUserName ? (
                        <div className="flex items-center gap-2">
                            <UserIcon className="size-4" />
                            <span className="text-sm font-medium">{profileUserName}</span>
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="user-gallery-view-chat-group chat-group flex flex-1 flex-col gap-6 px-4 pt-1">
                <MasonryView
                    className="pb-4"
                    agent={agent}
                    state={state}
                    isFetching={state.showMoreLoading}
                    onShowMore={loadMore}
                    onRetry={retryFetch}
                    isVideo={isVideo}
                    currentTab={activeTab}
                    onRemix={isVideo ? undefined : onRemix}
                    onEditPromptSubmit={(promptArg: string) => onGenerate(promptArg, fileState.files)}
                    onEditItemClicked={onEditItemClicked}
                    onDeleteItemClicked={onDeleteItemClicked}
                    onLikeItemClicked={onLikeItemClicked}
                    onItemChange={onItemChange}
                    query={prompt}
                    setQuery={setPrompt}
                    onDeleteItemAsyncClicked={onDeleteItemAsyncClicked}
                    plusOptions={{
                        plusDropdownOptions: masonryPlusDropdownOptions,
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
                    fileInputRef={masonryFileInputRef}
                    onChangeFile={onChangeFile}
                    renderFiles={() => renderFiles(isGenerating)}
                    fileInputDisabled={isGenerating || fileState.isUploading}
                />
                <div className="chat-wrapper muse-chat mx-auto mt-auto flex w-full max-w-[778px] flex-col gap-2 max-lg:sticky max-lg:bottom-4 max-lg:z-2">
                    <PromptInputBox
                        agent={agent}
                        query={prompt}
                        setQuery={setPrompt}
                        onSubmit={() => {
                            onGenerate(prompt, fileState.files);
                        }}
                        textAreaRef={textAreaRef}
                        isLoading={isGenerating || fileState.isUploading}
                        fileInputRef={fileInputRef}
                        onChangeFile={onChangeFile}
                        accept="image/jpg,image/jpeg,image/png,image/gif"
                        fileInputDisabled={isGenerating || fileState.isUploading}
                        renderFiles={() => renderFiles(isGenerating)}
                        plusOptions={{
                            plusDropdownOptions: promptBoxPlusDropdownOptions,
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
                    />
                </div>
            </div>
            {renderLightbox(lightboxViewProps)}
            {renderLightboxFileId(lightboxViewProps)}
            {renderConfirmationModal(`Are you sure you want to delete this generated ${isVideo ? 'video' : 'image'}?`)}
            {renderAgentDetailsSidesheet()}
        </div>
    );
};

export default UserGalleryView;

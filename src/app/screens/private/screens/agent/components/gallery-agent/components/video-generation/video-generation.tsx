import { AxiosError } from 'axios';
import { ChevronLeftIcon, GlobeIcon, HeartIcon, ShieldIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAgentLauncherSidesheet, useAppSelector, useToastOffsetFromRef } from '@/app/hooks';
import { AvatarMenu } from '@/components';
import SearchInput from '@/components/search-input';
import { Button } from '@/components/ui/button';
import Switch from '@/components/ui/switch';
import { useUploadFilesContext } from '@/context';
import { appMediaApi } from '@/lib/api/app/media';
import { getFilesDownloadUrl } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import type { GalleryAgentType, FileType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';

import { useGalleryPromptOptions } from '../../hooks';
import { useGalleryMediaState } from '../../hooks/use-gallery-media-state';
import { generateGalleryMedia } from '../../utils/generate-gallery-media';
import {
    getImageUploadLimitMessage,
    getModelMaxImageUploads,
    isWithinImageUploadLimit,
    limitUploadedImages,
} from '../../utils/model-image-upload-limit';
import { showJobStatusToast, showJobErrorToast } from '../../utils/show-job-status-toast';
import { canUserChangeVisibility } from '../../utils/visibility';
import MasonryView from '../masonry-view';
import { Notifications } from '../notifications';
import { PromptInputBox } from '../prompt-input-box';

import { FrameImagesInput, useFrameImages } from './frame-images-input';

// Temporarily disabled until the first/last frame backend is finalized. Flip to
// true to re-enable the frame-images UI and payload wiring.
const FRAME_IMAGES_ENABLED = false;

const defaultPromptPlaceholders = [
    'What are we creating today?',
    'How can I help?',
    'Describe your next masterpiece.',
    'Sketch it with words.',
    "What's on your drawing board?",
    'Design begins here.',
    'Need a concept visualized?',
    'Rethinking the skyline?',
    'What does your vision look like?',
    "Let's shape some space.",
    "What's your next architectural idea?",
    'High-rise or hillside?',
    'Tell me what to draw.',
    'Is it modern, brutalist, or baroque?',
    'What does the future of design look like?',
    'Form follows function — or vice versa?',
    'A new home or a new horizon?',
    'Think it. Type it. See it.',
    'Raw sketch or refined vision?',
    'What\u2019s your client dreaming of?',
    'Need a section view or a skyline?',
    'Show me your next pavilion idea.',
    'Minimalist or maximalist?',
    'What if your favorite architect had your idea?',
    'Let\u2019s render your imagination.',
    'What kind of space are we shaping?',
    "What's your dream project?",
    'Time to explore spatial poetry.',
    'From napkin sketch to visualization — go.',
    'What mood are you building?',
    "Let's go from volume to vibe.",
    'Design a place, not just a space.',
    'Is it for people or ideas?',
    'Starting with light, material, or movement?',
    "What's your concept in a sentence?",
    "What's your site like?",
    'Floating stairs or buried walls?',
    "Give me the vibe, I'll give you the view.",
    'Think diagram, not detail.',
    "Give me three words and I'll draw.",
    'Glass, steel, wood... or clay?',
    'Historic, futuristic, or just bold?',
    'Designing for silence or spectacle?',
    'What\u2019s the context — city, sea, or forest?',
    'Need a plan, section, or pure imagination?',
    'How abstract should we go?',
    'Let\u2019s draft a dream.',
    'Give me your boldest vision.',
];

function getPromptPlaceholder(placeholders?: string[]): string {
    const list = placeholders?.length ? placeholders : defaultPromptPlaceholders;
    const randomIndex = Math.floor(Math.random() * list.length);

    return list[randomIndex];
}

interface Props {
    agent: GalleryAgentType;
    isFromAdmin?: boolean;
}

const VideoGeneration = (props: Props) => {
    const { agent, isFromAdmin } = props;
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isGenerating, setIsGenerating] = useState(false);
    const [promptPlaceholder] = useState(() => getPromptPlaceholder(agent.uiConfig.promptPlaceholders));
    const galleryTitleRef = useRef<HTMLDivElement>(null);
    const masonryFileInputRef = useRef<HTMLInputElement>(null);
    const lightboxFileInputRef = useRef<HTMLInputElement>(null);
    const { state: fileState, actions } = useUploadFilesContext();

    useToastOffsetFromRef(galleryTitleRef);

    useEffect(() => {
        const fileId = searchParams.get('fileId');

        if (!fileId) return;

        const downloadUrl = getFilesDownloadUrl(fileId);

        const addFileToContext = (newFile: FileType) => {
            actions.setFiles([...fileState.files, newFile]);
            searchParams.delete('fileId');
            setSearchParams(searchParams, { replace: true });
        };

        appMediaApi
            .getFile<{ ai?: { prompt?: string }; title?: string; url?: string }>(fileId)
            .then((value) => {
                const name = value?.ai?.prompt || value?.title || 'video';
                const url = value?.url || downloadUrl;
                const newFile: FileType = {
                    name: typeof name === 'string' ? name : 'video',
                    type: 'image',
                    url,
                    _id: fileId,
                    tempId: `temp-${Date.now()}`,
                    isUploading: false,
                };

                addFileToContext(newFile);
            })
            .catch(() => {
                const newFile: FileType = {
                    name: 'video',
                    type: 'video',
                    url: downloadUrl,
                    _id: fileId,
                    tempId: `temp-${Date.now()}`,
                    isUploading: false,
                };

                addFileToContext(newFile);
            });
    }, []);

    const user = useAppSelector(selectUser);
    const userId = user._id;

    const {
        state,
        retryFetch,
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        notificationsJobs,
        loadMore,
        removeItem,
        handleNotificationJobClick,
        onDeleteItemClicked,
        onItemChange,
        onLikeItemClicked,
        renderConfirmationModal,
        renderLightbox,
        renderLightboxFileId,
    } = useGalleryMediaState({
        agentId: agent._id,
        agentSlug: agent.slug,
        userId: userId ?? '',
        placeholderExtension: 'mp4',
        userName: user.name.first + ' ' + user.name.last,
        isVideo: true,
    });

    const { launcherName, renderAgentDetailsSidesheet, renderInfoIcon } = useAgentLauncherSidesheet(agent);

    const {
        query: prompt,
        setQuery: setPrompt,
        textAreaRef,
        plusDropdownOptions,
        getAddPhotoOption,
        handlePlusDropdownSelect,
        parameters,
        fileInputRef,
        setDefaultParameters,
        resetDefaultParameters,
        renderSelectedParameters,
        selectedModel,
        availableModels,
        setSelectedModel,
        isPublic,
        setIsPublic,
        showPublicPrivateToggle,
        renderFiles,
        onChangeFile,
    } = useGalleryPromptOptions({
        agent,
        initialIsPublic: agent.uiConfig?.defaultVisibilityByTab?.[activeTab] ?? activeTab === 'firmwide',
    });

    const frameImages = useFrameImages(agent);
    const hasFrameSelection = FRAME_IMAGES_ENABLED && Boolean(frameImages.first || frameImages.last);
    const hasGenericFiles = fileState.files.length > 0;

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

    const onEditVideoItemClicked = (item: GeneratedItem) => {
        setPrompt(item.title);
        textAreaRef.current?.changeText(item.title);
        textAreaRef.current?.focus();

        requestAnimationFrame(() => {
            const element = document.getElementById('gallery-prompt-textarea');

            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    };

    const onGenerate = async (promptArg: string, files: FileType[]) => {
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

        try {
            const parametersObject = Object.entries(parameters).reduce(
                (acc: Record<string, string | number | boolean>, [key, value]) => {
                    if (typeof value === 'number' || typeof value === 'boolean') {
                        acc[key] = value;
                    } else if (typeof value === 'string') {
                        if (value) acc[key] = value;
                    } else {
                        acc[key] = (value as { value: string }).value || '';
                    }

                    return acc;
                },
                {},
            );

            const frameFields = hasFrameSelection
                ? {
                      firstFrameFileId: frameImages.firstFrameId || undefined,
                      lastFrameFileId: frameImages.lastFrameId || undefined,
                  }
                : {};
            const uploadedFileIds = files.length ? files.map((file) => file._id) : undefined;

            await generateGalleryMedia({
                kind: 'video',
                data: {
                    agentIdOrIdentifier: agent._id,
                    modelId,
                    ...frameFields,
                    fileIds: hasFrameSelection ? undefined : uploadedFileIds,
                    arguments: {
                        prompt: trimmedPrompt,
                        options: Object.keys(parametersObject)?.length > 0 ? parametersObject : undefined,
                    },
                    options: {
                        public: isPublic,
                        queue: true,
                    },
                },
                config: { headers: { 'Content-Type': 'application/json' } },
            });
            showJobStatusToast('Added to queue');
            notificationsJobs.refresh();
            setPrompt('');
            textAreaRef.current?.changeText('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            actions.setFiles([]);
            frameImages.reset();
        } catch (err) {
            console.error('Error generating content:', err);
            if (err instanceof AxiosError) {
                showJobErrorToast(err.response?.data?.message || 'Failed to generate content');
            } else {
                showJobErrorToast('Failed to generate content');
            }
        } finally {
            setIsGenerating(false);
        }
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
            setDefaultParameters,
            resetDefaultParameters,
            isPublic,
            setIsPublic,
            showPublicPrivateToggle,
            canChangeVisibility,
            isNextLine: true,
        },
        isVideo: true,
        downloadNamePrefix: 'video',
        onEditPromptSubmit: (promptArg: string) => onGenerate(promptArg, fileState.files),
        onDeleteItemAsyncClicked,
        fileInputRef: lightboxFileInputRef,
        onChangeFile,
        renderFiles: () => renderFiles(isGenerating),
        fileInputDisabled: isGenerating || fileState.isUploading,
    };

    return (
        <div className="gallery-agent relative mx-auto min-h-svh w-full flex-col bg-background">
            <div
                ref={galleryTitleRef}
                className={cn(
                    'gallery-title mx-auto w-full gap-x-4 px-4 pb-4 lg:pb-0',
                    'flex flex-col items-center justify-between lg:flex-row',
                    'sticky top-0 z-2 bg-background',
                )}
            >
                <div className="title-and-info flex shrink-0 items-center gap-0.5 pt-4 pb-4 max-lg:w-full max-lg:pb-3">
                    {!isFromAdmin ? (
                        <Button className="back-button" variant="ghost" size="icon-sm" onClick={() => navigate('/')}>
                            <ChevronLeftIcon className="size-6" />
                        </Button>
                    ) : null}
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
                        placeholder="Search media library"
                        className="w-full max-w-full sm:max-w-[420px]"
                        inputClassName="rounded-3xl border-0 shadow-surface h-[38px]"
                    />
                    <div className="filters-and-avatar ml-auto flex flex-wrap items-center justify-end gap-2 sm:ml-0 sm:flex-nowrap">
                        <Switch
                            options={[
                                { label: 'My', icon: ShieldIcon },
                                { label: 'Fav', icon: HeartIcon },
                                { label: 'Firmwide', icon: GlobeIcon },
                            ]}
                            activeIndex={['my', 'fav', 'firmwide'].indexOf(activeTab)}
                            onChange={(_, index) => {
                                const tabs = ['my', 'fav', 'firmwide'] as const;
                                const nextTab = tabs[index];
                                const defaultVisibility = agent.uiConfig?.defaultVisibilityByTab?.[nextTab];

                                setActiveTab(nextTab);
                                setIsPublic(defaultVisibility ?? nextTab === 'firmwide');
                            }}
                            isLoading={state.loading}
                            color="primary"
                            width={116}
                        />
                        <Notifications
                            itemType="video"
                            {...notificationsJobs}
                            onJobClick={handleNotificationJobClick}
                            onCancelJob={(job) => notificationsJobs.cancelJob(job._id)}
                            onRequeue={async (job, prompt) => {
                                await notificationsJobs.requeueJobs([job._id], prompt);
                            }}
                        />
                        <AvatarMenu popupPosition="top-right-edge" />
                    </div>
                </div>
            </div>
            <div className="chat-group video-generation-chat-group flex min-h-[calc(100svh-72px)] flex-col gap-6 px-4 pt-1">
                <MasonryView
                    className="pb-4"
                    agent={agent}
                    state={state}
                    isFetching={state.showMoreLoading}
                    onShowMore={loadMore}
                    onRetry={retryFetch}
                    onEditItemClicked={onEditVideoItemClicked}
                    onDeleteItemClicked={onDeleteItemClicked}
                    onDeleteItemAsyncClicked={onDeleteItemAsyncClicked}
                    onItemChange={onItemChange}
                    onLikeItemClicked={onLikeItemClicked}
                    isVideo={true}
                    currentTab={activeTab}
                    onRemix={undefined}
                    onEditPromptSubmit={(promptArg: string) => onGenerate(promptArg, fileState.files)}
                    query={prompt}
                    setQuery={setPrompt}
                    plusOptions={{
                        plusDropdownOptions: masonryPlusDropdownOptions,
                        handlePlusDropdownSelect,
                        setDefaultParameters,
                        resetDefaultParameters,
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
                <div className="chat-wrapper muse-chat sticky bottom-4 z-2 mx-auto mt-auto flex w-full max-w-[778px] flex-col gap-2">
                    <PromptInputBox
                        agent={agent}
                        query={prompt}
                        setQuery={setPrompt}
                        onSubmit={() => {
                            onGenerate(prompt, fileState.files);
                        }}
                        textAreaRef={textAreaRef}
                        placeholder={promptPlaceholder}
                        isLoading={isGenerating}
                        fileInputRef={fileInputRef}
                        onChangeFile={onChangeFile}
                        accept="image/jpg,image/jpeg,image/png,image/gif"
                        fileInputDisabled={isGenerating || fileState.isUploading || frameImages.isUploading}
                        isUploading={fileState.isUploading}
                        renderFiles={() => (
                            <>
                                {FRAME_IMAGES_ENABLED && !hasGenericFiles ? (
                                    <FrameImagesInput
                                        first={frameImages.first}
                                        last={frameImages.last}
                                        disabled={isGenerating}
                                        onSelect={frameImages.selectFrame}
                                        onRemove={frameImages.removeFrame}
                                        onSwap={frameImages.swapFrames}
                                    />
                                ) : null}
                                {!hasFrameSelection ? renderFiles(isGenerating) : null}
                            </>
                        )}
                        plusOptions={{
                            plusDropdownOptions: hasFrameSelection ? plusDropdownOptions : promptBoxPlusDropdownOptions,
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
            {renderConfirmationModal('Are you sure you want to delete this generated video?')}
            {renderAgentDetailsSidesheet()}
        </div>
    );
};

export default VideoGeneration;

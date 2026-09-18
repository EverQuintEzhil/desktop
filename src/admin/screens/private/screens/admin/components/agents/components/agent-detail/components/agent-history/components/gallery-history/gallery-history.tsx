import axios from 'axios';
import { ImageOffIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import LightboxMedia from '@/app/screens/private/screens/agent/components/gallery-agent/components/lightbox-media';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import Spinner from '@/components/ui/spinner';
import { UploadFilesProvider } from '@/context/upload-files-context';
import { appMediaApi } from '@/lib/api/app/media';
import type { FileApiResponse, GalleryAiArguments, GeneratedItem } from '@/types/gallery';
import { formatDateTime } from '@/utils/date';

import './gallery-history.scss';

export interface StateType {
    loading: boolean;
    error: boolean;
    data: FileApiResponse | null;
}

const DEFAULT_STATE: StateType = {
    loading: true,
    error: false,
    data: null,
};

interface Props {
    isVideo?: boolean;
}

function formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface DetailRowProps {
    label: string;
    value: string | number | boolean | null | undefined;
    mono?: boolean;
}

const DetailRow = ({ label, value, mono }: DetailRowProps) => {
    if (value === null || value === undefined || value === '') return null;

    let displayValue: string;

    if (typeof value === 'boolean') {
        displayValue = value ? 'Yes' : 'No';
    } else {
        displayValue = String(value);
    }

    return (
        <div className="gallery-detail-row">
            <span className="gallery-detail-label">{label}</span>
            <span className={`gallery-detail-value${mono ? ' gallery-detail-mono' : ''}`}>{displayValue}</span>
        </div>
    );
};

const GalleryHistory = (props: Props) => {
    const { isVideo } = props;

    const params = useParams();
    const historyId = params['historyId'];

    const [state, setState] = useState<StateType>(DEFAULT_STATE);
    const [lightboxImage, setLightboxImage] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleImageLoadStart = () => {
        setState(DEFAULT_STATE);
        setImageLoading(true);
        setImageError(false);
    };

    const handleImageLoad = () => {
        setImageLoading(false);
        setImageError(false);
    };

    const handleImageError = () => {
        setImageLoading(false);
        setImageError(true);
    };

    const openLightbox = () => setLightboxImage(true);
    const closeLightbox = () => setLightboxImage(false);

    const fetchFile = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();

        abortControllerRef.current = controller;
        setState((prevState) => ({ ...prevState, loading: true, error: false }));

        try {
            const fileData = await appMediaApi.getFile<FileApiResponse>(historyId!, { signal: controller.signal });

            setState((prevState) => ({
                ...prevState,
                loading: false,
                error: false,
                data: fileData,
            }));
        } catch (error) {
            if (axios.isCancel(error)) return;
            setState((prevState) => ({ ...prevState, loading: false, error: true }));
        }
    };

    useEffect(() => {
        handleImageLoadStart();
        fetchFile();
    }, [historyId]);

    const renderFlowDetails = () => {
        if (state.loading) return 'Loading...';
        if (state.error) return 'Error';

        const d = state.data;

        if (!d) {
            return (
                <div className="p-4">
                    <span className="block text-center text-sm">No details available</span>
                </div>
            );
        }

        // Annotated so the `?? {}` fallback does not widen to `GalleryAiArguments | {}`, which has
        // no `prompt` on one arm. `Partial` keeps the index signature the rest spread relies on.
        const aiArgs: Partial<GalleryAiArguments> = d.ai?.arguments ?? {};
        const { prompt, options, ...otherArgs } = aiArgs;
        const hasOptions = options && typeof options === 'object' && Object.keys(options).length > 0;
        const hasOtherArgs = Object.keys(otherArgs).length > 0;

        return (
            <div className="gallery-details-panel scrollbar-controller scrollbar-vertical scrollbar-horizontal h-full">
                <Accordion
                    type="multiple"
                    defaultValue={['file', 'status', 'creator', 'ai', 'media', 'relations', 'urls']}
                >
                    <AccordionItem value="file" className="gallery-accordion-item">
                        <AccordionTrigger className="gallery-accordion-trigger">File</AccordionTrigger>
                        <AccordionContent className="gallery-accordion-content">
                            <DetailRow label="ID" value={d._id} mono />
                            <DetailRow label="Name" value={d.name} />
                            <DetailRow label="Extension" value={d.extension} />
                            <DetailRow label="Type" value={d.type} />
                            <DetailRow label="Title" value={d.title} />
                            {d.description && <DetailRow label="Description" value={d.description} />}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="status" className="gallery-accordion-item">
                        <AccordionTrigger className="gallery-accordion-trigger">Status</AccordionTrigger>
                        <AccordionContent className="gallery-accordion-content">
                            <DetailRow label="Public" value={d.is_public} />
                            <DetailRow label="Deleted" value={d.is_deleted} />
                            <DetailRow label="Incognito" value={d.is_incognito} />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="creator" className="gallery-accordion-item">
                        <AccordionTrigger className="gallery-accordion-trigger">Creator</AccordionTrigger>
                        <AccordionContent className="gallery-accordion-content">
                            <DetailRow label="Created by" value={d.creator_name} />
                            <DetailRow label="Creator ID" value={d.creator_id} mono />
                            <DetailRow label="Updated by" value={d.updated_by_name} />
                            <DetailRow label="Updater ID" value={d.updated_by_id} mono />
                            <DetailRow label="Created at" value={formatDateTime(d.created_at)} />
                            <DetailRow label="Updated at" value={formatDateTime(d.updated_at)} />
                        </AccordionContent>
                    </AccordionItem>

                    {d.ai && (
                        <AccordionItem value="ai" className="gallery-accordion-item">
                            <AccordionTrigger className="gallery-accordion-trigger">AI Generation</AccordionTrigger>
                            <AccordionContent className="gallery-accordion-content">
                                <DetailRow label="AI generated" value={d.ai.generated} />
                                <DetailRow label="Model" value={d.ai.model_name} />
                                <DetailRow label="Provider" value={d.ai.model_provider} />
                                <DetailRow label="Model ID" value={d.ai.model_id} mono />
                                {prompt && (
                                    <div className="gallery-detail-column">
                                        <span className="gallery-detail-label">Prompt</span>
                                        <p className="gallery-detail-prompt">{String(prompt)}</p>
                                    </div>
                                )}
                                {hasOptions && (
                                    <div className="gallery-detail-column">
                                        <span className="gallery-detail-label">Options</span>
                                        <pre className="gallery-code-block">{JSON.stringify(options, null, 2)}</pre>
                                    </div>
                                )}
                                {hasOtherArgs && (
                                    <div className="gallery-detail-column">
                                        <span className="gallery-detail-label">Arguments</span>
                                        <pre className="gallery-code-block">{JSON.stringify(otherArgs, null, 2)}</pre>
                                    </div>
                                )}
                                {d.ai.usage && (
                                    <div className="gallery-detail-column">
                                        <span className="gallery-detail-label">Token Usage</span>
                                        <div className="gallery-token-usage">
                                            {d.ai.usage?.input_tokens && (
                                                <div className="gallery-token-chip">
                                                    <span className="gallery-token-chip__count">
                                                        {d.ai.usage?.input_tokens?.toLocaleString()}
                                                    </span>
                                                    <span className="gallery-token-chip__label">input</span>
                                                </div>
                                            )}
                                            {d.ai.usage?.output_tokens && (
                                                <div className="gallery-token-chip">
                                                    <span className="gallery-token-chip__count">
                                                        {d.ai.usage?.output_tokens?.toLocaleString()}
                                                    </span>
                                                    <span className="gallery-token-chip__label">output</span>
                                                </div>
                                            )}
                                            {d.ai.usage?.total_tokens && (
                                                <div className="gallery-token-chip gallery-token-chip--total">
                                                    <span className="gallery-token-chip__count">
                                                        {d.ai.usage?.total_tokens?.toLocaleString()}
                                                    </span>
                                                    <span className="gallery-token-chip__label">total</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    )}

                    {d.meta && (
                        <AccordionItem value="media" className="gallery-accordion-item">
                            <AccordionTrigger className="gallery-accordion-trigger">Media</AccordionTrigger>
                            <AccordionContent className="gallery-accordion-content">
                                {d.meta.width && d.meta.height && (
                                    <DetailRow label="Dimensions" value={`${d.meta.width} × ${d.meta.height} px`} />
                                )}
                                {!!d.meta.size && <DetailRow label="File size" value={formatFileSize(d.meta.size)} />}
                                {!!d.meta.dpi && <DetailRow label="DPI" value={d.meta.dpi} />}
                                {!!d.meta.aspect_ratio && (
                                    <DetailRow label="Aspect ratio" value={d.meta.aspect_ratio} />
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    )}

                    <AccordionItem value="relations" className="gallery-accordion-item">
                        <AccordionTrigger className="gallery-accordion-trigger">Relations</AccordionTrigger>
                        <AccordionContent className="gallery-accordion-content">
                            <DetailRow label="Agent ID" value={d.agent_id} mono />
                            <DetailRow label="Conversation ID" value={d.conversation_id ?? '—'} mono />
                            {d.related_file_ids?.length > 0 && (
                                <div className="gallery-detail-column">
                                    <span className="gallery-detail-label">Related Files</span>
                                    <div className="flex flex-col gap-1">
                                        {d.related_file_ids.map((id) => (
                                            <span key={id} className="gallery-detail-mono gallery-chip">
                                                {id}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="urls" className="gallery-accordion-item">
                        <AccordionTrigger className="gallery-accordion-trigger">URLs &amp; Hash</AccordionTrigger>
                        <AccordionContent className="gallery-accordion-content">
                            <div className="gallery-detail-column">
                                <span className="gallery-detail-label">URL</span>
                                <a href={d.url} target="_blank" rel="noreferrer" className="gallery-detail-link">
                                    {d.url}
                                </a>
                            </div>
                            {d.thumbnail_url && (
                                <div className="gallery-detail-column">
                                    <span className="gallery-detail-label">Thumbnail</span>
                                    <a
                                        href={d.thumbnail_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="gallery-detail-link"
                                    >
                                        {d.thumbnail_url}
                                    </a>
                                </div>
                            )}
                            <DetailRow label="File hash" value={d.file_hash} mono />
                        </AccordionContent>
                    </AccordionItem>

                    {d.file_content_text && (
                        <AccordionItem value="content" className="gallery-accordion-item">
                            <AccordionTrigger className="gallery-accordion-trigger">Content Text</AccordionTrigger>
                            <AccordionContent className="gallery-accordion-content">
                                <pre className="gallery-code-block">{d.file_content_text}</pre>
                            </AccordionContent>
                        </AccordionItem>
                    )}
                </Accordion>
            </div>
        );
    };

    if (state.loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="flex items-center justify-center px-4 py-6">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <Spinner className="scale-150" />
                        <div className="text-center">
                            <h3 className="mb-1 text-sm font-medium">Loading history</h3>
                            <span className="text-sm">Fetching information...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!state.data) {
        return <div>No data available</div>;
    }

    return (
        <>
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel defaultSize="70%">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <div className="input-container gallery-history-input scrollbar-controller scrollbar-vertical flex max-h-[100px] items-start justify-center rounded-md px-4 py-2">
                            <span className="text-sm">{state.data.ai?.arguments?.prompt ?? state.data.title}</span>
                        </div>
                        {imageError ? (
                            <div className="gallery-history-error flex h-[50vh] flex-col items-center justify-center">
                                <ImageOffIcon className="size-8" />
                                Failed to load media
                            </div>
                        ) : (
                            <div className="image-container flex items-center justify-center">
                                <div className="gallery-history-media max-h-[700px] max-w-[600px]">
                                    {isVideo ? (
                                        <video
                                            src={state.data.url}
                                            controls
                                            autoPlay
                                            className={`gallery-history-video max-w-full ${imageLoading ? 'is-hidden' : ''}`}
                                            onLoadedData={handleImageLoad}
                                            onError={handleImageError}
                                        >
                                            <track kind="captions" />
                                        </video>
                                    ) : (
                                        <img
                                            className={`gallery-image h-full w-full cursor-pointer object-cover ${imageLoading ? 'is-hidden' : ''}`}
                                            src={state.data.url}
                                            alt={state.data.title ?? ''}
                                            onClick={() => openLightbox()}
                                            onLoad={handleImageLoad}
                                            onError={handleImageError}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {imageLoading && (
                        <div className="flex h-3/4 w-full items-center justify-center">
                            <Spinner className="gallery-history-spinner" />
                        </div>
                    )}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel minSize="25%" defaultSize="30%" maxSize="50%">
                    {renderFlowDetails()}
                </ResizablePanel>
            </ResizablePanelGroup>
            <UploadFilesProvider>
                <LightboxMedia
                    lightboxImage={state.data as unknown as GeneratedItem}
                    isOpen={lightboxImage}
                    isVideo={isVideo}
                    onClose={closeLightbox}
                    fileInputRef={fileInputRef}
                    onChangeFile={() => {}}
                    renderFiles={() => null}
                    fileInputDisabled={true}
                />
            </UploadFilesProvider>
        </>
    );
};

export default GalleryHistory;

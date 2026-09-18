import {
    BotIcon,
    ChevronLeftIcon,
    FrownIcon,
    GlobeIcon,
    HeartIcon,
    ImageIcon,
    MoreHorizontalIcon,
    PlayIcon,
    SearchIcon,
    ShieldIcon,
} from 'lucide-react';
import { memo } from 'react';
import type { ReactNode } from 'react';

import ChatPreview from '@/components/agent-ui-preview/chat-preview';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';

import type { GalleryUiConfig, UiConfig } from '../../schema';

import GalleryPromptInputPreview from './gallery-prompt-input-preview';

interface Props {
    value: UiConfig;
    className?: string;
    agent?: AgentType;
    showGalleryQuotes?: boolean;
}

const getFirstAvailable = (items: string[] | undefined, fallback: string) =>
    items?.find((item) => item.trim().length > 0) ?? fallback;

const DEFAULT_GALLERY_QUOTE = "There is no favorable wind for the sailor who doesn't know where to go - Seneca";

const PreviewFrame = ({ children, className }: { children: ReactNode; className?: string }) => (
    <aside className={cn('ui-config-preview overflow-hidden p-4 text-foreground', className)}>
        <div className="flex h-full min-h-0 flex-col rounded-md border bg-(--bg-surface)">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
                <div className="flex items-center gap-2">
                    <BotIcon className="size-4 text-text-secondary" />
                    <span className="text-sm font-semibold">Live preview</span>
                </div>
                <span className="text-xs text-text-secondary">Approximate UI</span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-(--bg-base)">{children}</div>
        </div>
    </aside>
);

const GalleryPreview = ({
    value,
    agent,
    showQuotes,
}: {
    value: GalleryUiConfig;
    agent?: AgentType;
    showQuotes?: boolean;
}) => {
    const promptPlaceholder = getFirstAvailable(
        value.promptPlaceholders,
        value.type === 'video' ? 'Describe your video...' : 'What are we creating today?',
    );
    const quote = getFirstAvailable(value.quotes, DEFAULT_GALLERY_QUOTE);
    const isVideo = value.type === 'video';

    const renderImageGrid = () => (
        <div className="grid flex-1 grid-cols-3 gap-3 overflow-hidden px-4 pb-28">
            {Array.from({ length: 2 }, (_, index) => (
                <div
                    key={index}
                    className={cn(
                        'flex items-center justify-center overflow-hidden rounded-md bg-card shadow-sm',
                        index % 3 === 0 ? 'h-36' : 'h-24',
                        index % 4 === 0 && 'h-44',
                    )}
                >
                    <ImageIcon className="size-6 text-text-secondary" />
                </div>
            ))}
        </div>
    );

    const renderVideoGrid = () => (
        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-hidden px-4 pb-28">
            {Array.from({ length: 1 }, (_, index) => {
                return (
                    <div
                        key={index}
                        className={cn(
                            'group relative overflow-hidden rounded-lg bg-black shadow-sm',
                            index === 0 ? 'aspect-video' : 'aspect-4/3',
                        )}
                    >
                        <div
                            className={cn(
                                'absolute inset-0',
                                index % 3 === 0 && 'bg-[linear-gradient(135deg,#1f2937,#6b7280)]',
                                index % 3 === 1 && 'bg-[linear-gradient(135deg,#111827,#374151)]',
                                index % 3 === 2 && 'bg-[linear-gradient(135deg,#0f172a,#475569)]',
                            )}
                        />

                        <div className="absolute inset-0 bg-black/10" />
                        <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                            0:
                            {index % 2 === 0 ? '08' : '12'}
                        </div>
                        <button
                            type="button"
                            className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm"
                        >
                            <PlayIcon className="ml-0.5 size-4 fill-current" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent p-2 pt-8">
                            <span className="min-w-0 truncate text-xs font-medium text-white">Generated video</span>
                            <MoreHorizontalIcon className="size-4 shrink-0 text-white" />
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderQuoteEmptyState = () => (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 pb-28 text-center">
            <FrownIcon className="size-16 text-primary" />
            <div className="flex w-full max-w-sm flex-col items-center justify-center gap-2">
                <span className="leading-[20px] text-text-secondary">{quote}</span>
            </div>
        </div>
    );

    const renderGalleryContent = () => {
        if (showQuotes) return renderQuoteEmptyState();
        if (isVideo) return renderVideoGrid();

        return renderImageGrid();
    };

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="flex shrink-0 flex-col gap-3 px-4 py-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                    <button type="button" className="flex size-8 shrink-0 items-center justify-center rounded-md">
                        <ChevronLeftIcon className="size-5" />
                    </button>
                    <h2 className="min-w-0 flex-1 truncate text-sm leading-snug font-semibold">
                        {agent?.name || 'Agent name'}
                    </h2>
                </div>
                <div className="flex w-full min-w-0 flex-1 items-center justify-end gap-2 lg:w-auto lg:flex-none">
                    <div className="flex h-9 w-[260px] max-w-full items-center gap-2 rounded-3xl bg-card px-3 shadow-surface">
                        <SearchIcon className="size-3.5 text-text-secondary" />
                        <span className="truncate text-xs text-text-secondary">Search media library</span>
                    </div>
                    <div className="flex rounded-full border bg-card p-0.5">
                        {[ShieldIcon, HeartIcon, GlobeIcon].map((FilterIcon, index) => (
                            <span
                                key={index}
                                className={cn(
                                    'flex size-7 items-center justify-center rounded-full',
                                    index === 0 && 'bg-primary text-primary-foreground',
                                )}
                            >
                                <FilterIcon className="size-3.5" />
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            {renderGalleryContent()}
            <div className="absolute inset-x-4 bottom-4 mx-auto max-w-[778px]">
                <GalleryPromptInputPreview value={value} promptPlaceholder={promptPlaceholder} />
            </div>
        </div>
    );
};

const UiConfigPreview = ({ value, className, agent, showGalleryQuotes }: Props) => {
    const renderPreview = () => {
        if (value.componentType === 'chat') return <ChatPreview value={value} agentName={agent?.name} />;
        // App preview shows the assistant (chat) side; the app pane is runtime-only.
        if (value.componentType === 'app')
            return <ChatPreview value={{ ...value, componentType: 'chat', type: 'chat' }} agentName={agent?.name} />;
        if (value.componentType === 'api')
            return (
                <div className="flex h-full min-h-[560px] items-center justify-center">
                    <p className="text-center text-sm font-medium">API preview is not available in the preview mode.</p>
                </div>
            );

        return <GalleryPreview value={value} agent={agent} showQuotes={showGalleryQuotes} />;
    };

    return <PreviewFrame className={className}>{renderPreview()}</PreviewFrame>;
};

export default memo(UiConfigPreview);

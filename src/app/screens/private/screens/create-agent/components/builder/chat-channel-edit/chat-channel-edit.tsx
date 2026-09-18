import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import { ChevronLeft, Eye, EyeOff, GripVertical, PlusIcon, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TextAreaForm from '@/components/ui/textarea-form';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { cn } from '@/lib/utils';
import type { ChatAgentUiType } from '@/types/ui';

import ChatChannelPreview from './chat-channel-preview';

interface ChatChannelEditProps {
    agentName: string;
    initialUiConfig?: ChatAgentUiType;
    initialDescription: string;
    onSaveUiConfig: (next: ChatAgentUiType) => Promise<void>;
    onSaveDescription: (description: string) => Promise<void>;
    onBack: () => void;
}

const SAVE_DEBOUNCE_MS = 600;
const DESCRIPTION_MAX = 200;
const STARTERS_MAX = 6;
const RELATED_QUESTIONS_MIN = 1;
const RELATED_QUESTIONS_MAX = 5;
const RELATED_QUESTIONS_DEFAULT = 3;

const buildSeedUiConfig = (initial?: ChatAgentUiType): ChatAgentUiType => {
    const base: ChatAgentUiType = { componentType: 'chat', type: 'chat', home: {} };

    if (!initial) {
        return base;
    }

    return { ...base, ...initial, home: { ...initial.home } };
};

const clampRelatedQuestionsCount = (value: number): number => {
    if (Number.isNaN(value)) {
        return RELATED_QUESTIONS_DEFAULT;
    }

    return Math.min(RELATED_QUESTIONS_MAX, Math.max(RELATED_QUESTIONS_MIN, Math.round(value)));
};

export const ChatChannelEdit = ({
    agentName,
    initialUiConfig,
    initialDescription,
    onSaveUiConfig,
    onSaveDescription,
    onBack,
}: ChatChannelEditProps) => {
    const [uiConfig, setUiConfig] = useState<ChatAgentUiType>(() => buildSeedUiConfig(initialUiConfig));
    const [description, setDescription] = useState<string>(initialDescription);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    // Responsive-only preview toggle. >=1200px the aside is always shown, so the
    // header button is hidden; <1200px this swaps the single pane config <-> preview.
    const [previewOpen, setPreviewOpen] = useState(false);

    const lastSyncedUiConfigRef = useRef<ChatAgentUiType>(buildSeedUiConfig(initialUiConfig));
    const lastSyncedDescriptionRef = useRef<string>(initialDescription);

    const saveUiConfigRef = useRef(onSaveUiConfig);
    const saveDescriptionRef = useRef(onSaveDescription);

    saveUiConfigRef.current = onSaveUiConfig;
    saveDescriptionRef.current = onSaveDescription;

    const debouncedSaveUiConfigRef = useRef(
        debounce((next: ChatAgentUiType) => {
            saveUiConfigRef.current(next);
        }, SAVE_DEBOUNCE_MS),
    );
    const debouncedSaveDescriptionRef = useRef(
        debounce((next: string) => {
            saveDescriptionRef.current(next);
        }, SAVE_DEBOUNCE_MS),
    );

    useEffect(
        () => () => {
            debouncedSaveUiConfigRef.current.flush();
            debouncedSaveDescriptionRef.current.flush();
        },
        [],
    );

    useEffect(() => {
        const incoming = buildSeedUiConfig(initialUiConfig);

        if (isEqual(incoming, uiConfig)) {
            lastSyncedUiConfigRef.current = incoming;

            return;
        }

        if (isEqual(uiConfig, lastSyncedUiConfigRef.current)) {
            setUiConfig(incoming);
            lastSyncedUiConfigRef.current = incoming;
        }
    }, [initialUiConfig, uiConfig]);

    useEffect(() => {
        if (initialDescription === description) {
            lastSyncedDescriptionRef.current = initialDescription;

            return;
        }

        if (description === lastSyncedDescriptionRef.current) {
            setDescription(initialDescription);
            lastSyncedDescriptionRef.current = initialDescription;
        }
    }, [initialDescription, description]);

    const commitUiConfig = (next: ChatAgentUiType) => {
        setUiConfig(next);
        debouncedSaveUiConfigRef.current(next);
    };

    const commitDescription = (next: string) => {
        const trimmed = next.slice(0, DESCRIPTION_MAX);

        setDescription(trimmed);
        debouncedSaveDescriptionRef.current(trimmed);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        commitUiConfig({ ...uiConfig, home: { ...uiConfig.home, title: e.target.value } });
    };

    const updateSearch = (patch: Partial<NonNullable<ChatAgentUiType['home']['search']>>) => {
        commitUiConfig({ ...uiConfig, home: { ...uiConfig.home, search: { ...uiConfig.home.search, ...patch } } });
    };

    const handlePlaceholderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSearch({ placeholder: e.target.value });
    };

    const handleQuestionChange = (index: number, value: string) => {
        const current = uiConfig.home.questions ?? [];
        const nextQuestions = current.map((question, i) => (i === index ? value : question));

        commitUiConfig({ ...uiConfig, home: { ...uiConfig.home, questions: nextQuestions } });
    };

    const handleAddQuestion = () => {
        const current = uiConfig.home.questions ?? [];

        commitUiConfig({ ...uiConfig, home: { ...uiConfig.home, questions: [...current, ''] } });
    };

    const handleRemoveQuestion = (index: number) => {
        const current = uiConfig.home.questions ?? [];
        const nextQuestions = current.filter((_, i) => i !== index);

        commitUiConfig({ ...uiConfig, home: { ...uiConfig.home, questions: nextQuestions } });
    };

    const handleReorderQuestion = (from: number, to: number) => {
        if (from === to) {
            return;
        }

        const current = uiConfig.home.questions ?? [];

        if (from < 0 || to < 0 || from >= current.length || to >= current.length) {
            return;
        }

        const nextQuestions = [...current];
        const [moved] = nextQuestions.splice(from, 1);

        nextQuestions.splice(to, 0, moved);
        commitUiConfig({ ...uiConfig, home: { ...uiConfig.home, questions: nextQuestions } });
    };

    const handleRelatedQuestionsToggle = (checked: boolean) => {
        const search = { ...uiConfig.home.search, isRelatedQuestionsEnabled: checked };

        if (checked && search.relatedQuestionsCount === undefined) {
            search.relatedQuestionsCount = RELATED_QUESTIONS_DEFAULT;
        }

        commitUiConfig({ ...uiConfig, home: { ...uiConfig.home, search } });
    };

    const handleRelatedQuestionsCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSearch({ relatedQuestionsCount: clampRelatedQuestionsCount(Number(e.target.value)) });
    };

    const relatedQuestionsEnabled = uiConfig.home.search?.isRelatedQuestionsEnabled ?? false;
    const relatedQuestionsCount = uiConfig.home.search?.relatedQuestionsCount ?? RELATED_QUESTIONS_DEFAULT;
    const fileUploadsEnabled = uiConfig.home.search?.files ?? false;
    const webSearchVisible = uiConfig.home.search?.showWebSearch ?? false;
    const webSearchEnabledByDefault = uiConfig.home.search?.isWebSearchEnabled ?? false;
    const deepSearchVisible = uiConfig.home.search?.showDeepSearch ?? false;
    const deepSearchEnabledByDefault = uiConfig.home.search?.isDeepSearchEnabled ?? false;
    const incognitoEnabled = uiConfig.home.search?.isIncognitoEnabled ?? false;
    const questions = uiConfig.home.questions ?? [];

    const renderSectionHeading = (title: string, sub: string) => (
        <div className="flex flex-col gap-1">
            <h3 className="text-text-primary m-0 text-h3 font-semibold">{title}</h3>
            <p className="m-0 text-[13px] text-text-secondary">{sub}</p>
        </div>
    );

    const renderToggleRow = (
        label: string,
        sub: string,
        checked: boolean,
        onCheckedChange: (checked: boolean) => void,
    ) => (
        <div className="flex items-center justify-between gap-4 border-t border-border py-3.5">
            <div className="min-w-0">
                <div className="text-text-primary text-sm font-medium">{label}</div>
                <div className="mt-0.5 text-[12.5px] text-text-secondary">{sub}</div>
            </div>
            <ToggleSwitch aria-label={label} checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
        </div>
    );

    const renderGeneralSection = () => (
        <section className="flex flex-col gap-5 rounded-3xl border border-border-secondary bg-card p-4 shadow-xs lg:p-6">
            {renderSectionHeading('General', 'Name and describe how this agent appears to people')}
            <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                    <Label htmlFor="chat-channel-description">Description</Label>
                    <span className="text-xs text-text-secondary">{`${description.length}/${DESCRIPTION_MAX}`}</span>
                </div>
                <TextAreaForm
                    id="chat-channel-description"
                    value={description}
                    onChange={commitDescription}
                    placeholder="Describe what this agent does."
                    className="min-h-[84px]"
                    maxLength={DESCRIPTION_MAX}
                />
                <span className="text-xs text-text-secondary">How this agent is described in listings.</span>
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="chat-channel-title">Home title</Label>
                <Input
                    id="chat-channel-title"
                    value={uiConfig.home.title ?? ''}
                    onChange={handleTitleChange}
                    placeholder="Your agent"
                />
                <span className="text-xs text-text-secondary">The greeting shown before the first message.</span>
            </div>
        </section>
    );

    const renderStarterRow = (question: string, index: number) => {
        const isDragging = draggedIndex === index;
        const isTarget = draggedIndex !== null && dragOverIndex === index && draggedIndex !== index;
        // Reorder splices out `from` then inserts at `to`: dragging down lands the
        // item *after* the target row, dragging up lands it *before*. Match the line.
        const showLineAbove = isTarget && (draggedIndex as number) > index;
        const showLineBelow = isTarget && (draggedIndex as number) < index;

        const dropLine = (
            <span className="pointer-events-none absolute inset-x-0 z-1 flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="h-0.5 flex-1 rounded-full bg-primary" />
            </span>
        );

        return (
            <div
                key={index}
                draggable
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(index);
                }}
                onDrop={(e) => {
                    e.preventDefault();

                    if (draggedIndex !== null) {
                        handleReorderQuestion(draggedIndex, index);
                    }

                    setDraggedIndex(null);
                    setDragOverIndex(null);
                }}
                onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                }}
                className={cn(
                    'group relative flex items-center gap-2.5 rounded-[10px] transition-[opacity,box-shadow,background-color] duration-150',
                    isDragging && 'opacity-40',
                    isTarget && 'bg-primary/4',
                )}
            >
                {showLineAbove ? <span className="absolute top-[-7px] right-0 left-0">{dropLine}</span> : null}
                {showLineBelow ? <span className="absolute right-0 bottom-[-7px] left-0">{dropLine}</span> : null}
                <span
                    className={cn(
                        'shrink-0 cursor-grab text-border-secondary transition-colors active:cursor-grabbing',
                        'group-hover:text-text-secondary',
                    )}
                    aria-hidden
                >
                    <GripVertical className="size-3.5" />
                </span>
                <span className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-text-secondary">
                    {index + 1}
                </span>
                <Input
                    value={question}
                    onChange={(e) => handleQuestionChange(index, e.target.value)}
                    placeholder="Write a starter prompt"
                    className="flex-1"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-text-secondary hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove starter ${index + 1}`}
                    onClick={() => handleRemoveQuestion(index)}
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
        );
    };

    const renderStartersSection = () => (
        <section className="flex flex-col gap-5 rounded-3xl border border-border-secondary bg-card p-4 shadow-xs lg:p-6">
            {renderSectionHeading('Conversation starters', 'Suggested prompts shown before the first message')}
            {questions.length > 0 ? (
                <div className="flex flex-col gap-2.5">{questions.map(renderStarterRow)}</div>
            ) : null}
            {questions.length < STARTERS_MAX ? (
                <button
                    type="button"
                    onClick={handleAddQuestion}
                    className={cn(
                        'flex h-[38px] items-center justify-center gap-2 rounded-[10px] border border-dashed border-border-secondary',
                        'text-sm font-medium text-primary transition-colors',
                        'hover:border-primary hover:bg-primary/6',
                    )}
                >
                    <PlusIcon className="size-4" />
                    Add starter
                </button>
            ) : null}
        </section>
    );

    const renderComposerSection = () => (
        <section className="flex flex-col gap-4 rounded-3xl border border-border-secondary bg-card p-7 shadow-xs">
            {renderSectionHeading('Composer', 'What people can do when writing a message')}
            <div className="flex flex-col gap-2">
                <Label htmlFor="chat-channel-placeholder">Composer placeholder</Label>
                <Input
                    id="chat-channel-placeholder"
                    value={uiConfig.home.search?.placeholder ?? ''}
                    onChange={handlePlaceholderChange}
                    placeholder="Ask anything…"
                />
            </div>
            <div className="mt-1 flex flex-col">
                {renderToggleRow(
                    'Allow file uploads',
                    'Let users attach files to messages',
                    fileUploadsEnabled,
                    (checked) => updateSearch({ files: checked }),
                )}
                {renderToggleRow(
                    'Show web search',
                    'Add a web search toggle to the composer',
                    webSearchVisible,
                    (checked) => updateSearch({ showWebSearch: checked }),
                )}
                {webSearchVisible ? (
                    <div className="flex items-center justify-between gap-4 pb-3.5 pl-5">
                        <div className="text-text-primary text-[13px] font-medium">Enabled by default</div>
                        <ToggleSwitch
                            aria-label="Web search enabled by default"
                            checked={webSearchEnabledByDefault}
                            onCheckedChange={(checked) => updateSearch({ isWebSearchEnabled: checked })}
                            className="shrink-0"
                        />
                    </div>
                ) : null}
                {renderToggleRow(
                    'Show deep search',
                    'Add a deep search toggle to the composer',
                    deepSearchVisible,
                    (checked) =>
                        updateSearch(
                            checked ? { showDeepSearch: true } : { showDeepSearch: false, isDeepSearchEnabled: false },
                        ),
                )}
                {deepSearchVisible ? (
                    <div className="flex items-center justify-between gap-4 pb-3.5 pl-5">
                        <div className="text-text-primary text-[13px] font-medium">Enabled by default</div>
                        <ToggleSwitch
                            aria-label="Deep search enabled by default"
                            checked={deepSearchEnabledByDefault}
                            onCheckedChange={(checked) => updateSearch({ isDeepSearchEnabled: checked })}
                            className="shrink-0"
                        />
                    </div>
                ) : null}
                {renderToggleRow(
                    'Allow incognito mode',
                    'Let users start temporary chats that aren’t saved',
                    incognitoEnabled,
                    (checked) => updateSearch({ isIncognitoEnabled: checked }),
                )}
            </div>
        </section>
    );

    const renderResponsesSection = () => (
        <section className="flex flex-col gap-3 rounded-3xl border border-border-secondary bg-card p-7 shadow-xs">
            {renderSectionHeading('Responses', 'How the agent follows up after answering')}
            <div className="flex flex-col">
                {renderToggleRow(
                    'Generate related questions',
                    'Suggest follow-up prompts after each response',
                    relatedQuestionsEnabled,
                    handleRelatedQuestionsToggle,
                )}
                {relatedQuestionsEnabled ? (
                    <div className="flex items-center justify-between gap-4 pb-3.5 pl-5">
                        <Label htmlFor="chat-channel-related-count" className="text-text-primary text-[13px]">
                            How many
                        </Label>
                        <Input
                            id="chat-channel-related-count"
                            type="number"
                            min={RELATED_QUESTIONS_MIN}
                            max={RELATED_QUESTIONS_MAX}
                            value={relatedQuestionsCount}
                            onChange={handleRelatedQuestionsCountChange}
                            className="w-16"
                        />
                    </div>
                ) : null}
            </div>
        </section>
    );

    const renderPreviewHeader = () => (
        <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Live preview</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Updates as you edit
            </span>
        </div>
    );

    const renderHeaderTitle = (): ReactNode => {
        if (!agentName) {
            return <span className="text-text-primary text-lg font-semibold tracking-tight">Chat channel</span>;
        }

        return (
            <div className="flex min-w-0 flex-col">
                <h1 className="m-0 truncate text-sm font-semibold text-text-secondary">{agentName}</h1>
            </div>
        );
    };

    return (
        <div className="chat-channel-edit flex h-full flex-col bg-background">
            <header className="config-topbar z-10 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
                <div className="flex w-full min-w-0 items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onBack}
                        className="hover:text-text-primary h-6 w-6 shrink-0 rounded-md text-text-secondary"
                        aria-label="Back to configuration"
                    >
                        <ChevronLeft className="size-5" />
                    </Button>
                    {renderHeaderTitle()}
                </div>
            </header>
            <div className="secondary-header z-10 flex w-full shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-2">
                <span className="text-text-primary text-lg font-semibold tracking-tight">Chat channel</span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewOpen((open) => !open)}
                    className={cn(
                        'shrink-0 gap-1.5 rounded-full min-[1200px]:hidden',
                        previewOpen ? 'text-primary' : 'hover:text-text-primary text-text-secondary',
                    )}
                    aria-pressed={previewOpen}
                    aria-label={previewOpen ? 'Hide live preview' : 'Show live preview'}
                    title={previewOpen ? 'Hide live preview' : 'Show live preview'}
                >
                    {previewOpen ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    Preview
                </Button>
            </div>
            <div className="flex min-h-0 flex-1">
                <div
                    className={cn(
                        'scrollbar-controller scrollbar-vertical min-w-0 flex-1 bg-card',
                        previewOpen && 'hidden min-[1200px]:block',
                    )}
                >
                    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 pt-7 pb-20">
                        {renderGeneralSection()}
                        {renderStartersSection()}
                        {renderComposerSection()}
                        {renderResponsesSection()}
                    </div>
                </div>

                {/* Preview pane for <1200px. Stays mounted (hidden via class) so it keeps updating live. */}
                <div
                    className={cn(
                        'flex min-w-0 flex-1 flex-col gap-3 bg-card px-4 py-5 min-[1200px]:hidden',
                        !previewOpen && 'hidden',
                    )}
                >
                    {renderPreviewHeader()}
                    <div className="min-h-0 flex-1 overflow-hidden rounded-3xl shadow-surface">
                        <ChatChannelPreview uiConfig={uiConfig} agentName={agentName} />
                    </div>
                </div>

                <aside className="sticky top-0 hidden h-full w-[480px] shrink-0 flex-col gap-3 self-start border-l border-border bg-card px-4 py-5 min-[1200px]:flex">
                    {renderPreviewHeader()}
                    <div className="min-h-0 flex-1 overflow-hidden rounded-3xl shadow-surface">
                        <ChatChannelPreview uiConfig={uiConfig} agentName={agentName} />
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ChatChannelEdit;

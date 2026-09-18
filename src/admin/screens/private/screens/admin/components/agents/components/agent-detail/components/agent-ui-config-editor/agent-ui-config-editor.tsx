import debounce from 'lodash/debounce';
import { ChevronLeftIcon, EyeIcon, EyeOffIcon, GitForkIcon, InfoIcon, LockIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Content, JSONContent } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';

import UiConfigPreview from './components/preview/ui-config-preview';
import {
    COMPONENT_TYPES,
    coerceRawUiConfig,
    DEFAULT_CHAT_CONFIG,
    DEFAULT_CONFIG_BY_COMPONENT,
    type ComponentType,
    type UiConfig,
} from './schema';
import UiConfigForm from './ui-config-form';
import { validateUiConfigCode } from './validation';

interface Props {
    code: string;
    agent?: AgentType;
    onChange: (nextCode: string) => void;
    readOnly?: boolean;
    readOnlyReason?: 'default-version' | 'no-permission' | null;
    onRequestFork?: () => void;
}

const stringify = (value: unknown): string => JSON.stringify(value ?? {}, null, 2);

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getDraftComponentType = (code: string): ComponentType | null => {
    try {
        const parsed = JSON.parse(code);

        if (!isPlainRecord(parsed) || typeof parsed.componentType !== 'string') return null;

        const normalized = parsed.componentType.trim().toLowerCase();

        return COMPONENT_TYPES.includes(normalized as ComponentType) ? (normalized as ComponentType) : null;
    } catch {
        return null;
    }
};

const AgentUiConfigEditor = ({ code, agent, onChange, readOnly, readOnlyReason, onRequestFork }: Props) => {
    const agentModels = useMemo(() => agent?.models ?? [], [agent?.models]);
    const parsedInitial = useMemo<UiConfig>(() => {
        const coerced = coerceRawUiConfig(code, agentModels);

        return coerced ?? { ...DEFAULT_CHAT_CONFIG };
    }, [agentModels, code]);

    const [formValue, setFormValue] = useState<UiConfig>(parsedInitial);
    const deferredFormValue = useDeferredValue(formValue);
    const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
    const [showPreview, setShowPreview] = useState(true);
    const [showGalleryQuotes, setShowGalleryQuotes] = useState(false);
    const [jsonValidationMessage, setJsonValidationMessage] = useState<string | null>(null);
    const [jsonDraftComponentType, setJsonDraftComponentType] = useState<ComponentType | null>(null);
    const [pendingJsonComponentType, setPendingJsonComponentType] = useState<ComponentType | null>(null);
    const lastEmittedCodeRef = useRef<string | null>(null);
    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    // The reset effect below must fire on an incoming `code` change only. `agent` is
    // refetched after every save, so `agent.models` arrives with a fresh array identity
    // and would otherwise re-run the reset a round-trip later, discarding whatever the
    // user typed in the meantime.
    const agentModelsRef = useRef(agentModels);

    agentModelsRef.current = agentModels;
    const parsedInitialRef = useRef(parsedInitial);

    parsedInitialRef.current = parsedInitial;
    const debouncedEmitRef = useRef(
        debounce((nextCode: string) => {
            onChangeRef.current(nextCode);
        }, 300),
    );

    const debouncedSetJsonContentRef = useRef(
        debounce((content: Content) => {
            setJsonContent(content);
        }, 300),
    );

    useEffect(
        () => () => {
            debouncedEmitRef.current.flush();
            debouncedSetJsonContentRef.current.cancel();
        },
        [],
    );

    const [jsonContent, setJsonContent] = useState<Content>(() => {
        const trimmed = (code ?? '').trim();

        return trimmed ? { text: trimmed } : { json: parsedInitial };
    });

    useEffect(() => {
        if (lastEmittedCodeRef.current !== null && code === lastEmittedCodeRef.current) {
            lastEmittedCodeRef.current = null;

            return;
        }

        debouncedEmitRef.current.cancel();
        debouncedSetJsonContentRef.current.cancel();
        lastEmittedCodeRef.current = null;

        const incoming = coerceRawUiConfig(code, agentModelsRef.current);

        if (incoming) {
            setFormValue(incoming);
        }
        setJsonValidationMessage(null);
        setJsonDraftComponentType(null);
        setPendingJsonComponentType(null);
        setShowGalleryQuotes(false);
        const trimmed = (code ?? '').trim();

        setJsonContent(trimmed ? { text: trimmed } : { json: incoming ?? parsedInitialRef.current });
    }, [code]);

    const handleFormChange = (next: UiConfig) => {
        if (readOnly) return;

        setJsonValidationMessage(null);
        setJsonDraftComponentType(null);
        setPendingJsonComponentType(null);
        setFormValue(next);
        if (next.componentType !== 'gallery') {
            setShowGalleryQuotes(false);
        }
        const nextString = stringify(next);

        lastEmittedCodeRef.current = nextString;
        debouncedSetJsonContentRef.current({ text: nextString });
        debouncedEmitRef.current(nextString);
    };

    const handleJsonChange = (content: Content) => {
        if (readOnly) return;

        const str =
            'text' in content && content.text !== undefined ? content.text : stringify((content as JSONContent).json);

        setJsonContent(content);

        lastEmittedCodeRef.current = str;
        onChange(str);

        const validation = validateUiConfigCode(str);

        if (validation.success) {
            setFormValue(validation.data);
            setJsonValidationMessage(null);
            setJsonDraftComponentType(null);
            if (validation.data.componentType !== 'gallery') {
                setShowGalleryQuotes(false);
            }

            return;
        }

        setJsonValidationMessage(validation.message);
        const draftComponentType = getDraftComponentType(str);

        setJsonDraftComponentType(
            draftComponentType && draftComponentType !== formValue.componentType ? draftComponentType : null,
        );
    };

    const handleApplyJsonComponentSwitch = () => {
        if (readOnly || !jsonDraftComponentType) return;

        setPendingJsonComponentType(jsonDraftComponentType);
    };

    const handleConfirmJsonComponentSwitch = () => {
        if (readOnly || !pendingJsonComponentType) return;

        const nextValue = { ...DEFAULT_CONFIG_BY_COMPONENT[pendingJsonComponentType] };
        const nextString = stringify(nextValue);

        debouncedEmitRef.current.cancel();
        setFormValue(nextValue);
        setJsonValidationMessage(null);
        setJsonDraftComponentType(null);
        setPendingJsonComponentType(null);
        setJsonContent({ text: nextString });
        lastEmittedCodeRef.current = nextString;
        onChange(nextString);
    };

    const handleShowGalleryQuotesChange = (nextShowGalleryQuotes: boolean) => {
        setShowGalleryQuotes(nextShowGalleryQuotes);
    };

    const renderJsonComponentSwitchConfirmation = () => {
        if (!pendingJsonComponentType) return null;

        return (
            <ConfirmationModal
                isOpen={Boolean(pendingJsonComponentType)}
                onClose={() => setPendingJsonComponentType(null)}
                onConfirm={handleConfirmJsonComponentSwitch}
                title="Switch component type?"
                confirmButtonText="Switch type"
                cancelButtonText="Keep current"
            >
                <span className="text-sm text-text-secondary">
                    The JSON draft changes this config from{' '}
                    <span className="font-medium text-foreground">{formValue.componentType}</span> to{' '}
                    <span className="font-medium text-foreground">{pendingJsonComponentType}</span>. Confirming will
                    reset settings that only apply to the current component type.
                </span>
            </ConfirmationModal>
        );
    };

    const renderReadOnlyBanner = () => {
        if (!readOnly) return null;

        if (readOnlyReason === 'default-version') {
            return (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--warning) bg-(--warning-bg) p-3 text-xs">
                    <div className="flex items-center gap-2">
                        <LockIcon className="size-4" />
                        <span>Viewing the default version (read-only). Fork it to edit as a new version.</span>
                    </div>
                    {onRequestFork ? (
                        <Button type="button" size="sm" variant="outline" onClick={onRequestFork}>
                            <GitForkIcon className="mr-1" />
                            Fork to edit
                        </Button>
                    ) : null}
                </div>
            );
        }

        if (readOnlyReason === 'no-permission') {
            return (
                <div className="rounded-md border border-(--warning) bg-(--warning-bg) p-3 text-xs">
                    You don&apos;t have permission to edit this config.
                </div>
            );
        }

        return null;
    };

    const renderFormTab = () => {
        return (
            <div className="flex flex-col gap-2 p-4">
                {renderReadOnlyBanner()}
                <UiConfigForm
                    agent={agent}
                    value={formValue}
                    onChange={handleFormChange}
                    pendingJsonComponentType={jsonDraftComponentType}
                    jsonValidationMessage={jsonValidationMessage}
                    onApplyJsonComponentSwitch={handleApplyJsonComponentSwitch}
                    showGalleryQuotes={showGalleryQuotes}
                    onShowGalleryQuotesChange={handleShowGalleryQuotesChange}
                    disabled={readOnly}
                />
            </div>
        );
    };

    const renderJsonEditor = () => (
        <>
            {jsonValidationMessage ? (
                <div className="flex shrink-0 items-start gap-2 rounded-md border border-(--warning) bg-(--warning-bg) p-3 text-xs">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium">JSON is not driving the form preview.</span>
                        <span className="text-text-secondary">
                            {jsonValidationMessage} The Form tab and preview keep showing the last valid config until
                            the JSON matches the schema.
                        </span>
                        {jsonDraftComponentType ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-1 self-start"
                                disabled={readOnly}
                                onClick={handleApplyJsonComponentSwitch}
                            >
                                Reset as {jsonDraftComponentType}
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            <div className="min-h-0 flex-1">
                <JSONEditor
                    content={jsonContent}
                    readOnly={readOnly}
                    onChange={handleJsonChange}
                    className="h-full w-full"
                    containerClassName="h-full w-full"
                />
            </div>
        </>
    );

    const renderTabs = () => (
        <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'form' | 'json')}
            className="flex h-full min-h-0 w-full flex-1 flex-col gap-0"
        >
            <div className="flex min-h-[33px] shrink-0 items-center justify-between border-b border-border px-4">
                <TabsList variant="line" className="h-7! gap-3 p-0">
                    <TabsTrigger
                        value="form"
                        className="h-7 px-0 after:bg-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                        Form
                    </TabsTrigger>
                    <TabsTrigger
                        value="json"
                        className="h-7 px-0 after:bg-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                        JSON
                    </TabsTrigger>
                </TabsList>
                <div className="flex items-center justify-center gap-1.5">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 rounded-lg text-xs text-text-secondary hover:bg-primary/10 hover:text-primary"
                        onClick={() => setShowPreview((prev) => !prev)}
                        disabled={formValue.componentType === 'api'}
                    >
                        {showPreview ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                        Preview
                    </Button>
                    {formValue.componentType === 'api' && (
                        <SimpleTooltip content="No preview available for API component type." side="bottom">
                            <span className="inline-flex text-text-secondary">
                                <InfoIcon className="size-4" />
                            </span>
                        </SimpleTooltip>
                    )}
                </div>
            </div>
            <TabsContent
                value="form"
                forceMount
                className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden"
            >
                {renderFormTab()}
            </TabsContent>
            <TabsContent value="json" className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
                {renderJsonEditor()}
            </TabsContent>
        </Tabs>
    );

    return (
        <div
            className={cn(
                'agent-ui-config-editor flex min-h-0 w-full flex-1 flex-col overflow-hidden',
                readOnly && 'tool-code-readonly-ui',
            )}
        >
            {/* desktop ≥1200px: side-by-side resizable */}
            <div className="hidden min-h-0 min-w-0 flex-1 rounded-xl min-[1200px]:flex">
                <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1 rounded-xl">
                    <ResizablePanel defaultSize={showPreview ? '58%' : '100%'} minSize="300px" className="min-w-0">
                        <div className="flex h-full min-w-0 flex-col overflow-hidden">{renderTabs()}</div>
                    </ResizablePanel>
                    {showPreview && formValue.componentType !== 'api' ? (
                        <>
                            <ResizableHandle withHandle className="mx-1" />
                            <ResizablePanel defaultSize="42%" minSize="30%" maxSize="70%" className="min-w-0">
                                <UiConfigPreview
                                    value={deferredFormValue}
                                    className="h-full min-w-0"
                                    agent={agent}
                                    showGalleryQuotes={showGalleryQuotes}
                                />
                            </ResizablePanel>
                        </>
                    ) : null}
                </ResizablePanelGroup>
            </div>

            {/* tablet/mobile <1200px: editor fills height, preview slides in from right */}
            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden min-[1200px]:hidden">
                <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">{renderTabs()}</div>
                <div
                    className={cn(
                        'absolute inset-0 z-20 flex flex-col bg-card transition-transform duration-300 ease-in-out',
                        showPreview && formValue.componentType !== 'api'
                            ? 'translate-x-0'
                            : 'pointer-events-none translate-x-full',
                    )}
                >
                    <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card p-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-text-secondary"
                            onClick={() => setShowPreview(false)}
                        >
                            <ChevronLeftIcon className="size-4" />
                            Editor
                        </Button>
                    </div>
                    <UiConfigPreview
                        value={deferredFormValue}
                        className="min-h-0 min-w-0 flex-1"
                        agent={agent}
                        showGalleryQuotes={showGalleryQuotes}
                    />
                </div>
            </div>
            {renderJsonComponentSwitchConfirmation()}
        </div>
    );
};

export default AgentUiConfigEditor;

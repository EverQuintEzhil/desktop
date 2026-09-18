import { CpuIcon, GitForkIcon, LockIcon, TrashIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Content, JSONContent } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { modelDisplayName, type AgentType, type ModelType } from '@/types/admin';
import { parseJsonIfValid } from '@/utils';

import {
    buildRequestBodyFromParameterSchema,
    parseAgentModelConfigObject,
    resolveToolParameterProperties,
    stringifyAgentModelConfig,
    tryParseAgentModelConfigObject,
} from '../../../../../code-manager/code-manager.utils';
import type { ToolParameterSchema } from '../../../../../parameters-schema';
import FieldHelp from '../agent-ui-config-editor/components/primitives/field-help';

import AgentModelParameterFields from './components/agent-model-parameter-fields';
import AgentModelPayloadJsonEditor from './components/agent-model-payload-json-editor';

interface Props {
    code: string;
    agent?: AgentType;
    onChange: (nextCode: string) => void;
    readOnly?: boolean;
    readOnlyReason?: 'default-version' | 'no-permission' | null;
    onRequestFork?: () => void;
}

const stringify = (value: unknown): string => JSON.stringify(value ?? {}, null, 2);

const EMPTY_MODEL_PAYLOAD: Record<string, unknown> = {};

const AgentModelConfigEditor = ({ code, agent, onChange, readOnly, readOnlyReason, onRequestFork }: Props) => {
    const agentModels = agent?.models ?? [];
    const parsedInitial = useMemo(() => parseAgentModelConfigObject(code), [code]);

    const [formValue, setFormValue] = useState<Record<string, Record<string, unknown>>>(parsedInitial);
    const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
    const lastEmittedCodeRef = useRef<string | null>(null);
    const [jsonContent, setJsonContent] = useState<Content>(() => {
        const trimmed = (code ?? '').trim();

        return trimmed ? { text: trimmed } : { json: parsedInitial };
    });

    useEffect(() => {
        if (lastEmittedCodeRef.current !== null && code === lastEmittedCodeRef.current) {
            lastEmittedCodeRef.current = null;

            return;
        }

        const incoming = parseAgentModelConfigObject(code);

        setFormValue(incoming);
        const trimmed = (code ?? '').trim();

        setJsonContent(trimmed ? { text: trimmed } : { json: incoming });
    }, [code]);

    const applyConfig = useCallback(
        (next: Record<string, Record<string, unknown>>) => {
            setFormValue(next);
            const nextString = stringifyAgentModelConfig(next, agentModels);

            lastEmittedCodeRef.current = nextString;
            setJsonContent({ text: nextString });
            onChange(nextString);
        },
        [agentModels, onChange],
    );

    const handleJsonChange = (content: Content) => {
        setJsonContent(content);
        const str =
            'text' in content && content.text !== undefined ? content.text : stringify((content as JSONContent).json);

        lastEmittedCodeRef.current = str;
        onChange(str);

        const parsed = tryParseAgentModelConfigObject(str);

        if (parsed !== null) {
            setFormValue(parsed);
        }
    };

    const agentModelKeySet = useMemo(() => new Set(agentModels.map((m) => m.model)), [agentModels]);

    const orphanKeys = useMemo(
        () =>
            Object.keys(formValue)
                .filter((key) => !agentModelKeySet.has(key))
                .sort((a, b) => a.localeCompare(b)),
        [formValue, agentModelKeySet],
    );

    const handleToggleAgentModel = (model: ModelType, checked: boolean) => {
        if (readOnly) return;

        if (!checked) {
            const rest = { ...formValue };

            delete rest[model.model];
            applyConfig(rest);

            return;
        }

        const defaultPayload = buildRequestBodyFromParameterSchema(model.parameters || {});

        applyConfig({
            ...formValue,
            [model.model]: formValue[model.model] ?? defaultPayload,
        });
    };

    const handleRemoveOrphan = (key: string) => {
        if (readOnly) return;

        const rest = { ...formValue };

        delete rest[key];
        applyConfig(rest);
    };

    const handlePayloadEditorChange = (modelKey: string, content: Content) => {
        const parsed = parseJsonIfValid(content);

        if (parsed === undefined || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return;
        }

        applyConfig({
            ...formValue,
            [modelKey]: parsed as Record<string, unknown>,
        });
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

    const renderPayloadEditor = (modelKey: string, payload: Record<string, unknown>) => {
        return (
            <AgentModelPayloadJsonEditor
                payload={payload}
                readOnly={readOnly ?? false}
                onChange={(nextContent) => handlePayloadEditorChange(modelKey, nextContent)}
                className="min-h-[160px] w-full"
                containerClassName="min-h-[160px] w-full"
            />
        );
    };

    const renderPayloadSection = (model: ModelType | undefined, modelKey: string, payload: Record<string, unknown>) => {
        const schema = model?.parameters as ToolParameterSchema | undefined;
        const propsMap = resolveToolParameterProperties(schema);
        const hasSchemaFields = Object.keys(propsMap).length > 0;

        if (model && hasSchemaFields) {
            return (
                <AgentModelParameterFields
                    rootSchema={schema}
                    value={payload}
                    onChange={(next) => {
                        applyConfig({
                            ...formValue,
                            [modelKey]: next,
                        });
                    }}
                    disabled={readOnly}
                />
            );
        }

        return renderPayloadEditor(modelKey, payload);
    };

    const renderSectionHeader = (title: string, description: string, countLabel?: string) => {
        return (
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <CpuIcon className="size-3.5" />
                    </span>
                    <FieldHelp label={title} description={description} />
                    {countLabel ? (
                        <Badge variant="outline" className="text-xs text-text-secondary">
                            {countLabel}
                        </Badge>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderAgentModelRow = (model: ModelType, index: number) => {
        const included = Object.prototype.hasOwnProperty.call(formValue, model.model);
        const payload = formValue[model.model] ?? EMPTY_MODEL_PAYLOAD;

        return (
            <div key={model._id} className="border-b border-border last:border-b-0">
                <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">
                                {modelDisplayName(model)}
                            </span>
                            {included ? (
                                <Badge
                                    variant="outline"
                                    className="shrink-0 border-primary/30 bg-primary/5 text-[11px] font-semibold tracking-wide text-primary uppercase"
                                >
                                    Included
                                </Badge>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className="shrink-0 text-[11px] font-medium text-text-secondary"
                                >
                                    Excluded
                                </Badge>
                            )}
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
                            {model.provider ? (
                                <>
                                    <span>{model.provider}</span>
                                    <span aria-hidden>·</span>
                                </>
                            ) : null}
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">#{index + 1}</span>
                        </div>
                    </div>
                    <Checkbox
                        id={`model-${model._id}`}
                        disabled={readOnly}
                        checked={included}
                        label="Include"
                        labelClassName="text-xs text-text-secondary"
                        onChange={(_, checked) => handleToggleAgentModel(model, checked)}
                    />
                </div>
                {included ? (
                    <div className="flex min-h-0 flex-col gap-3 border-t border-border bg-muted/30 px-3 py-3">
                        <FieldHelp
                            label="Model settings"
                            description="Values follow this model’s parameter schema (same validation as on save)."
                            className="text-xs! font-medium text-text-secondary"
                        />
                        {renderPayloadSection(model, model.model, payload)}
                    </div>
                ) : null}
            </div>
        );
    };

    const renderOrphanRow = (orphanKey: string) => {
        const payload = formValue[orphanKey] ?? EMPTY_MODEL_PAYLOAD;

        return (
            <div key={orphanKey} className="border-b border-border last:border-b-0">
                <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">{orphanKey}</span>
                            <Badge
                                variant="outline"
                                className="shrink-0 border-(--warning)/40 bg-(--warning-bg) text-[11px] font-semibold tracking-wide text-(--warning) uppercase"
                            >
                                Orphan
                            </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-text-secondary">Not on the agent’s current model list</p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={readOnly}
                        aria-label={`Remove ${orphanKey} from config`}
                        onClick={() => handleRemoveOrphan(orphanKey)}
                    >
                        <TrashIcon className="size-3.5" />
                        Remove
                    </Button>
                </div>
                <div className="flex min-h-0 flex-col gap-3 border-t border-border bg-muted/30 px-3 py-3">
                    <FieldHelp
                        label="Model settings"
                        description="This key is not on the agent’s model list. Edit as JSON or remove the entry."
                        className="text-xs! font-medium text-text-secondary"
                    />
                    {renderPayloadEditor(orphanKey, payload)}
                </div>
            </div>
        );
    };

    const renderModelsBody = () => {
        if (agentModels.length === 0 && orphanKeys.length === 0) {
            return (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <CpuIcon className="size-6" />
                        </span>
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-foreground">No models assigned</span>
                            <span className="max-w-sm text-xs leading-5 text-text-secondary">
                                Add models in the Agent Capabilities tab to configure model settings here.
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        const includedCount = agentModels.filter((model) =>
            Object.prototype.hasOwnProperty.call(formValue, model.model),
        ).length;

        return (
            <div className="flex flex-col gap-4">
                {agentModels.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {renderSectionHeader(
                            'Agent models',
                            'Include each model and edit its settings. Saved keys match model identifiers.',
                            `${includedCount} / ${agentModels.length}`,
                        )}
                        <div className="flex flex-col">{agentModels.map(renderAgentModelRow)}</div>
                    </div>
                ) : null}
                {orphanKeys.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {renderSectionHeader(
                            'Other keys in this file',
                            'Entries not matched to the current agent model list.',
                            String(orphanKeys.length),
                        )}
                        <div className="flex flex-col">{orphanKeys.map(renderOrphanRow)}</div>
                    </div>
                ) : null}
            </div>
        );
    };

    const renderFormTab = () => {
        return (
            <div className="flex flex-col gap-3 p-4">
                {renderReadOnlyBanner()}
                {renderModelsBody()}
            </div>
        );
    };

    return (
        <div
            className={cn(
                'agent-model-config-editor flex min-h-0 w-full flex-1 flex-col overflow-hidden',
                readOnly && 'tool-code-readonly-ui',
            )}
        >
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as 'form' | 'json')}
                className="flex min-h-0 w-full flex-1 flex-col gap-0"
            >
                <div className="flex min-h-[33px] shrink-0 items-center border-b border-border px-4">
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
                </div>
                <TabsContent
                    value="form"
                    className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col"
                >
                    {renderFormTab()}
                </TabsContent>
                <TabsContent value="json" className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
                    <JSONEditor
                        content={jsonContent}
                        readOnly={readOnly}
                        onChange={handleJsonChange}
                        className="h-full w-full"
                        containerClassName="h-full w-full"
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AgentModelConfigEditor;

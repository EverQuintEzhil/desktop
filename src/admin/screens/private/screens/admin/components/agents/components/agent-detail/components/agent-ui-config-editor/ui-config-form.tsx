import { InfoIcon, LayersIcon, LayoutTemplateIcon, SendIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import Select from '@/components/ui/select';
import Spinner from '@/components/ui/spinner';
import type { AgentType } from '@/types/admin';

import { copyModelParameters, DEFAULT_CONFIG_BY_COMPONENT, normalizeDefaultModelFromAvailableModels } from './schema';
import {
    API_TYPES as API_TYPE_VALUES,
    COMPONENT_TYPES,
    type ApiUiConfig,
    type AppUiConfig,
    type ChatUiConfig,
    type ComponentType,
    type GalleryUiConfig,
    type ModelValueSchemaType,
    type UiConfig,
} from './schema';
import ApiSection from './sections/api-section';
import AppPaneSection from './sections/app-pane-section';
import ChatSection from './sections/chat-section';
import GallerySection from './sections/gallery-section';
import HomeSection from './sections/home-section';
import LibrarySection from './sections/library-section';
import ModelsSection from './sections/models-section';
import ParametersSection from './sections/parameters-section';
import ProjectsSection from './sections/projects-section';
import PromptLibrarySection from './sections/prompt-library-section';
import RoutinesSection from './sections/routines-section';
import TogglesSection from './sections/toggles-section';
import UsageSection from './sections/usage-section';
import {
    type UiConfigFieldErrors,
    formatUiConfigIssuePath,
    getUiConfigFieldError,
    validateUiConfigValue,
} from './validation';

interface Props {
    agent?: AgentType;
    value: UiConfig;
    onChange: (next: UiConfig) => void;
    onSave?: (value: UiConfig) => Promise<void>;
    disabled?: boolean;
    pendingJsonComponentType?: ComponentType | null;
    jsonValidationMessage?: string | null;
    onApplyJsonComponentSwitch?: () => void;
    showGalleryQuotes: boolean;
    onShowGalleryQuotesChange: (showQuotes: boolean) => void;
}

const COMPONENT_OPTIONS = COMPONENT_TYPES.map((v) => ({
    value: v,
    label: v.charAt(0).toUpperCase() + v.slice(1),
}));

const typeOptionsFor = (ct: ComponentType): { value: string; label: string }[] => {
    if (ct === 'chat') return [{ value: 'chat', label: 'Chat' }];
    if (ct === 'app') return [{ value: 'app', label: 'App' }];
    if (ct === 'api') return API_TYPE_VALUES.map((v) => ({ value: v, label: v }));

    return [
        { value: 'image', label: 'Image' },
        { value: 'video', label: 'Video' },
    ];
};

type CarriedKey = 'models' | 'defaultModel' | 'home' | 'parameters';

const CARRIED_KEYS_BY_COMPONENT: Record<ComponentType, readonly CarriedKey[]> = {
    chat: ['models', 'defaultModel', 'home', 'parameters'],
    app: ['models', 'defaultModel', 'home', 'parameters'],
    gallery: ['models', 'defaultModel', 'parameters'],
    api: [],
};

const mergeComponentType = (prev: UiConfig, next: ComponentType): UiConfig => {
    if (prev.componentType === next) return prev;

    const source = prev as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...DEFAULT_CONFIG_BY_COMPONENT[next] };

    for (const key of CARRIED_KEYS_BY_COMPONENT[next]) {
        if (source[key] !== undefined) merged[key] = source[key];
    }

    // Not re-parsed: `prev` is checked against the schema before the switch is offered, and a
    // parse failure here could only be answered by discarding the carried keys.
    return merged as UiConfig;
};

const getAgentModelParameterSignature = (agentModels: AgentType['models']): string =>
    (agentModels ?? [])
        .map((model) => {
            const parameterKeys = Object.keys(copyModelParameters(model.parameters) ?? {}).sort();

            return `${model._id}:${parameterKeys.join(',')}`;
        })
        .join('|');

const mergeMissingModelParameters = (
    models: ModelValueSchemaType[],
    agentModels: AgentType['models'],
): { models: ModelValueSchemaType[]; changed: boolean } => {
    const agentModelById = new Map((agentModels ?? []).map((model) => [model._id, model]));
    let changed = false;

    const nextModels = models.map((model) => {
        const agentModel = agentModelById.get(model.modelId);
        const copiedParameters = copyModelParameters(agentModel?.parameters);

        if (!copiedParameters) return model;

        const missingEntries = Object.entries(copiedParameters).filter(([key]) => !model.parameters?.[key]);

        if (missingEntries.length === 0) return model;
        changed = true;

        return {
            ...model,
            parameters: {
                ...Object.fromEntries(missingEntries),
                ...(model.parameters ?? {}),
            },
        };
    });

    return { models: nextModels, changed };
};

const UiConfigForm = ({
    agent,
    value,
    onChange,
    onSave,
    disabled,
    pendingJsonComponentType,
    jsonValidationMessage,
    onApplyJsonComponentSwitch,
    showGalleryQuotes,
    onShowGalleryQuotesChange,
}: Props) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [issues, setIssues] = useState<ReturnType<typeof validateUiConfigValue>['issues']>([]);
    const [fieldErrors, setFieldErrors] = useState<UiConfigFieldErrors>({});
    const [pendingComponentType, setPendingComponentType] = useState<ComponentType | null>(null);

    const [appliedParameterSignature, setAppliedParameterSignature] = useState<string | null>(null);
    const [typeSwitchBlockedMessage, setTypeSwitchBlockedMessage] = useState<string | null>(null);

    const agentModels = useMemo(() => agent?.models ?? [], [agent?.models]);
    const agentModelParameterSignature = useMemo(() => getAgentModelParameterSignature(agentModels), [agentModels]);

    // Agent models can gain parameters after the config was saved. They are merged into what the form
    // shows and edits, but only a real edit writes them back: opening the page is not an edit. The
    // merge runs once per agent-model signature — after the first edit the admin's value is
    // authoritative, or deleting a parameter would merge it straight back in on the next render.
    const effectiveValue = useMemo<UiConfig>(() => {
        if (disabled) return value;
        if (appliedParameterSignature === agentModelParameterSignature) return value;
        if (value.componentType === 'api') return value;
        if (value.models === undefined) return value;
        if (agentModels.length === 0) return value;

        const merged = mergeMissingModelParameters(value.models, agentModels);

        if (!merged.changed) return value;

        return {
            ...value,
            models: merged.models,
            defaultModel: normalizeDefaultModelFromAvailableModels(merged.models, value.defaultModel),
        };
    }, [agentModelParameterSignature, agentModels, appliedParameterSignature, disabled, value]);

    const patch = (updater: (prev: UiConfig) => UiConfig) => {
        if (disabled) return;

        if (issues.length > 0) {
            setIssues([]);
        }
        if (Object.keys(fieldErrors).length > 0) {
            setFieldErrors({});
        }
        if (typeSwitchBlockedMessage) {
            setTypeSwitchBlockedMessage(null);
        }
        setAppliedParameterSignature(agentModelParameterSignature);
        onChange(updater(effectiveValue));
    };

    const getError = (path: string) => getUiConfigFieldError(fieldErrors, path);
    const getSectionErrorCount = (paths: string[]) =>
        issues.filter((issue) => {
            const issuePath = formatUiConfigIssuePath(issue.path);

            return paths.some((path) => issuePath === path || issuePath.startsWith(`${path}.`));
        }).length;

    const handleSubmit = async () => {
        if (disabled) return;
        if (!onSave) return;
        const validation = validateUiConfigValue(effectiveValue);

        if (!validation.success) {
            setIssues(validation.issues);
            setFieldErrors(validation.fieldErrors);

            return;
        }
        setIssues([]);
        setFieldErrors({});

        setIsSubmitting(true);
        try {
            await onSave(validation.data);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestComponentTypeChange = (next: ComponentType) => {
        if (disabled) return;
        if (next === effectiveValue.componentType) return;

        // A switch re-parses the carried keys, so an in-flight invalid value (a blanked model name,
        // an empty parameter key) would fail that parse and reset the whole config.
        const validation = validateUiConfigValue(effectiveValue);

        if (!validation.success) {
            setIssues(validation.issues);
            setFieldErrors(validation.fieldErrors);
            setTypeSwitchBlockedMessage(
                'Fix the errors below before switching component type — switching now would discard settings that cannot be carried over.',
            );

            return;
        }

        setTypeSwitchBlockedMessage(null);
        setPendingComponentType(next);
    };

    const handleConfirmComponentTypeChange = () => {
        if (disabled) return;
        if (!pendingComponentType) return;

        const nextComponentType = pendingComponentType;

        setPendingComponentType(null);
        patch((prev) => mergeComponentType(prev, nextComponentType));
    };

    const renderComponentTypeConfirmation = () => {
        if (!pendingComponentType) return null;

        return (
            <ConfirmationModal
                isOpen={Boolean(pendingComponentType)}
                onClose={() => setPendingComponentType(null)}
                onConfirm={handleConfirmComponentTypeChange}
                title="Switch component type?"
                confirmButtonText="Switch type"
                cancelButtonText="Keep current"
            >
                <span className="text-sm text-text-secondary">
                    Switching from <span className="font-medium text-foreground">{effectiveValue.componentType}</span>{' '}
                    to <span className="font-medium text-foreground">{pendingComponentType}</span> will reset settings
                    that only apply to the current component type.
                </span>
            </ConfirmationModal>
        );
    };

    // `showRoutines` is false for an app agent: routines are a chat-only surface, so the section is not
    // offered where the app view merely reuses the chat fields.
    const renderChatSections = (chat: ChatUiConfig, showRoutines = true) => (
        <>
            <HomeSection
                home={chat.home}
                apps={agent?.apps}
                tools={agent?.tools}
                disabled={disabled}
                getError={getError}
                errorCount={getSectionErrorCount(['home'])}
                onChange={(next) => patch(() => ({ ...chat, home: next }))}
            />
            <ChatSection
                value={chat}
                disabled={disabled}
                errorCount={getSectionErrorCount(['chat', 'search'])}
                onChange={(p) => patch(() => ({ ...chat, ...p }))}
            />
            <ModelsSection
                componentType={chat.componentType}
                agentModels={agentModels}
                models={chat.models}
                defaultModel={chat.defaultModel}
                disabled={disabled}
                getError={getError}
                errorCount={getSectionErrorCount(['models', 'defaultModel'])}
                onChange={(next) => patch(() => ({ ...chat, ...next }))}
            />
            <ParametersSection
                value={chat.parameters}
                disabled={disabled}
                getError={getError}
                errorCount={getSectionErrorCount(['parameters'])}
                onChange={(p) => patch(() => ({ ...chat, parameters: p }))}
            />
            <PromptLibrarySection
                value={chat.promptLibrary}
                disabled={disabled}
                errorCount={getSectionErrorCount(['promptLibrary'])}
                onChange={(p) => patch(() => ({ ...chat, promptLibrary: p }))}
            />
            <ProjectsSection
                value={chat.spaces}
                disabled={disabled}
                errorCount={getSectionErrorCount(['spaces'])}
                onChange={(p) => patch(() => ({ ...chat, spaces: p }))}
            />
            {showRoutines ? (
                <RoutinesSection
                    value={chat.routines}
                    disabled={disabled}
                    errorCount={getSectionErrorCount(['routines'])}
                    onChange={(p) => patch(() => ({ ...chat, routines: p }))}
                />
            ) : null}
            <LibrarySection
                value={chat.library}
                disabled={disabled}
                errorCount={getSectionErrorCount(['library'])}
                onChange={(p) => patch(() => ({ ...chat, library: p }))}
            />
            <UsageSection
                value={chat.usage}
                disabled={disabled}
                errorCount={getSectionErrorCount(['usage'])}
                onChange={(p) => patch(() => ({ ...chat, usage: p }))}
            />
        </>
    );

    // The app variant carries the same chat fields; the spreads inside the chat sections preserve
    // the `app` key and the 'app' discriminator.
    const renderAppSections = (app: AppUiConfig) => (
        <>
            <AppPaneSection
                value={app.app}
                apps={agent?.apps}
                disabled={disabled}
                getError={getError}
                errorCount={getSectionErrorCount(['app'])}
                onChange={(next) => patch(() => ({ ...app, app: next }))}
            />
            {renderChatSections(app as unknown as ChatUiConfig, false)}
        </>
    );

    const renderApiSections = (api: ApiUiConfig) => (
        <ApiSection
            value={api}
            disabled={disabled}
            getError={getError}
            formSpecErrorCount={getSectionErrorCount(['formSpec'])}
            responseErrorCount={getSectionErrorCount(['responsePath'])}
            onChange={(p) => patch(() => ({ ...api, ...p }))}
        />
    );

    const renderGallerySections = (gallery: GalleryUiConfig) => (
        <>
            <ModelsSection
                componentType={gallery.componentType}
                agentModels={agentModels}
                models={gallery.models}
                defaultModel={gallery.defaultModel}
                disabled={disabled}
                getError={getError}
                errorCount={getSectionErrorCount(['models', 'defaultModel'])}
                onChange={(next) => patch(() => ({ ...gallery, ...next }))}
            />
            <ParametersSection
                value={gallery.parameters}
                disabled={disabled}
                getError={getError}
                errorCount={getSectionErrorCount(['parameters'])}
                onChange={(p) => patch(() => ({ ...gallery, parameters: p }))}
            />
            <GallerySection
                value={gallery}
                disabled={disabled}
                errorCount={getSectionErrorCount(['promptPlaceholders', 'quotes', 'videoAgentSlug'])}
                showQuotes={showGalleryQuotes}
                onShowQuotesChange={onShowGalleryQuotesChange}
                onChange={(p) => patch(() => ({ ...gallery, ...p }))}
            />
            <TogglesSection
                value={gallery}
                disabled={disabled}
                errorCount={getSectionErrorCount(['showPublicPrivateToggle', 'isPublic'])}
                onChange={(p) => patch(() => ({ ...gallery, ...p }))}
            />
            <UsageSection
                value={gallery.usage}
                disabled={disabled}
                errorCount={getSectionErrorCount(['usage'])}
                onChange={(p) => patch(() => ({ ...gallery, usage: p }))}
            />
        </>
    );

    const renderSectionsByType = () => {
        if (effectiveValue.componentType === 'chat') return renderChatSections(effectiveValue);
        if (effectiveValue.componentType === 'app') return renderAppSections(effectiveValue);
        if (effectiveValue.componentType === 'api') return renderApiSections(effectiveValue);

        return renderGallerySections(effectiveValue);
    };

    const renderTypeSwitchBlocked = () => {
        if (!typeSwitchBlockedMessage) return null;

        return (
            <div className="flex items-start gap-2 rounded-md border border-(--danger) bg-(--danger-bg) p-3 text-xs">
                <InfoIcon className="mt-0.5 size-4 shrink-0" />
                <span className="text-(--danger)">{typeSwitchBlockedMessage}</span>
            </div>
        );
    };

    const renderErrors = () => {
        if (issues.length === 0) return null;

        return (
            <div className="flex flex-col gap-1 rounded-md border border-(--danger) bg-(--danger-bg) p-3">
                <span className="text-sm font-medium text-(--danger)">Fix the following errors before saving:</span>
                <ul className="list-disc pl-5 text-xs">
                    {issues.map((issue, idx) => (
                        <li key={idx}>
                            <span className="font-mono">{formatUiConfigIssuePath(issue.path)}</span>
                            {': '}
                            {issue.message}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderJsonDraftWarning = () => {
        if (!jsonValidationMessage) return null;

        return (
            <div className="flex items-start gap-2 rounded-md border border-(--warning) bg-(--warning-bg) p-3 text-xs">
                <InfoIcon className="mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">Form is showing the last valid config.</span>
                    <span className="text-text-secondary">{jsonValidationMessage}</span>
                    {pendingJsonComponentType ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-text-secondary">
                                The JSON draft asks to switch from{' '}
                                <span className="font-medium text-foreground">{effectiveValue.componentType}</span> to{' '}
                                <span className="font-medium text-foreground">{pendingJsonComponentType}</span>.
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={disabled}
                                onClick={onApplyJsonComponentSwitch}
                            >
                                Review switch
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderSaveFooter = () => {
        if (disabled || !onSave) return null;

        return (
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-(--bg-surface) px-4 py-2.5">
                <Button size="sm" disabled={isSubmitting} onClick={handleSubmit}>
                    {isSubmitting ? <Spinner className="mr-2" /> : <SendIcon className="mr-2" />}
                    {isSubmitting ? 'Saving' : 'Save'}
                </Button>
            </div>
        );
    };

    const renderTypeSwitcher = () => {
        const typeOptions = typeOptionsFor(effectiveValue.componentType);

        return (
            <div className="grid gap-3 border-b border-border px-3 py-3 @[480px]:grid-cols-2">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                        <LayoutTemplateIcon className="size-3.5" />
                        Component type
                        <span className="text-(--danger)">*</span>
                    </div>
                    <Select<ComponentType>
                        variant="ghost"
                        className="rounded-md"
                        allowDeselect={false}
                        disabled={disabled}
                        value={effectiveValue.componentType}
                        options={COMPONENT_OPTIONS as { value: ComponentType; label: string }[]}
                        onChange={(v) => {
                            if (v) handleRequestComponentTypeChange(v);
                        }}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                        <LayersIcon className="size-3.5" />
                        Sub-variant
                        <span className="text-(--danger)">*</span>
                    </div>
                    <Select<string>
                        variant="ghost"
                        className="rounded-md"
                        allowDeselect={false}
                        disabled={disabled}
                        value={effectiveValue.type}
                        options={typeOptions}
                        onChange={(v) => {
                            if (v) patch((prev) => ({ ...prev, type: v }) as UiConfig);
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="ui-config-form @container flex min-w-0 flex-col gap-3">
            {renderJsonDraftWarning()}
            <div className="overflow-hidden rounded-lg border border-border">
                {renderTypeSwitcher()}
                {renderSectionsByType()}
            </div>
            {renderTypeSwitchBlocked()}
            {renderErrors()}
            {renderSaveFooter()}
            {renderComponentTypeConfirmation()}
        </div>
    );
};

export default UiConfigForm;

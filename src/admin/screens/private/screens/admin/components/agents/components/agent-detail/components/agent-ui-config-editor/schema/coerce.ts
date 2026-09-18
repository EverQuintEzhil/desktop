import { copyModelParameters } from '@/lib/copy-model-parameters';
import { modelDisplayName, type ModelType } from '@/types/admin';

import { DEFAULT_CHAT_CONFIG, DEFAULT_CONFIG_BY_COMPONENT } from './defaults';
import {
    API_TYPES,
    COMPONENT_TYPES,
    GALLERY_TYPES,
    type ComponentType,
    type ModelValueSchemaType,
    type ParameterSchemaType,
    type UiConfig,
    uiConfigSchema,
} from './types';

export { copyModelParameters };

const DEFAULT_MAX_IMAGE_UPLOADS = 2;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const stringOrUndefined = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
};

const getAgentModelByLooseIdentifier = (
    agentModels: ModelType[] | undefined,
    identifier: string | undefined,
): ModelType | undefined => {
    if (!identifier) return undefined;

    return (agentModels ?? []).find(
        (model) => model._id === identifier || model.model === identifier || model.refName === identifier,
    );
};

const parseMaybeJsonString = (raw: unknown): unknown => {
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();

    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
};

const normalizeComponentType = (value: unknown): ComponentType | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();

    return COMPONENT_TYPES.includes(normalized as ComponentType) ? (normalized as ComponentType) : undefined;
};

const normalizeRawModelValue = (raw: unknown, agentModels?: ModelType[]): ModelValueSchemaType | undefined => {
    if (typeof raw === 'string') {
        const identifier = stringOrUndefined(raw);
        const agentModel = getAgentModelByLooseIdentifier(agentModels, identifier);

        if (agentModel) return agentModelToUiModel(agentModel);
        if (identifier) return { name: identifier, modelId: identifier };

        return undefined;
    }

    if (!isPlainRecord(raw)) return undefined;

    const modelIdObject = isPlainRecord(raw.modelId) ? raw.modelId : undefined;
    const valueObject = isPlainRecord(raw.value) ? raw.value : undefined;
    const identifier =
        stringOrUndefined(raw.modelId) ??
        stringOrUndefined(modelIdObject?._id) ??
        stringOrUndefined(raw._id) ??
        stringOrUndefined(raw.id) ??
        stringOrUndefined(raw.value) ??
        stringOrUndefined(valueObject?._id) ??
        stringOrUndefined(raw.model) ??
        stringOrUndefined(raw.refName);
    const agentModel = getAgentModelByLooseIdentifier(agentModels, identifier);

    let normalized: ModelValueSchemaType | undefined;

    if (agentModel) {
        normalized = agentModelToUiModel(agentModel);
    } else if (identifier) {
        normalized = {
            name:
                stringOrUndefined(raw.name) ??
                stringOrUndefined(raw.label) ??
                stringOrUndefined(raw.model) ??
                stringOrUndefined(raw.refName) ??
                identifier,
            modelId: identifier,
        };
    }

    if (!normalized) return undefined;

    const mergedParameters = (() => {
        const modelParams = normalized.parameters ?? {};
        const storedParams = isPlainRecord(raw.parameters)
            ? (raw.parameters as Record<string, ParameterSchemaType>)
            : {};
        const merged = { ...modelParams, ...storedParams };

        return Object.keys(merged).length > 0 ? (merged as ModelValueSchemaType['parameters']) : undefined;
    })();

    return {
        ...normalized,
        name: stringOrUndefined(raw.name) ?? stringOrUndefined(raw.label) ?? normalized.name,
        parameters: mergedParameters,
        options: isPlainRecord(raw.options) ? (raw.options as ModelValueSchemaType['options']) : normalized.options,
    };
};

const filterValidModels = (models: unknown, agentModels?: ModelType[]): ModelValueSchemaType[] | undefined => {
    if (!Array.isArray(models)) return undefined;
    const valid = models
        .map((model) => normalizeRawModelValue(model, agentModels))
        .filter((model): model is ModelValueSchemaType => Boolean(model));

    return valid.length > 0 ? valid : undefined;
};

const withChatDefaults = (obj: Record<string, unknown>, agentModels?: ModelType[]): Record<string, unknown> => {
    const next = { ...obj };

    if (!next.home || typeof next.home !== 'object') {
        next.home = { title: '' };
    } else {
        const home = next.home as Record<string, unknown>;
        const nextHome: Record<string, unknown> = {
            ...home,
            title: typeof home.title === 'string' ? home.title : '',
        };

        if (typeof home.titleIncognito === 'string') nextHome.titleIncognito = home.titleIncognito;

        next.home = nextHome;
    }

    if (next.type !== 'chat') next.type = 'chat';

    const validModels = filterValidModels(next.models, agentModels);

    next.models = validModels;
    next.defaultModel = normalizeDefaultModelFromAvailableModels(
        validModels,
        next.defaultModel as ModelValueSchemaType | undefined,
    );

    return next;
};

const withApiDefaults = (obj: Record<string, unknown>): Record<string, unknown> => {
    const next = { ...obj };

    if (!Array.isArray(next.formSpec)) next.formSpec = [];
    delete next.request;
    delete next.response;

    if (!API_TYPES.includes(next.type as (typeof API_TYPES)[number])) {
        next.type = 'jsonviewer';
    }

    return next;
};

const withGalleryDefaults = (obj: Record<string, unknown>, agentModels?: ModelType[]): Record<string, unknown> => {
    const next = { ...obj };

    delete next.request;
    delete next.response;
    delete next.responsePath;

    // Migrate legacy long names + the now-removed 'image-editing' variant.
    if (next.type === 'image-generation' || next.type === 'image-editing') next.type = 'image';
    if (next.type === 'video-generation') next.type = 'video';

    if (!GALLERY_TYPES.includes(next.type as (typeof GALLERY_TYPES)[number])) next.type = 'image';

    const validGalleryModels = filterValidModels(next.models, agentModels)?.map((model) => ({
        ...model,
        options: {
            ...(model.options ?? {}),
            maxImageUploads: model.options?.maxImageUploads ?? DEFAULT_MAX_IMAGE_UPLOADS,
        },
    }));

    next.models = validGalleryModels;
    next.defaultModel = normalizeDefaultModelFromAvailableModels(
        validGalleryModels,
        next.defaultModel as ModelValueSchemaType | undefined,
    );

    return next;
};

// The app variant shares every chat field; reuse the chat coercion, then restore
// its own discriminators and make sure the `app` section is an object.
const withAppDefaults = (obj: Record<string, unknown>, agentModels?: ModelType[]): Record<string, unknown> => {
    const next = withChatDefaults(obj, agentModels);

    next.componentType = 'app';
    next.type = 'app';

    if (!isPlainRecord(next.app)) next.app = { refName: '' };

    return next;
};

export const agentModelToUiModel = (model: ModelType): ModelValueSchemaType => ({
    name: modelDisplayName(model),
    modelId: model._id,
    parameters: copyModelParameters(model.parameters),
});

export const normalizeDefaultModelFromAvailableModels = (
    models: ModelValueSchemaType[] | undefined,
    defaultModel: ModelValueSchemaType | undefined,
): ModelValueSchemaType | undefined => {
    const availableModels = (models ?? []).filter((model) => model.modelId);

    if (availableModels.length === 0) return undefined;

    if (defaultModel?.modelId) {
        const matchingNamedModel = availableModels.find(
            (model) => model.modelId === defaultModel.modelId && model.name === defaultModel.name,
        );

        if (matchingNamedModel) return matchingNamedModel;

        const matchingModel = availableModels.find((model) => model.modelId === defaultModel.modelId);

        if (matchingModel) return matchingModel;
    }

    return availableModels[0];
};

/**
 * Coerce a raw `agent.uiConfig` value (object, JSON string, v1-shaped, or partial) into the v2 schema.
 * Returns a best-effort valid `UiConfig`. Only returns `null` when the input is completely empty or unparseable.
 */
export const coerceRawUiConfig = (raw: unknown, agentModels?: ModelType[]): UiConfig | null => {
    const parsed = parseMaybeJsonString(raw);

    const source = parsed && typeof parsed === 'object' ? parsed : raw;

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return { ...DEFAULT_CHAT_CONFIG };
    }

    let obj = { ...(source as Record<string, unknown>) };

    obj.componentType = normalizeComponentType(obj.componentType) ?? 'chat';

    delete obj.meta;
    delete obj.editAgentSlug;

    if (obj.componentType === 'chat') obj = withChatDefaults(obj, agentModels);
    if (obj.componentType === 'api') obj = withApiDefaults(obj);
    if (obj.componentType === 'gallery') obj = withGalleryDefaults(obj, agentModels);
    if (obj.componentType === 'app') obj = withAppDefaults(obj, agentModels);

    const result = uiConfigSchema.safeParse(obj);

    if (result.success) return result.data;

    const fallback = DEFAULT_CONFIG_BY_COMPONENT[obj.componentType as ComponentType] ?? DEFAULT_CHAT_CONFIG;

    return { ...fallback };
};

import {
    type AgentParameterValue,
    getSelectedParameterValue,
    shouldSelectParameterByDefault,
} from '@/lib/agent-parameters';
import type { ParameterType } from '@/types/admin';

export type GalleryParametersState = Record<string, AgentParameterValue>;

export interface PersistedGalleryParams {
    modelId: string | null;
    parameters: Record<string, string | number | boolean>;
    knownKeys: string[] | null;
}

export const getGalleryParamsStorageKey = (userId: string, agentId: string): string => {
    return `gallery-agent-params:${userId || 'anonymous'}:${agentId}`;
};

const isPrimitiveRecord = (value: unknown): value is Record<string, string | number | boolean> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    return Object.values(value).every(
        (entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean',
    );
};

const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
};

export const parsePersistedGalleryParams = (raw: string): PersistedGalleryParams | null => {
    try {
        const parsed: unknown = JSON.parse(raw);

        if (typeof parsed !== 'object' || parsed === null) {
            return null;
        }

        const candidate = parsed as { modelId?: unknown; parameters?: unknown; knownKeys?: unknown };

        if (candidate.modelId !== null && typeof candidate.modelId !== 'string') {
            return null;
        }

        if (!isPrimitiveRecord(candidate.parameters)) {
            return null;
        }

        return {
            modelId: candidate.modelId,
            parameters: candidate.parameters,
            knownKeys: isStringArray(candidate.knownKeys) ? candidate.knownKeys : null,
        };
    } catch {
        return null;
    }
};

export interface ReadPersistedGalleryParamsResult {
    record: PersistedGalleryParams;
    raw: string;
}

export const readPersistedGalleryParams = (storageKey: string): ReadPersistedGalleryParamsResult | null => {
    try {
        const raw = window.localStorage.getItem(storageKey);

        if (!raw) {
            return null;
        }

        const record = parsePersistedGalleryParams(raw);

        if (!record) {
            return null;
        }

        return { record, raw };
    } catch {
        return null;
    }
};

export const serializePersistedGalleryParams = (record: PersistedGalleryParams): string => {
    return JSON.stringify(record);
};

export const writeSerializedGalleryParams = (storageKey: string, serialized: string): void => {
    try {
        window.localStorage.setItem(storageKey, serialized);
    } catch {
        return;
    }
};

export const serializeParametersForStorage = (
    parameters: GalleryParametersState,
): Record<string, string | number | boolean> => {
    const serialized: Record<string, string | number | boolean> = {};

    Object.keys(parameters).forEach((key) => {
        const value = parameters[key];

        if (typeof value === 'object' && value !== null) {
            if (typeof value.value === 'string') {
                serialized[key] = value.value;
            }

            return;
        }

        serialized[key] = value;
    });

    return serialized;
};

export const applyKnownKeysBackfill = (
    restoredParameters: GalleryParametersState,
    knownKeys: string[] | null,
    mergedConfig: Record<string, ParameterType>,
): GalleryParametersState => {
    if (knownKeys === null) {
        return restoredParameters;
    }

    const known = new Set(knownKeys);
    const next = { ...restoredParameters };

    Object.keys(mergedConfig).forEach((key) => {
        if (known.has(key) || next[key] !== undefined) {
            return;
        }

        const param = mergedConfig[key];

        if (!shouldSelectParameterByDefault(param)) {
            return;
        }

        if ('component' in param && param.component === 'textbox') {
            next[key] = '';
        } else {
            next[key] = getSelectedParameterValue(param);
        }
    });

    return next;
};

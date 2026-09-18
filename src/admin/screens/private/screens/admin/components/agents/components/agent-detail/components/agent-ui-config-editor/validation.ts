import type { ZodIssue } from 'zod';

import type { ModelType } from '@/types/admin';

import { type UiConfig, uiConfigSchema } from './schema';

export type UiConfigFieldErrors = Record<string, string[]>;
export type GetUiConfigFieldError = (path: string) => string | undefined;

const issuePathToKey = (path: readonly PropertyKey[]) => path.map(String).join('.');

export const formatUiConfigIssuePath = (path: readonly PropertyKey[]) => {
    const key = issuePathToKey(path);

    return key || '(root)';
};

export const buildUiConfigFieldErrors = (issues: readonly ZodIssue[]): UiConfigFieldErrors =>
    issues.reduce<UiConfigFieldErrors>((acc, issue) => {
        const key = issuePathToKey(issue.path);

        if (!acc[key]) {
            acc[key] = [];
        }

        if (!acc[key].includes(issue.message)) {
            acc[key].push(issue.message);
        }

        return acc;
    }, {});

export const getUiConfigFieldError = (fieldErrors: UiConfigFieldErrors, path: string) => fieldErrors[path]?.[0];

export const validateUiConfigValue = (value: unknown) => {
    const result = uiConfigSchema.safeParse(value);

    if (result.success) {
        return {
            success: true as const,
            data: result.data,
            issues: [] as ZodIssue[],
            fieldErrors: {} as UiConfigFieldErrors,
        };
    }

    return {
        success: false as const,
        issues: result.error.issues,
        fieldErrors: buildUiConfigFieldErrors(result.error.issues),
    };
};

export const validateUiConfigCode = (code: string) => {
    const trimmed = code.trim();

    if (!trimmed) {
        return {
            success: false as const,
            message: 'UI config code is required.',
        };
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return {
            success: false as const,
            message: 'UI config JSON is invalid.',
        };
    }

    const validation = validateUiConfigValue(parsed);

    if (!validation.success) {
        const firstIssue = validation.issues[0];

        return {
            success: false as const,
            message: `Schema error at ${formatUiConfigIssuePath(firstIssue.path)}: ${firstIssue.message}`,
            issues: validation.issues,
            fieldErrors: validation.fieldErrors,
        };
    }

    return {
        success: true as const,
        data: validation.data as UiConfig,
    };
};

const extractModelId = (entry: unknown): string | null => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const id = (entry as Record<string, unknown>).modelId;

    return typeof id === 'string' && id.trim() !== '' ? id : null;
};

const collectUiConfigModelIds = (parsedConfig: unknown): string[] => {
    if (!parsedConfig || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) return [];

    const config = parsedConfig as Record<string, unknown>;
    const entries = Array.isArray(config.models) ? config.models : [];
    const ids = [...entries, config.defaultModel].map(extractModelId).filter((id): id is string => id !== null);

    return Array.from(new Set(ids));
};

export const getUiConfigModelValidationError = (
    parsedConfig: unknown,
    models: ModelType[] | undefined,
): string | null => {
    const allowed = new Set((models ?? []).map((model) => model._id));
    const offending = collectUiConfigModelIds(parsedConfig).filter((id) => !allowed.has(id));

    if (offending.length === 0) return null;

    const isPlural = offending.length > 1;
    const preview = offending.slice(0, 3).join('", "');
    const suffix = offending.length > 3 ? `" and ${offending.length - 3} more` : '"';
    const noun = isPlural ? 'Models' : 'Model';
    const verb = isPlural ? 'are' : 'is';
    const pronoun = isPlural ? 'them' : 'it';

    return `${noun} "${preview}${suffix} ${verb} not in this agent's capabilities. Add ${pronoun} under Capabilities, or pick an assigned model.`;
};

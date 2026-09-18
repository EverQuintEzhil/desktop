import explorerQueryTypes from './explorerQueryTypes.json';
import type { ExplorerConfig, ExplorerFieldDef, ExplorerMethod, ExplorerViewMode } from './types';

const EMPTY_EXPLORER_FIELDS: ExplorerFieldDef[] = [];

const DEFAULT_EXPLORER_CONFIG: ExplorerConfig = {
    method: null,
    fields: EMPTY_EXPLORER_FIELDS,
    view: 'normal',
};

function normalizeMethod(methodRaw: string | null | undefined): ExplorerMethod {
    if (methodRaw === null || methodRaw === undefined) {
        return null;
    }

    if (methodRaw === 'query') {
        return 'query';
    }

    if (methodRaw === 'aggregate') {
        return 'aggregate';
    }

    return 'find';
}

function normalizeView(raw: string | undefined): ExplorerViewMode {
    return raw === 'split' ? 'split' : 'normal';
}

function normalizeExplorerObject(obj: Record<string, unknown>): ExplorerConfig {
    const method = normalizeMethod(obj.method as string | null | undefined);
    const fields = Array.isArray(obj.fields) ? (obj.fields as ExplorerFieldDef[]) : EMPTY_EXPLORER_FIELDS;
    const view = normalizeView(obj.view as string | undefined);

    return {
        method,
        fields,
        view,
    };
}

/** All query UI variants for a provider (each entry is one `method` option when length > 1). */
export function getExplorerProviderVariants(provider: string | undefined): ExplorerConfig[] {
    if (!provider) {
        return [DEFAULT_EXPLORER_CONFIG];
    }

    const raw = explorerQueryTypes[provider as keyof typeof explorerQueryTypes];

    if (!raw) {
        return [DEFAULT_EXPLORER_CONFIG];
    }

    if (Array.isArray(raw)) {
        return raw.map((item) => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                return normalizeExplorerObject(item as Record<string, unknown>);
            }

            return DEFAULT_EXPLORER_CONFIG;
        });
    }

    return [normalizeExplorerObject(raw as Record<string, unknown>)];
}

export function getExplorerConfig(provider: string | undefined): ExplorerConfig {
    const variants = getExplorerProviderVariants(provider);

    return variants[0] ?? DEFAULT_EXPLORER_CONFIG;
}

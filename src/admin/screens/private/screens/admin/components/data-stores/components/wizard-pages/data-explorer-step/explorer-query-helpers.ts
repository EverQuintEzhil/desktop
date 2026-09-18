import type { Content } from 'vanilla-jsoneditor';

import { showErrorToast } from '@/utils';

import type { ExplorerConfig, ExplorerFieldDef } from './types';

export function formatExplorerFieldLabel(label: string): string {
    if (!label.trim()) return '';

    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Label for the method variant switch (`null` → "Default"). */
export function formatExplorerMethodOptionLabel(method: string | null): string {
    if (method === null) {
        return 'Default';
    }

    return method.charAt(0).toUpperCase() + method.slice(1);
}

export function jsonContentToString(content: Content): string {
    if ('text' in content && typeof content.text === 'string') {
        return content.text;
    }
    if ('json' in content && content.json !== undefined) {
        return JSON.stringify(content.json, null, 2);
    }

    return '';
}

/** Map explore `value.request[field]` to the string stored in query state for that field. */
export function requestValueToExplorerFieldString(value: unknown, field: ExplorerFieldDef): string {
    if (value === undefined || value === null) {
        return '';
    }

    if (field.type === 'single-line-text') {
        return String(value);
    }

    if (typeof value === 'string') {
        return value;
    }

    return JSON.stringify(value, null, field.type === 'full-json' ? 2 : undefined);
}

export const parseOptionalJson = (value: string, errorMessage: string) => {
    if (!value) return undefined;

    try {
        return JSON.parse(value);
    } catch {
        showErrorToast(errorMessage);

        return null;
    }
};

export const buildExplorerRequestData = (
    explorerConfig: ExplorerConfig,
    values: Record<string, string>,
    pageIndex: number,
    pageSize: number,
): Record<string, unknown> | null => {
    if (explorerConfig.method === 'query') {
        const queryText = values.query ?? '';
        const argsParsed = parseOptionalJson(values.args ?? '', 'Invalid args');

        if (argsParsed === null) {
            return null;
        }

        return {
            method: 'query',
            query: queryText,
            args: argsParsed ?? [],
            page: pageIndex,
            size: pageSize,
        };
    }

    if (explorerConfig.method === 'find') {
        const filterStr = values.filter ?? '';
        const projectStr = values.project ?? '';
        const sortStr = values.sort ?? '';

        const parsedFilter = parseOptionalJson(filterStr, 'Invalid filter query');
        const projection = parseOptionalJson(projectStr, 'Invalid project query');
        const parsedSort = parseOptionalJson(sortStr, 'Invalid sort query');

        if (parsedFilter === null || projection === null || parsedSort === null) {
            return null;
        }

        return {
            method: 'find',
            query: parsedFilter,
            projection,
            page: pageIndex,
            size: pageSize,
            sort: parsedSort,
        };
    }

    if (explorerConfig.method === 'aggregate') {
        const acc: Record<string, unknown> = {
            method: 'aggregate',
            page: pageIndex,
            size: pageSize,
        };

        for (const field of explorerConfig.fields) {
            const raw = values[field.label] ?? '';
            const parsed = parseOptionalJson(raw, `Invalid ${field.label}`);

            if (parsed === null) {
                return null;
            }

            acc[field.label] = parsed;
        }

        return acc;
    }

    let merged: Record<string, unknown> = {};

    for (const field of explorerConfig.fields) {
        const raw = values[field.label] ?? '';

        if (field.iterateFullBody) {
            const parsed = parseOptionalJson(raw, 'Invalid request body');

            if (parsed === null) {
                return null;
            }

            if (parsed !== undefined) {
                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                    showErrorToast('Request body must be a JSON object');

                    return null;
                }

                if (field.sendThisValueInBody) {
                    merged = { ...merged, ...parsed, ...parsed[field.label] };
                    delete merged[field.label];
                } else {
                    merged = { ...merged, ...parsed };
                }
            }
        }
    }

    if (explorerConfig.method === null) {
        return {
            ...merged,
        };
    }

    return {
        ...merged,
        page: pageIndex,
        size: pageSize,
    };
};

export const seedQueryValuesFromRequest = (
    prev: Record<string, string>,
    requestEcho: Record<string, unknown>,
    fields: ExplorerFieldDef[],
): Record<string, string> => {
    let next: Record<string, string> | null = null;

    for (const field of fields) {
        if (!field.default) {
            continue;
        }

        if (!field.takeFullResponse && !(field.label in requestEcho)) {
            continue;
        }

        const rawValue = field.takeFullResponse ? requestEcho : requestEcho[field.label];

        const str = requestValueToExplorerFieldString(rawValue, field);

        const prevVal = (next ?? prev)[field.label];

        if (prevVal === str) {
            continue;
        }

        if (!next) {
            next = { ...prev };
        }

        next[field.label] = str;
    }

    return next ?? prev;
};

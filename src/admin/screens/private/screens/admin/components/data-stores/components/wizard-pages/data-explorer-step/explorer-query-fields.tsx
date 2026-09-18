import { type ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { ExplorerFullJsonEditor } from './explorer-full-json-editor';
import { ExplorerJsonLineEditor } from './explorer-json-line-editor';
import { formatExplorerFieldLabel } from './explorer-query-helpers';
import type { ExplorerConfig } from './types';

type ExplorerQueryFieldsProps = {
    explorerConfig: ExplorerConfig;
    queryValues: Record<string, string>;
    loading: boolean;
    layout: 'normal' | 'split';
    setQueryField: (label: string, value: string) => void;
};

export const ExplorerQueryFields = ({
    explorerConfig,
    queryValues,
    loading,
    layout,
    setQueryField,
}: ExplorerQueryFieldsProps) => {
    if (explorerConfig.fields.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">No query parameters are configured for this data source.</p>
        );
    }

    const fieldNodes = explorerConfig.fields.map((field, index) => {
        const fieldId = `data-explorer-${field.label}`;
        const labelText = formatExplorerFieldLabel(field.label);

        const value = queryValues[field.label] ?? '';

        const gapClass = index === 0 ? 'gap-1' : 'gap-2';

        let editor: ReactNode = null;

        if (field.type === 'single-line-json') {
            editor = (
                <ExplorerJsonLineEditor
                    id={fieldId}
                    value={value}
                    onChange={(v) => setQueryField(field.label, v)}
                    placeholder={field.placeholder}
                    readOnly={loading}
                    aria-label={labelText}
                />
            );
        } else if (field.type === 'single-line-text') {
            editor = (
                <Input
                    id={fieldId}
                    value={value}
                    onChange={(e) => setQueryField(field.label, e.target.value)}
                    placeholder={field.placeholder}
                    className="h-8 font-mono text-sm"
                    disabled={loading}
                    aria-label={labelText}
                />
            );
        } else if (field.type === 'full-json') {
            editor = (
                <ExplorerFullJsonEditor
                    id={fieldId}
                    value={value}
                    onChange={(v) => setQueryField(field.label, v)}
                    placeholder={loading ? 'Fetching data...' : field.placeholder}
                    readOnly={loading}
                    aria-label={labelText}
                />
            );
        }

        if (layout === 'split' && field.type === 'full-json') {
            return (
                <div
                    key={field.label}
                    className={cn(
                        'explorer-query-field-split flex min-h-0 min-w-0 flex-1 flex-col gap-2',
                        'overflow-hidden',
                    )}
                >
                    {labelText ? (
                        <label
                            className="shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                            htmlFor={fieldId}
                        >
                            {labelText}
                        </label>
                    ) : null}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{editor}</div>
                </div>
            );
        }

        return (
            <div
                key={field.label}
                className={cn(
                    'data-explorer-query-field grid grid-cols-1 sm:grid-cols-[minmax(5rem,6.5rem)_1fr]',
                    'sm:items-center sm:gap-4',
                    gapClass,
                    index > 0 && 'border-t border-border/40 pt-3 sm:pt-3',
                    field.type === 'full-json' && 'min-h-[min(280px,40vh)] sm:min-h-[min(320px,45vh)] sm:items-start',
                    field.type === 'full-json' && 'data-explorer-query-field-full-json',
                )}
            >
                <label
                    className={cn(
                        'text-xs font-medium tracking-wide text-muted-foreground uppercase',
                        field.type === 'full-json' && 'sm:pt-2',
                    )}
                    htmlFor={fieldId}
                >
                    {labelText}
                </label>
                {field.type === 'full-json' ? <div className="flex min-h-0 min-w-0 flex-col">{editor}</div> : editor}
            </div>
        );
    });

    if (layout === 'split') {
        return <div className="explorer-query-fields flex min-h-0 flex-1 flex-col overflow-hidden">{fieldNodes}</div>;
    }

    return <div className="explorer-query-fields flex flex-col gap-3">{fieldNodes}</div>;
};

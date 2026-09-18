import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { cn } from '@/lib/utils';

import { jsonContentToString } from './explorer-query-helpers';

type ExplorerFullJsonEditorProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    'aria-label': string;
};

/** Multi-line JSON text mode; fills available height (e.g. split view or `full-json` field type). */
export const ExplorerFullJsonEditor = ({
    id,
    value,
    onChange,
    placeholder,
    readOnly = false,
    'aria-label': ariaLabel,
}: ExplorerFullJsonEditorProps) => {
    const showPlaceholder = Boolean(placeholder?.trim()) && !value.trim();

    return (
        <div
            id={id}
            className={cn(
                'data-explorer-json-full group relative flex h-full min-h-0 flex-1 flex-col',
                'scrollbar-controller scrollbar-vertical scrollbar-horizontal',
                'rounded-md border border-input bg-background shadow-xs',
            )}
            aria-label={ariaLabel}
        >
            {showPlaceholder ? (
                <div
                    className={cn(
                        'data-explorer-json-full-placeholder pointer-events-none absolute inset-0 z-1',
                        'flex items-center justify-center p-6 transition-opacity duration-150',
                        'group-focus-within:opacity-0',
                    )}
                    aria-hidden
                >
                    <p
                        className={cn(
                            'max-w-[min(100%,28rem)] text-center text-sm leading-relaxed',
                            'text-muted-foreground',
                        )}
                    >
                        {placeholder}
                    </p>
                </div>
            ) : null}
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                <JSONEditor
                    content={{ text: value }}
                    mode="text"
                    mainMenuBar={true}
                    navigationBar={false}
                    statusBar={false}
                    readOnly={readOnly}
                    className="h-full min-h-0 flex-1"
                    onChange={(content: Content) => {
                        onChange(jsonContentToString(content));
                    }}
                />
            </div>
        </div>
    );
};

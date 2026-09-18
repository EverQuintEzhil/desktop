import { StateEffect } from '@codemirror/state';
import { EditorView, tooltips } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { cn } from '@/lib/utils';

import { jsonContentToString } from './explorer-query-helpers';

type ExplorerJsonLineEditorProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    /** Hint when the field is empty and unfocused (CodeMirror has no native placeholder). */
    placeholder?: string;
    readOnly?: boolean;
    'aria-label': string;
};

/** Single-line height JSON text mode: JSON syntax, same footprint as `Input h-9`. */
export const ExplorerJsonLineEditor = ({
    id,
    value,
    onChange,
    placeholder,
    readOnly = false,
    'aria-label': ariaLabel,
}: ExplorerJsonLineEditorProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [lineFocused, setLineFocused] = useState(false);

    useEffect(() => {
        const el = rootRef.current;

        if (!el) return undefined;

        const blockEnter = (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };

        el.addEventListener('keydown', blockEnter, true);

        return () => {
            el.removeEventListener('keydown', blockEnter, true);
        };
    }, []);

    useEffect(() => {
        const root = rootRef.current;

        if (!root) return undefined;

        const mountTooltipParent = (): boolean => {
            const cm = root.querySelector('.cm-editor');

            if (!cm) return false;

            const view = EditorView.findFromDOM(cm as HTMLElement);

            if (!view) return false;

            const dialogSurface = root.closest('[role="dialog"]');
            const tooltipParent = dialogSurface instanceof HTMLElement ? dialogSurface : document.body;

            view.dispatch({
                effects: StateEffect.appendConfig.of([tooltips({ parent: tooltipParent })]),
            });

            return true;
        };

        if (mountTooltipParent()) return undefined;

        const observer = new MutationObserver(() => {
            if (mountTooltipParent()) observer.disconnect();
        });

        observer.observe(root, { childList: true, subtree: true });
        const timeoutId = window.setTimeout(() => observer.disconnect(), 10_000);

        return () => {
            observer.disconnect();
            window.clearTimeout(timeoutId);
        };
    }, []);

    const showPlaceholder = Boolean(placeholder?.trim()) && !value.trim() && !lineFocused;

    return (
        <div
            ref={rootRef}
            id={id}
            className={cn(
                'data-explorer-json-line relative h-8 max-h-8 min-h-8 w-full min-w-0 overflow-hidden rounded-md',
                'border border-input bg-background shadow-xs',
            )}
            aria-label={ariaLabel}
            onFocusCapture={() => setLineFocused(true)}
            onBlurCapture={() => setLineFocused(false)}
        >
            {showPlaceholder ? (
                <span
                    className={cn(
                        'data-explorer-json-line-placeholder pointer-events-none absolute inset-y-0 right-2 left-2 z-1',
                        'flex items-center truncate font-mono text-sm text-muted-foreground',
                    )}
                    aria-hidden
                >
                    {placeholder}
                </span>
            ) : null}
            <div className="h-full min-h-0 min-w-0">
                <JSONEditor
                    content={{ text: value }}
                    mode="text"
                    mainMenuBar={false}
                    navigationBar={false}
                    statusBar={false}
                    readOnly={readOnly}
                    className="h-full min-h-0 min-w-0"
                    onChange={(content: Content) => {
                        let next = jsonContentToString(content);

                        if (/\r|\n/.test(next)) {
                            next = next.replace(/\r?\n/g, ' ');
                        }

                        onChange(next);
                    }}
                />
            </div>
        </div>
    );
};

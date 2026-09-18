import { autoUpdate, computePosition, flip, offset, shift, type VirtualElement } from '@floating-ui/dom';
import type { PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { ReactRenderer } from '@tiptap/react';
import {
    exitSuggestion,
    type SuggestionKeyDownProps,
    type SuggestionOptions,
    type SuggestionProps,
} from '@tiptap/suggestion';
import type { LucideIcon } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState, type RefObject } from 'react';

import { markEscapeCancelsEdit, unmarkEscapeCancelsEdit } from '@/utils/escape-cancels-edit';

import ComposerTriggerMenu from '../../components/composer-trigger-menu';
import type { ComposerSuggestion, ComposerTriggerState, ComposerTriggerType } from '../../types';

export interface ChatSuggestionItem {
    id: string;
    label: string;
    description?: string;
    section?: string;
    icon: LucideIcon;
    serverUrl?: string;
}

interface SuggestionListRef {
    onKeyDown: (event: KeyboardEvent) => boolean;
}

type RenderLifecycle<I> = NonNullable<SuggestionOptions<I, I>['render']>;

const LOADING_EMPTY_TEXT = 'Searching…';

const computeAndApply = (reference: VirtualElement, element: HTMLElement) => {
    void computePosition(reference, element, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
        Object.assign(element.style, { left: `${x}px`, top: `${y}px` });
    });
};

const createListComponent = <I extends ChatSuggestionItem>(
    menuType: ComposerTriggerType,
    emptyLabelRef?: RefObject<string | null>,
) => {
    const ListComponent = forwardRef<SuggestionListRef, SuggestionProps<I, I>>(
        ({ items, command, query, loading }, ref) => {
            const [activeIndex, setActiveIndex] = useState(0);

            useEffect(() => {
                setActiveIndex(0);
            }, [items]);

            const select = (index: number) => {
                const item = items[index];

                if (item) command(item);
            };

            useImperativeHandle(
                ref,
                () => ({
                    onKeyDown: (event) => {
                        if (items.length > 0) {
                            if (event.key === 'ArrowUp') {
                                setActiveIndex((prev) => (prev + items.length - 1) % items.length);

                                return true;
                            }

                            if (event.key === 'ArrowDown') {
                                setActiveIndex((prev) => (prev + 1) % items.length);

                                return true;
                            }

                            // Shift+Enter is the editor's line break, never a selection.
                            if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
                                select(activeIndex);

                                return true;
                            }

                            return false;
                        }

                        // Nothing to select. Plain Enter is held only while the list is still loading, or
                        // racing an async fetch sends the half-typed trigger as a message; every other key,
                        // Shift+Enter and Tab included, still belongs to the editor.
                        return loading && event.key === 'Enter' && !event.shiftKey;
                    },
                }),
                [items, activeIndex, loading],
            );

            const suggestions: ComposerSuggestion[] = items.map((item, index) => ({
                id: item.id,
                label: item.label,
                description: item.description,
                section: item.section,
                icon: item.icon,
                serverUrl: item.serverUrl,
                onSelect: () => select(index),
            }));

            const triggerState: ComposerTriggerState = {
                type: menuType,
                query,
                start: 0,
                end: 0,
            };

            return (
                <ComposerTriggerMenu
                    triggerState={triggerState}
                    suggestions={suggestions}
                    suggestionsSignature={items.map((item) => item.id).join('\n')}
                    highlightedIndex={activeIndex}
                    onHighlightChange={setActiveIndex}
                    hasCommandOptions
                    hasMentionOptions
                    emptyText={loading ? LOADING_EMPTY_TEXT : (emptyLabelRef?.current ?? undefined)}
                />
            );
        },
    );

    ListComponent.displayName = `ComposerSuggestionList(${menuType})`;

    return ListComponent;
};

export interface ComposerSuggestionRenderOptions {
    pluginKey: PluginKey;
    portalContainerRef?: RefObject<HTMLElement | null>;
    /** Live override for the empty-state label, read at render time so it can change per host state. */
    emptyLabelRef?: RefObject<string | null>;
}

export const createComposerSuggestionRender =
    <I extends ChatSuggestionItem>(
        menuType: ComposerTriggerType,
        { pluginKey, portalContainerRef, emptyLabelRef }: ComposerSuggestionRenderOptions,
    ): RenderLifecycle<I> =>
    () => {
        const ListComponent = createListComponent<I>(menuType, emptyLabelRef);
        let renderer: ReactRenderer<SuggestionListRef, SuggestionProps<I, I>> | null = null;
        let editorDom: HTMLElement | null = null;
        let editorView: EditorView | null = null;
        let stopAutoUpdate: (() => void) | null = null;

        let getClientRect: (() => DOMRect | null) | null = null;
        const reference: VirtualElement = {
            getBoundingClientRect: () => getClientRect?.() ?? new DOMRect(0, 0, 0, 0),
        };

        const handleEditorKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            dismiss();
        };

        const handleEditorBlur = () => {
            dismiss();
        };

        const teardown = () => {
            stopAutoUpdate?.();
            stopAutoUpdate = null;
            editorView = null;
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleEditorKeyDown);
                editorDom.removeEventListener('blur', handleEditorBlur);
                unmarkEscapeCancelsEdit(editorDom);
                editorDom = null;
            }
            if (!renderer) return;
            renderer.element.remove();
            renderer.destroy();
            renderer = null;
        };

        const dismiss = () => {
            if (editorView) exitSuggestion(editorView, pluginKey);
            teardown();
        };

        return {
            onStart: (props) => {
                getClientRect = props.clientRect ?? null;

                editorView = props.editor.view;
                editorDom = props.editor.view.dom as HTMLElement;
                // floating-ui finds scroll ancestors through the reference; a virtual reference has
                // none, so the menu would stay put while a scrolling composer (the assistant panel
                // home) moves under it.
                reference.contextElement = editorDom;
                markEscapeCancelsEdit(editorDom);
                editorDom.addEventListener('keydown', handleEditorKeyDown);
                editorDom.addEventListener('blur', handleEditorBlur);

                renderer = new ReactRenderer(ListComponent, { props, editor: props.editor });

                const element = renderer.element as HTMLElement;

                element.classList.add('chat-editor-suggestion');
                element.style.top = '0';
                element.style.left = '0';
                (portalContainerRef?.current ?? document.body).appendChild(element);

                stopAutoUpdate = autoUpdate(reference, element, () => computeAndApply(reference, element));
            },
            onUpdate: (props) => {
                getClientRect = props.clientRect ?? null;
                renderer?.updateProps(props);

                if (renderer) computeAndApply(reference, renderer.element as HTMLElement);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                    dismiss();

                    return true;
                }

                return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
                teardown();
            },
        };
    };

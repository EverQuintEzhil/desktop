import { autoUpdate, computePosition, flip, offset, shift, type VirtualElement } from '@floating-ui/dom';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { type LucideIcon } from 'lucide-react';
import { forwardRef, type ComponentType, type ReactNode, useEffect, useImperativeHandle, useState } from 'react';

import { cn } from '@/lib/utils';
import { markEscapeCancelsEdit, unmarkEscapeCancelsEdit } from '@/utils/escape-cancels-edit';

import type { MentionSelection } from './extensions/mention';
import type { SlashCommandItem } from './extensions/slash-command';

export interface SuggestionListRef {
    onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashList = forwardRef<SuggestionListRef, SuggestionProps<SlashCommandItem, SlashCommandItem>>(
    ({ items, command }, ref) => {
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
                    if (items.length === 0) return false;

                    if (event.key === 'ArrowUp') {
                        setActiveIndex((prev) => (prev + items.length - 1) % items.length);

                        return true;
                    }

                    if (event.key === 'ArrowDown') {
                        setActiveIndex((prev) => (prev + 1) % items.length);

                        return true;
                    }

                    if (event.key === 'Enter') {
                        select(activeIndex);

                        return true;
                    }

                    return false;
                },
            }),
            [items, activeIndex],
        );

        if (items.length === 0) {
            return <p className="m-0 px-[14px] py-4 text-[13px] text-text-secondary">No results</p>;
        }

        const rowBase =
            'flex items-center gap-2 w-full py-[7px] px-3 bg-transparent border-0' +
            ' cursor-pointer text-[13px] text-(--text-primary) text-left transition-[background] duration-100';

        return (
            <div className="py-1.5" role="listbox" aria-label="Slash commands">
                {items.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = index === activeIndex;

                    return (
                        <button
                            key={item.title}
                            type="button"
                            className={cn(rowBase, isActive && 'bg-surface-hover')}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                select(index);
                            }}
                        >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-secondary">
                                <Icon size={15} aria-hidden="true" />
                            </span>
                            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.title}</span>
                        </button>
                    );
                })}
            </div>
        );
    },
);

SlashList.displayName = 'SlashList';

export interface MentionItem {
    id: string;
    label: string;
    group: string;
    icon: LucideIcon;
}

interface MentionGroup {
    label: string;
    items: MentionItem[];
}

const groupMentionItems = (items: MentionItem[]): MentionGroup[] => {
    const groups: MentionGroup[] = [];
    const indexByLabel = new Map<string, number>();

    items.forEach((item) => {
        const existing = indexByLabel.get(item.group);

        if (existing === undefined) {
            indexByLabel.set(item.group, groups.length);
            groups.push({ label: item.group, items: [item] });

            return;
        }

        groups[existing].items.push(item);
    });

    return groups;
};

const MentionList = forwardRef<SuggestionListRef, SuggestionProps<MentionItem, MentionSelection>>(
    ({ items, command }, ref) => {
        const [activeIndex, setActiveIndex] = useState(0);

        useEffect(() => {
            setActiveIndex(0);
        }, [items]);

        const select = (index: number) => {
            const item = items[index];

            if (item) command({ id: item.id, label: item.label });
        };

        useImperativeHandle(
            ref,
            () => ({
                onKeyDown: (event) => {
                    if (items.length === 0) return false;

                    if (event.key === 'ArrowUp') {
                        setActiveIndex((prev) => (prev + items.length - 1) % items.length);

                        return true;
                    }

                    if (event.key === 'ArrowDown') {
                        setActiveIndex((prev) => (prev + 1) % items.length);

                        return true;
                    }

                    if (event.key === 'Enter') {
                        select(activeIndex);

                        return true;
                    }

                    return false;
                },
            }),
            [items, activeIndex],
        );

        if (items.length === 0) {
            return <p className="m-0 px-[14px] py-4 text-[13px] text-text-secondary">No results</p>;
        }

        let runningIndex = 0;

        const rowBase =
            'flex items-center gap-2 w-full py-[7px] px-3 bg-transparent border-0' +
            ' cursor-pointer text-[13px] text-(--text-primary) text-left transition-[background] duration-100';

        const renderGroup = (group: MentionGroup): ReactNode => {
            const startIndex = runningIndex;

            runningIndex += group.items.length;

            return (
                <div key={group.label} className="mb-0.5">
                    <div className="px-3 pt-1.5 pb-[3px] text-[10px] font-semibold tracking-[0.06em] text-text-secondary uppercase opacity-70">
                        {group.label}
                    </div>
                    {group.items.map((item, localIndex) => {
                        const globalIndex = startIndex + localIndex;
                        const Icon = item.icon;
                        const isActive = globalIndex === activeIndex;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={cn(rowBase, isActive && 'bg-surface-hover')}
                                onMouseEnter={() => setActiveIndex(globalIndex)}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    select(globalIndex);
                                }}
                            >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-secondary">
                                    <Icon size={15} aria-hidden="true" />
                                </span>
                                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            );
        };

        return (
            <div className="py-1.5" role="listbox" aria-label="Mentions">
                {groupMentionItems(items).map(renderGroup)}
            </div>
        );
    },
);

MentionList.displayName = 'MentionList';

type RenderLifecycle<I, T> = NonNullable<SuggestionOptions<I, T>['render']>;

const computeAndApply = (reference: VirtualElement, element: HTMLElement) => {
    void computePosition(reference, element, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
        Object.assign(element.style, {
            left: `${x}px`,
            top: `${y}px`,
        });
    });
};

export const createSuggestionRender =
    <I, T>(
        ListComponent: ComponentType<SuggestionProps<I, T> & { ref?: React.Ref<SuggestionListRef> }>,
    ): RenderLifecycle<I, T> =>
    () => {
        let renderer: ReactRenderer<SuggestionListRef, SuggestionProps<I, T>> | null = null;
        let stopAutoUpdate: (() => void) | null = null;
        let getClientRect: (() => DOMRect | null) | null = null;
        let editorDom: HTMLElement | null = null;
        const reference: VirtualElement = {
            getBoundingClientRect: () => getClientRect?.() ?? new DOMRect(0, 0, 0, 0),
        };

        // Escape closes this popup, not the dialog the editor may be sitting in. Once the dialog has
        // deferred (see `onEscapeKeyDown` on its `DialogContent`) the event is `defaultPrevented`, and
        // `prosemirror-view`'s `eventBelongsToView` drops every defaultPrevented event — so the
        // suggestion plugin's own `handleKeyDown` below never runs in that case. This listener is the
        // dismissal path for a popup inside a dialog; the plugin hook is the path outside one.
        const handleEditorKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            teardown();
        };

        // Safe to call more than once: the plugin's `onExit` fires after a dismissal this module
        // already handled, and the un-marking must not be stranded behind the `renderer` guard.
        const teardown = () => {
            stopAutoUpdate?.();
            stopAutoUpdate = null;
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleEditorKeyDown);
                unmarkEscapeCancelsEdit(editorDom);
                editorDom = null;
            }
            if (!renderer) return;
            renderer.element.remove();
            renderer.destroy();
            renderer = null;
        };

        return {
            onStart: (props) => {
                getClientRect = props.clientRect ?? null;

                editorDom = props.editor.view.dom as HTMLElement;
                markEscapeCancelsEdit(editorDom);
                editorDom.addEventListener('keydown', handleEditorKeyDown);

                renderer = new ReactRenderer(ListComponent, {
                    props,
                    editor: props.editor,
                });

                const element = renderer.element as HTMLElement;

                element.classList.add('ca-suggest__popover');
                element.style.position = 'fixed';
                element.style.top = '0';
                element.style.left = '0';
                document.body.appendChild(element);

                stopAutoUpdate = autoUpdate(reference, element, () => computeAndApply(reference, element));
            },
            onUpdate: (props) => {
                getClientRect = props.clientRect ?? null;
                renderer?.updateProps(props);

                if (renderer) computeAndApply(reference, renderer.element as HTMLElement);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                    teardown();

                    return true;
                }

                return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
                teardown();
            },
        };
    };

export const slashRender = createSuggestionRender<SlashCommandItem, SlashCommandItem>(SlashList);
export const mentionRender = createSuggestionRender<MentionItem, MentionSelection>(MentionList);

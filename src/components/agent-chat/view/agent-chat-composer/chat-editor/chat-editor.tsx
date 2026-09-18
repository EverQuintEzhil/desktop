import type { Editor } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import {
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type Ref,
} from 'react';
import { createPortal } from 'react-dom';

import { DirectiveTooltipContent } from '@/components/chat/primitives/directive-tooltip-content';
import { usePortalContainer } from '@/components/ui/portal-container';
import { buildConnectorFaviconUrl } from '@/lib/chat/connector-favicon';
import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import { cn } from '@/lib/utils';
import type { PlusDropdownOption } from '@/types/chat';
import { extractVariables, type VariableInfo } from '@/utils/variable-parser';

import { ChatKeymap } from './extensions/chat-keymap';
import { chatSchema } from './extensions/chat-schema';
import { ComposerEscape } from './extensions/composer-escape';
import { DirectiveMention } from './extensions/directive-mention';
import { SubmitKeymap } from './extensions/submit-keymap';
import { VariableHighlight } from './extensions/variable-highlight';
import { buildDoc, buildInlineContent, findVariableRanges, getEditorText } from './serialize';
import { createCommandExtension } from './suggestion/command-suggestion';
import { createMentionExtension, type MentionItemsProvider } from './suggestion/mention-suggestion';
import './chat-editor.scss';

export interface ChatEditorRef {
    changeText: (value: string) => void;
    focus: () => void;
    focusAtEnd: () => void;
    focusStart: () => void;
    getText: () => string;
    replaceVariable: (name: string, value: string) => void;
    element: HTMLElement | null;
}

export interface ChatEditorProps {
    value?: string;
    onChange?: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    onEnter?: () => boolean;
    onEscape?: () => boolean;
    onPasteText?: (text: string) => boolean;
    onFocus?: () => void;
    onBlur?: () => void;
    autoFocus?: boolean;
    disabled?: boolean;
    placeholder?: string;
    onVariablesChange?: (variables: VariableInfo[]) => void;
    onVariableClick?: (name: string, position: { x: number; y: number }) => void;
    variableTooltip?: string;
    /** Static "@" list. Hosts that search a server pass `mentionItemsProvider` instead. */
    mentionItems?: DirectiveSuggestionBase[];
    /** Replaces the "No mentions found" empty text while set (e.g. no agent picked yet). */
    mentionEmptyLabel?: string;
    /** Server-searched alternative to `mentionItems`: called per "@" query (decided at mount). */
    mentionItemsProvider?: MentionItemsProvider;
    /** Set false for a host with no mention source at all, so "@" stays plain text (decided at mount). */
    mentionsEnabled?: boolean;
    /** Omit both command props to run without the "/" trigger (decided at mount). */
    commandOptions?: PlusDropdownOption[];
    onCommandSelect?: (option: PlusDropdownOption) => void;
    /** `{{variable}}` decoration; off for hosts whose text has no variable semantics (decided at mount). */
    variableHighlight?: boolean;
    /** Applied to the contenteditable itself, so a form `<Label htmlFor>` can name it. */
    id?: string;
    ariaInvalid?: boolean;
    className?: string;
    ref?: Ref<ChatEditorRef>;
}

const NO_MENTION_ITEMS: DirectiveSuggestionBase[] = [];

interface HoveredDirective {
    type: string;
    id: string;
    label: string;
    position: { x: number; y: number };
}

const ChatEditor = ({
    value,
    onChange,
    onKeyDown,
    onEnter,
    onEscape,
    onPasteText,
    onFocus,
    onBlur,
    autoFocus = false,
    disabled = false,
    placeholder,
    onVariablesChange,
    onVariableClick,
    variableTooltip = 'Click to edit this variable',
    mentionItems = NO_MENTION_ITEMS,
    mentionEmptyLabel,
    mentionItemsProvider,
    mentionsEnabled = true,
    commandOptions,
    onCommandSelect,
    variableHighlight = true,
    id,
    ariaInvalid,
    className,
    ref,
}: ChatEditorProps) => {
    const portalContainer = usePortalContainer();
    const [hoveredDirective, setHoveredDirective] = useState<HoveredDirective | null>(null);

    const mentionItemsRef = useRef(mentionItems);
    const mentionEmptyLabelRef = useRef<string | null>(mentionEmptyLabel ?? null);
    const mentionItemsProviderRef = useRef(mentionItemsProvider);
    const commandOptionsRef = useRef<PlusDropdownOption[]>(commandOptions ?? []);
    const onCommandSelectRef = useRef<(option: PlusDropdownOption) => void>(onCommandSelect ?? (() => {}));
    const onChangeRef = useRef(onChange);
    const onVariablesChangeRef = useRef(onVariablesChange);
    const onPasteTextRef = useRef(onPasteText);
    const onVariableClickRef = useRef(onVariableClick);
    const onEnterRef = useRef(onEnter);
    const onEscapeRef = useRef(onEscape);
    const placeholderRef = useRef(placeholder);

    mentionItemsRef.current = mentionItems;
    mentionEmptyLabelRef.current = mentionEmptyLabel ?? null;
    mentionItemsProviderRef.current = mentionItemsProvider;
    commandOptionsRef.current = commandOptions ?? [];
    onCommandSelectRef.current = onCommandSelect ?? (() => {});
    onChangeRef.current = onChange;
    onVariablesChangeRef.current = onVariablesChange;
    onPasteTextRef.current = onPasteText;
    onVariableClickRef.current = onVariableClick;
    onEnterRef.current = onEnter;
    onEscapeRef.current = onEscape;
    placeholderRef.current = placeholder;

    const portalContainerRef = useRef<HTMLElement | null>(null);

    portalContainerRef.current = portalContainer;

    const editorRef = useRef<Editor | null>(null);
    const lastEmittedTextRef = useRef(value ?? '');

    const emitVariables = useCallback((text: string) => {
        onVariablesChangeRef.current?.(extractVariables(text));
    }, []);

    const resolveFavicon = useCallback((type: string, id: string): string | null => {
        if (type !== 'mcp') return null;
        const serverUrl = mentionItemsRef.current.find((item) => item.type === type && item.id === id)?.serverUrl;

        if (!serverUrl) return null;

        return buildConnectorFaviconUrl(serverUrl, 32) ?? null;
    }, []);

    const descriptionByKey = useMemo(() => {
        const map = new Map<string, string | undefined>();

        mentionItems.forEach((item) => map.set(`${item.type}:${item.id}`, item.description));

        return map;
    }, [mentionItems]);

    const editor = useEditor({
        extensions: [
            chatSchema,
            ChatKeymap,
            DirectiveMention,
            ...(variableHighlight ? [VariableHighlight.configure({ variableTooltip })] : []),
            Placeholder.configure({
                placeholder: () => placeholderRef.current ?? '',
                showOnlyWhenEditable: false,
            }),
            SubmitKeymap.configure({ onEnter: () => onEnterRef.current?.() ?? false }),
            ComposerEscape.configure({ onEscape: () => onEscapeRef.current?.() ?? false }),
            ...(mentionsEnabled
                ? [
                      createMentionExtension({
                          mentionItemsRef,
                          portalContainerRef,
                          emptyLabelRef: mentionEmptyLabelRef,
                          ...(mentionItemsProvider ? { itemsProviderRef: mentionItemsProviderRef } : {}),
                      }),
                  ]
                : []),
            ...(onCommandSelect
                ? [createCommandExtension({ commandOptionsRef, onCommandSelectRef, portalContainerRef })]
                : []),
        ],
        content: buildDoc(value ?? '', resolveFavicon),
        immediatelyRender: false,
        autofocus: autoFocus ? 'end' : false,
        editorProps: {
            attributes: { class: 'chat-editor__content scrollbar-controller scrollbar-vertical' },
            handlePaste: (_view, event) => {
                const text = event.clipboardData?.getData('text/plain') ?? '';

                if (text && onPasteTextRef.current?.(text)) {
                    return true;
                }

                const html = event.clipboardData?.getData('text/html') ?? '';

                if (text && html && !html.includes('data-pm-slice')) {
                    editorRef.current?.commands.insertContent(buildInlineContent(text, resolveFavicon));

                    return true;
                }

                return false;
            },
        },
        onUpdate: ({ editor: instance }) => {
            const text = getEditorText(instance);

            // A drop lands content without focusing first, so a focus gate loses it.
            if (text === lastEmittedTextRef.current) return;

            lastEmittedTextRef.current = text;
            onChangeRef.current?.(text);
            onVariablesChangeRef.current?.(extractVariables(text));
        },
        onFocus: () => onFocus?.(),
        onBlur: () => onBlur?.(),
    });

    editorRef.current = editor;

    useEffect(() => {
        if (!editor) return;
        const next = value ?? '';

        if (getEditorText(editor) === next) return;

        lastEmittedTextRef.current = next;
        editor.commands.setContent(buildDoc(next, resolveFavicon), { emitUpdate: false });
        emitVariables(next);
    }, [value, editor, resolveFavicon, emitVariables]);

    useEffect(() => {
        if (!editor) return;
        emitVariables(getEditorText(editor));
    }, [editor, emitVariables]);

    useEffect(() => {
        if (!editor) return;
        if (editor.isEditable === !disabled) return;
        editor.setEditable(!disabled, false);
    }, [editor, disabled]);

    useEffect(() => {
        if (!editor) return;
        // @tiptap/suggestion re-runs items() only when the query, text or range changes, so an open menu
        // keeps whatever list it opened with. Hosts whose list arrives late pass `mentionItemsProvider`.
        editor.view.dispatch(editor.state.tr);
    }, [editor, placeholder, mentionItems]);

    // ProseMirror owns the contenteditable element, so form attributes go on imperatively.
    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom as HTMLElement;

        if (id) dom.setAttribute('id', id);
        else dom.removeAttribute('id');

        if (ariaInvalid) dom.setAttribute('aria-invalid', 'true');
        else dom.removeAttribute('aria-invalid');
    }, [editor, id, ariaInvalid]);

    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom;

        const handleHover = (event: MouseEvent) => {
            const target = (event.target as HTMLElement).closest('.directive-highlight');

            if (!(target instanceof HTMLElement)) return;
            const type = target.getAttribute('data-directive-type');
            const id = target.getAttribute('data-directive-id');
            const label = target.getAttribute('data-directive-label');

            if (!type || !id || !label) return;
            const rect = target.getBoundingClientRect();

            setHoveredDirective({
                type,
                id,
                label,
                position: { x: rect.left, y: rect.top - 8 },
            });
        };

        const handleLeave = (event: MouseEvent) => {
            const target = (event.target as HTMLElement).closest('.directive-highlight');
            const related = event.relatedTarget as Node | null;

            if (target && !target.contains(related)) {
                setHoveredDirective(null);
            }
        };

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            if (!target.classList.contains('variable-highlight')) return;
            const name = target.getAttribute('data-variable');

            if (!name) return;
            event.preventDefault();
            const rect = target.getBoundingClientRect();

            onVariableClickRef.current?.(name, { x: rect.left, y: rect.bottom + 8 });
        };

        dom.addEventListener('mouseover', handleHover);
        dom.addEventListener('mouseout', handleLeave);
        dom.addEventListener('click', handleClick);

        return () => {
            dom.removeEventListener('mouseover', handleHover);
            dom.removeEventListener('mouseout', handleLeave);
            dom.removeEventListener('click', handleClick);
        };
    }, [editor]);

    useImperativeHandle(
        ref,
        () => ({
            changeText: (next: string) => {
                // `emitUpdate: false` skips onUpdate, so record it here or a later edit back to this
                // value reads as unchanged and never reaches the host.
                lastEmittedTextRef.current = next;
                editor?.commands.setContent(buildDoc(next, resolveFavicon), { emitUpdate: false });
                emitVariables(next);
            },
            focus: () => {
                editor?.commands.focus();
            },
            focusAtEnd: () => {
                editor?.commands.focus('end');
            },
            focusStart: () => {
                editor?.commands.focus('start');
            },
            getText: () => (editor ? getEditorText(editor) : ''),
            replaceVariable: (name: string, replacement: string) => {
                if (!editor) return;
                const ranges = findVariableRanges(editor, name);

                if (ranges.length === 0) return;

                const chain = editor.chain().focus();

                ranges
                    .slice()
                    .reverse()
                    .forEach((range) => {
                        if (replacement.length === 0) {
                            chain.deleteRange(range);

                            return;
                        }

                        chain.insertContentAt(range, { type: 'text', text: replacement });
                    });

                if (replacement.length > 0) {
                    chain.setTextSelection({ from: ranges[0].from, to: ranges[0].from + replacement.length });
                }

                chain.run();
            },
            element: editor ? (editor.view.dom as HTMLElement) : null,
        }),
        [editor, resolveFavicon],
    );

    const handleKeyDown = (event: KeyboardEvent) => {
        setHoveredDirective(null);
        onKeyDown?.(event);
    };

    const renderTooltip = () => {
        if (!hoveredDirective || typeof document === 'undefined') return null;
        const description = descriptionByKey.get(`${hoveredDirective.type}:${hoveredDirective.id}`);

        return createPortal(
            <DirectiveTooltipContent
                description={description}
                type={hoveredDirective.type}
                label={hoveredDirective.label}
                className="pointer-events-none fixed z-9999 mb-1 w-60 cursor-default"
                style={{
                    left: hoveredDirective.position.x,
                    top: hoveredDirective.position.y,
                    transform: 'translateY(-100%)',
                }}
            />,
            portalContainer ?? document.body,
        );
    };

    return (
        <div className={cn('chat-editor notranslate', className)}>
            <EditorContent editor={editor} onKeyDown={handleKeyDown} />
            {renderTooltip()}
        </div>
    );
};

ChatEditor.displayName = 'ChatEditor';

export default ChatEditor;

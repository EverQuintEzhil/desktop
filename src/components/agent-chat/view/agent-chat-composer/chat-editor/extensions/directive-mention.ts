import { mergeAttributes, Node, type Range, Editor } from '@tiptap/core';

import { formatDirectiveText } from '@/lib/chat/directives';

import { asOwnUndoStep } from './history-step';

export const DIRECTIVE_MENTION_NAME = 'directiveMention';

export interface DirectiveMentionAttrs {
    directiveType: string;
    label: string;
    id: string;
    favicon: string | null;
}

export const DirectiveMention = Node.create({
    name: DIRECTIVE_MENTION_NAME,

    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
        return {
            directiveType: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-directive-type') ?? '',
                renderHTML: (attributes) => ({ 'data-directive-type': attributes.directiveType }),
            },
            label: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-directive-label') ?? '',
                renderHTML: (attributes) => ({ 'data-directive-label': attributes.label }),
            },
            id: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-directive-id') ?? '',
                renderHTML: (attributes) => ({ 'data-directive-id': attributes.id }),
            },
            favicon: {
                default: null,
                parseHTML: () => null,
                renderHTML: (attributes) =>
                    attributes.favicon ? { style: `--favicon: url('${attributes.favicon}')` } : {},
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span.directive-highlight' }];
    },

    renderHTML({ node, HTMLAttributes }) {
        const hasFavicon = typeof node.attrs.favicon === 'string' && node.attrs.favicon.length > 0;

        return [
            'span',
            mergeAttributes(HTMLAttributes, {
                class: `directive-highlight cursor-pointer text-primary${hasFavicon ? ' has-favicon' : ''}`,
                contenteditable: 'false',
            }),
            String(node.attrs.label),
        ];
    },

    renderText({ node }) {
        return formatDirectiveText(node.attrs.directiveType, node.attrs.label, node.attrs.id);
    },
});

export const insertDirective = (editor: Editor, range: Range, attrs: DirectiveMentionAttrs): void => {
    asOwnUndoStep(editor, () =>
        editor
            .chain()
            .focus()
            .insertContentAt(range, [
                { type: DIRECTIVE_MENTION_NAME, attrs },
                { type: 'text', text: ' ' },
            ])
            .run(),
    );
};

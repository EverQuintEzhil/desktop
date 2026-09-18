import { mergeAttributes, Node } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

import type { MentionItem } from '../suggestion-popup';

export interface MentionSelection {
    id: string;
    label: string;
}

export interface MentionOptions {
    suggestion: Omit<SuggestionOptions<MentionItem, MentionSelection>, 'editor'>;
}

export const Mention = Node.create<MentionOptions>({
    name: 'mention',

    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return {
            suggestion: {
                char: '@',
                command: ({ editor, range, props }) => {
                    editor
                        .chain()
                        .focus()
                        .insertContentAt(range, [
                            { type: this.name, attrs: { id: props.id, label: props.label } },
                            { type: 'text', text: ' ' },
                        ])
                        .run();
                },
            },
        };
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-id'),
                renderHTML: (attributes) => (attributes.id ? { 'data-id': attributes.id } : {}),
            },
            label: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-label'),
                renderHTML: (attributes) => (attributes.label ? { 'data-label': attributes.label } : {}),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-mention]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            'span',
            mergeAttributes({ 'data-mention': '', class: 'ca-instr-mention' }, HTMLAttributes),
            `@${node.attrs.label}`,
        ];
    },

    renderText({ node }) {
        return `@${node.attrs.label}`;
    },

    renderMarkdown(node) {
        return `@${node.attrs?.label ?? ''}`;
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '@',
                ...this.options.suggestion,
                pluginKey: new PluginKey('mention'),
            }),
        ];
    },
});

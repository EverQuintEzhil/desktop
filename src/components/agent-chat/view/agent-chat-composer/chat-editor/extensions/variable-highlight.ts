import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface VariableHighlightOptions {
    variableTooltip: string;
}

const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
const variableHighlightPluginKey = new PluginKey('chatEditorVariableHighlight');

const buildDecorations = (state: EditorState, tooltip: string): DecorationSet => {
    const decorations: Decoration[] = [];

    state.doc.descendants((node: ProseMirrorNode, pos: number) => {
        if (!node.isText || !node.text) {
            return;
        }

        const text = node.text;
        let match: RegExpExecArray | null;

        VARIABLE_REGEX.lastIndex = 0;

        while ((match = VARIABLE_REGEX.exec(text)) !== null) {
            const from = pos + match.index;
            const to = from + match[0].length;

            decorations.push(
                Decoration.inline(from, to, {
                    class: 'variable-highlight',
                    'data-variable': match[1].trim(),
                    title: tooltip,
                }),
            );
        }
    });

    return DecorationSet.create(state.doc, decorations);
};

export const VariableHighlight = Extension.create<VariableHighlightOptions>({
    name: 'chatEditorVariableHighlight',

    addOptions() {
        return {
            variableTooltip: 'Click to edit this variable',
        };
    },

    addProseMirrorPlugins() {
        const tooltip = this.options.variableTooltip;

        return [
            new Plugin({
                key: variableHighlightPluginKey,
                props: {
                    decorations: (state) => buildDecorations(state, tooltip),
                },
            }),
        ];
    },
});

import type { Editor, JSONContent } from '@tiptap/core';

import { formatDirectiveText, parseDirectiveText, type DirectiveSegment } from '@/lib/chat/directives';
import { extractVariables } from '@/utils/variable-parser';

import { DIRECTIVE_MENTION_NAME } from './extensions/directive-mention';

const BLOCK_SEPARATOR = '\n';

export type DirectiveFaviconResolver = (type: string, id: string) => string | null;

const buildParagraphContent = (
    segments: DirectiveSegment[],
    resolveFavicon?: DirectiveFaviconResolver,
): JSONContent[] => {
    const content: JSONContent[] = [];

    segments.forEach((segment) => {
        if (segment.type === 'directive') {
            content.push({
                type: DIRECTIVE_MENTION_NAME,
                attrs: {
                    directiveType: segment.directive.type,
                    label: segment.directive.label,
                    id: segment.directive.id,
                    favicon: resolveFavicon?.(segment.directive.type, segment.directive.id) ?? null,
                },
            });

            return;
        }

        segment.text.split('\n').forEach((line, index) => {
            if (index > 0) {
                content.push({ type: 'hardBreak' });
            }

            if (line.length > 0) {
                content.push({ type: 'text', text: line });
            }
        });
    });

    return content;
};

export const buildInlineContent = (value: string, resolveFavicon?: DirectiveFaviconResolver): JSONContent[] =>
    buildParagraphContent(parseDirectiveText(value), resolveFavicon);

export const buildDoc = (value: string, resolveFavicon?: DirectiveFaviconResolver): JSONContent => {
    const content = buildParagraphContent(parseDirectiveText(value), resolveFavicon);

    return {
        type: 'doc',
        content: [content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' }],
    };
};

const inlineNodeToText = (node: JSONContent): string => {
    if (node.type === DIRECTIVE_MENTION_NAME) {
        const attrs = node.attrs ?? {};

        return formatDirectiveText(
            String(attrs.directiveType ?? ''),
            String(attrs.label ?? ''),
            String(attrs.id ?? ''),
        );
    }

    if (node.type === 'hardBreak') {
        return '\n';
    }

    if (node.type === 'text') {
        return node.text ?? '';
    }

    return '';
};

export const docToText = (doc: JSONContent): string => {
    const blocks = doc.content ?? [];

    return blocks.map((block) => (block.content ?? []).map(inlineNodeToText).join('')).join(BLOCK_SEPARATOR);
};

export const getEditorText = (editor: Editor): string => editor.getText({ blockSeparator: BLOCK_SEPARATOR });

export const serializedOffsetToPos = (editor: Editor, offset: number): number | null => {
    const doc = editor.state.doc;
    let serial = 0;
    let result: number | null = null;

    doc.descendants((node, pos) => {
        if (result !== null) {
            return false;
        }

        if (node.isBlock && pos > 0) {
            serial += BLOCK_SEPARATOR.length;
        }

        if (node.type.name === 'text') {
            const length = node.text?.length ?? 0;

            if (offset >= serial && offset <= serial + length) {
                result = pos + (offset - serial);

                return false;
            }

            serial += length;
        } else if (node.type.name === DIRECTIVE_MENTION_NAME) {
            serial += formatDirectiveText(node.attrs.directiveType, node.attrs.label, node.attrs.id).length;
        } else if (node.type.name === 'hardBreak') {
            serial += 1;
        }

        return true;
    });

    if (result === null && offset >= serial) {
        return doc.content.size;
    }

    return result;
};

export const findVariableRanges = (editor: Editor, name: string): { from: number; to: number }[] => {
    const text = getEditorText(editor);
    const wanted = name.trim();
    const ranges: { from: number; to: number }[] = [];

    extractVariables(text)
        .filter((entry) => entry.name === wanted)
        .forEach((variable) => {
            const from = serializedOffsetToPos(editor, variable.startIndex);
            const to = serializedOffsetToPos(editor, variable.endIndex);
            const limit = editor.state.doc.content.size;

            if (from === null || to === null) return;
            if (from < 0 || to > limit || from >= to) return;

            ranges.push({ from, to });
        });

    return ranges;
};

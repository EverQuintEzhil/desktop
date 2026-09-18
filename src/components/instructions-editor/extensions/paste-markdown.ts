import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

const MARKDOWN_SIGNALS: RegExp[] = [
    /^#{1,6}\s+\S/m,
    /^\s*[-*]\s+\S/m,
    /^\s*\d+\.\s+\S/m,
    /^\s*>\s+\S/m,
    /^```/m,
    /\*\*[^*]+\*\*/,
    /~~[^~]+~~/,
    /`[^`]+`/,
    /\[[^\]]+\]\([^)\s]+\)/,
];

const looksLikeMarkdown = (text: string): boolean => MARKDOWN_SIGNALS.some((re) => re.test(text));

export const PasteMarkdown = Extension.create({
    name: 'pasteMarkdown',

    addProseMirrorPlugins() {
        const { editor } = this;

        return [
            new Plugin({
                props: {
                    handlePaste: (_view, event) => {
                        const text = event.clipboardData?.getData('text/plain');

                        if (!text || !looksLikeMarkdown(text)) return false;

                        const json = editor.markdown?.parse(text);

                        if (!json) return false;

                        editor.commands.insertContent(json);

                        return true;
                    },
                },
            }),
        ];
    },
});

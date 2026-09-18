import { Extension, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import {
    Code2,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Minus,
    Pilcrow,
    Quote,
    type LucideIcon,
} from 'lucide-react';

export interface SlashCommandItem {
    title: string;
    aliases?: string[];
    icon: LucideIcon;
    command: (props: { editor: Editor; range: Range }) => void;
}

const SLASH_ITEMS: SlashCommandItem[] = [
    {
        title: 'Text',
        aliases: ['paragraph', 'plain', 'p'],
        icon: Pilcrow,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
        title: 'Heading 1',
        aliases: ['h1', 'title', 'big'],
        icon: Heading1,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
    },
    {
        title: 'Heading 2',
        aliases: ['h2', 'subtitle'],
        icon: Heading2,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
    },
    {
        title: 'Heading 3',
        aliases: ['h3'],
        icon: Heading3,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
    },
    {
        title: 'Bullet list',
        aliases: ['unordered', 'ul', 'bullets'],
        icon: List,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
        title: 'Numbered list',
        aliases: ['ordered', 'ol', 'numbers'],
        icon: ListOrdered,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
        title: 'Quote',
        aliases: ['blockquote', 'citation'],
        icon: Quote,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
        title: 'Code block',
        aliases: ['code', 'pre', 'snippet'],
        icon: Code2,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
        title: 'Divider',
        aliases: ['hr', 'rule', 'separator', 'line'],
        icon: Minus,
        command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
];

const matchesQuery = (item: SlashCommandItem, query: string): boolean => {
    const needle = query.toLowerCase();

    if (item.title.toLowerCase().includes(needle)) return true;

    return (item.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle));
};

export const getSlashItems = ({ query }: { query: string }): SlashCommandItem[] => {
    if (!query) return SLASH_ITEMS;

    return SLASH_ITEMS.filter((item) => matchesQuery(item, query));
};

export interface SlashCommandOptions {
    suggestion: Omit<SuggestionOptions<SlashCommandItem, SlashCommandItem>, 'editor'>;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                command: ({ editor, range, props }) => {
                    props.command({ editor, range });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                char: '/',
                ...this.options.suggestion,
                pluginKey: new PluginKey('slashCommand'),
            }),
        ];
    },
});

import { Placeholder } from '@tiptap/extensions';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import {
    BlocksIcon,
    Bold,
    BotIcon,
    Code,
    FileTextIcon,
    GlobeIcon,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    Link,
    List,
    ListOrdered,
    PackageIcon,
    Strikethrough,
    Unlink,
    WrenchIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { MarkdownLiteralEntities } from './extensions/markdown-literal-entities';
import { Mention } from './extensions/mention';
import { PasteMarkdown } from './extensions/paste-markdown';
import { getSlashItems, SlashCommand } from './extensions/slash-command';
import { mentionRender, slashRender, type MentionItem } from './suggestion-popup';

const INLINE_PLACEHOLDER = "Type '/' for commands or '@' to mention";

interface AttachmentRef {
    _id: string;
    name: string;
}

interface EditorAttachments {
    files?: AttachmentRef[];
    skills?: AttachmentRef[];
    mcpServers?: AttachmentRef[];
    tools?: AttachmentRef[];
    agents?: AttachmentRef[];
}

interface InstructionsEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    attachments?: EditorAttachments;
    onBlur?: () => void;
    enableMentions?: boolean;
    readOnly?: boolean;
    className?: string;
    contentClassName?: string;
    editorClassName?: string;
    autoFocus?: boolean;
}

const STATIC_TOOL_ITEMS: MentionItem[] = [
    {
        id: 'tool-web-search',
        label: 'Web search',
        group: 'Tools',
        icon: GlobeIcon,
    },
];

const buildMentionItems = (attachments?: EditorAttachments): MentionItem[] => {
    const files = (attachments?.files ?? []).map((file): MentionItem => ({
        id: `ds-${file._id}`,
        label: file.name,
        group: 'Data Stores',
        icon: FileTextIcon,
    }));
    const skills = (attachments?.skills ?? []).map((skill): MentionItem => ({
        id: `skill-${skill._id}`,
        label: skill.name,
        group: 'Skills',
        icon: PackageIcon,
    }));
    const mcps = (attachments?.mcpServers ?? []).map((mcp): MentionItem => ({
        id: `mcp-${mcp._id}`,
        label: mcp.name,
        group: 'Connectors',
        icon: BlocksIcon,
    }));
    const tools = (attachments?.tools ?? []).map((tool): MentionItem => ({
        id: `tool-${tool._id}`,
        label: tool.name,
        group: 'Tools',
        icon: WrenchIcon,
    }));
    const agents = (attachments?.agents ?? []).map((agent): MentionItem => ({
        id: `agent-${agent._id}`,
        label: agent.name,
        group: 'Agents',
        icon: BotIcon,
    }));

    return [...files, ...skills, ...mcps, ...STATIC_TOOL_ITEMS, ...tools, ...agents];
};

interface ToggleButtonParams {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
}

const decodeMarkdownEscapes = (text: string): string => text.replace(/\\_/g, '_');

const editorToMarkdown = (editor: Editor): string =>
    editor.isEmpty ? '' : decodeMarkdownEscapes(editor.getMarkdown());

interface SelectionToolbarProps {
    editor: Editor;
}

const SelectionToolbar = ({ editor }: SelectionToolbarProps) => {
    const onSetLink = useCallback(() => {
        const previous = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Enter URL', previous || 'https://');

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();

            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    const onUnsetLink = useCallback(() => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }, [editor]);

    const renderToggleButton = (params: ToggleButtonParams) => {
        const { label, icon, isActive, onClick, disabled } = params;

        return (
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                aria-pressed={isActive}
                data-active={isActive}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={onClick}
            >
                {icon}
            </Button>
        );
    };

    const renderSeparator = (key: string) => (
        <span key={key} className="mx-0.5 inline-block h-[18px] w-px bg-border" aria-hidden="true" />
    );

    return (
        <div
            className={cn(
                'flex items-center gap-1 rounded-(--radius) border border-border bg-background p-1',
                "shadow-[0_8px_24px_rgb(0_0_0/18%)] **:data-[active='true']:bg-surface-hover **:data-[active='true']:text-primary",
            )}
        >
            {renderToggleButton({
                label: 'Bold',
                icon: <Bold />,
                isActive: editor.isActive('bold'),
                onClick: () => editor.chain().focus().toggleBold().run(),
            })}
            {renderToggleButton({
                label: 'Italic',
                icon: <Italic />,
                isActive: editor.isActive('italic'),
                onClick: () => editor.chain().focus().toggleItalic().run(),
            })}
            {renderToggleButton({
                label: 'Strikethrough',
                icon: <Strikethrough />,
                isActive: editor.isActive('strike'),
                onClick: () => editor.chain().focus().toggleStrike().run(),
            })}
            {renderToggleButton({
                label: 'Inline code',
                icon: <Code />,
                isActive: editor.isActive('code'),
                onClick: () => editor.chain().focus().toggleCode().run(),
            })}
            {renderSeparator('sep-marks')}
            {renderToggleButton({
                label: 'Heading 1',
                icon: <Heading1 />,
                isActive: editor.isActive('heading', { level: 1 }),
                onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            })}
            {renderToggleButton({
                label: 'Heading 2',
                icon: <Heading2 />,
                isActive: editor.isActive('heading', { level: 2 }),
                onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            })}
            {renderToggleButton({
                label: 'Heading 3',
                icon: <Heading3 />,
                isActive: editor.isActive('heading', { level: 3 }),
                onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            })}
            {renderSeparator('sep-headings')}
            {renderToggleButton({
                label: 'Bullet list',
                icon: <List />,
                isActive: editor.isActive('bulletList'),
                onClick: () => editor.chain().focus().toggleBulletList().run(),
            })}
            {renderToggleButton({
                label: 'Ordered list',
                icon: <ListOrdered />,
                isActive: editor.isActive('orderedList'),
                onClick: () => editor.chain().focus().toggleOrderedList().run(),
            })}
            {renderSeparator('sep-lists')}
            {renderToggleButton({
                label: 'Add link',
                icon: <Link />,
                isActive: editor.isActive('link'),
                onClick: onSetLink,
            })}
            {renderToggleButton({
                label: 'Remove link',
                icon: <Unlink />,
                isActive: false,
                disabled: !editor.isActive('link'),
                onClick: onUnsetLink,
            })}
        </div>
    );
};

export const InstructionsEditor = ({
    value,
    onChange,
    placeholder,
    attachments,
    onBlur,
    enableMentions,
    readOnly,
    className,
    contentClassName,
    editorClassName,
    autoFocus,
}: InstructionsEditorProps) => {
    const mentionItemsRef = useRef<MentionItem[]>([]);

    mentionItemsRef.current = useMemo(() => buildMentionItems(attachments), [attachments]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                link: {
                    openOnClick: false,
                    autolink: true,
                    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
                },
            }),
            MarkdownLiteralEntities,
            Placeholder.configure({
                placeholder: ({ editor: instance, pos }) =>
                    instance.isEmpty && pos === 0
                        ? (placeholder ?? 'Write the agent instructions...')
                        : INLINE_PLACEHOLDER,
            }),
            SlashCommand.configure({
                suggestion: {
                    char: '/',
                    items: getSlashItems,
                    render: slashRender,
                    command: ({ editor: instance, range, props }) => {
                        props.command({ editor: instance, range });
                    },
                },
            }),
            ...(enableMentions === false
                ? []
                : [
                      Mention.configure({
                          suggestion: {
                              char: '@',
                              items: ({ query }) => {
                                  const needle = query.toLowerCase();

                                  return mentionItemsRef.current.filter((item) =>
                                      item.label.toLowerCase().includes(needle),
                                  );
                              },
                              render: mentionRender,
                          },
                      }),
                  ]),
            PasteMarkdown,
        ],
        content: value,
        contentType: 'markdown',
        editable: !readOnly,
        immediatelyRender: false,
        autofocus: autoFocus ? 'end' : false,
        onUpdate: ({ editor: instance }) => {
            // Only propagate genuine user edits. When entering edit mode the editor mounts and
            // ProseMirror can emit an update as it normalizes/reconciles the freshly-loaded
            // content — before the user has focused or typed. Autosave consumers would treat that
            // as a change and PUT the file the instant edit mode opens. Real edits always happen
            // while the editor is focused, so gate the change on that.
            if (!instance.isFocused) return;
            onChange(editorToMarkdown(instance));
        },
        onBlur: () => {
            onBlur?.();
        },
        editorProps: {
            attributes: {
                class: cn('ca-instr-editor', editorClassName),
            },
        },
    });

    useEffect(() => {
        if (!editor) return;
        const current = editorToMarkdown(editor);

        if ((value || '') === current) return;

        editor.commands.setContent(value || '', { contentType: 'markdown', emitUpdate: false });
    }, [value, editor]);

    useEffect(() => {
        if (!editor) return;
        if (editor.isEditable === !readOnly) return;
        // emitUpdate=false: toggling editability must not fire onUpdate, or it would mark the
        // content dirty and trigger a spurious auto-save when entering edit mode.
        editor.setEditable(!readOnly, false);
    }, [editor, readOnly]);

    return (
        <div className={cn('w-full', className)}>
            {editor && (
                <BubbleMenu editor={editor} className="flex" appendTo={() => document.body}>
                    <SelectionToolbar editor={editor} />
                </BubbleMenu>
            )}
            <EditorContent editor={editor} className={cn('w-full', contentClassName)} />
        </div>
    );
};

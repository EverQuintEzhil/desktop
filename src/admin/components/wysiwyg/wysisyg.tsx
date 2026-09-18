import { Placeholder } from '@tiptap/extensions';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    BoldIcon,
    EraserIcon,
    Heading1Icon,
    Heading2Icon,
    Heading3Icon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    StrikethroughIcon,
    UnderlineIcon,
    UnlinkIcon,
} from 'lucide-react';
import React, { useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import './wysiwyg.scss';

export interface WYSIWYGProps {
    value?: string;
    onChange?: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    styles?: string;
    isErrored?: boolean;
    name?: string;
    allowCodeBlock?: boolean;
}

interface ToolbarProps {
    editor: Editor;
}

const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
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

    const onClearFormatting = useCallback(() => {
        editor.chain().focus().clearNodes().unsetAllMarks().run();
    }, [editor]);

    const renderToggleButton = (params: {
        label: string;
        icon: React.ReactNode;
        isActive: boolean;
        onClick: () => void;
        disabled?: boolean;
    }) => {
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

    return (
        <div className="wysiwyg-toolbar flex flex-wrap items-center gap-1">
            {renderToggleButton({
                label: 'Heading 1',
                icon: <Heading1Icon />,
                isActive: editor.isActive('heading', { level: 1 }),
                onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            })}
            {renderToggleButton({
                label: 'Heading 2',
                icon: <Heading2Icon />,
                isActive: editor.isActive('heading', { level: 2 }),
                onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            })}
            {renderToggleButton({
                label: 'Heading 3',
                icon: <Heading3Icon />,
                isActive: editor.isActive('heading', { level: 3 }),
                onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            })}
            <span className="wysiwyg-toolbar-separator" aria-hidden="true" />
            {renderToggleButton({
                label: 'Bold',
                icon: <BoldIcon />,
                isActive: editor.isActive('bold'),
                onClick: () => editor.chain().focus().toggleBold().run(),
            })}
            {renderToggleButton({
                label: 'Italic',
                icon: <ItalicIcon />,
                isActive: editor.isActive('italic'),
                onClick: () => editor.chain().focus().toggleItalic().run(),
            })}
            {renderToggleButton({
                label: 'Underline',
                icon: <UnderlineIcon />,
                isActive: editor.isActive('underline'),
                onClick: () => editor.chain().focus().toggleUnderline().run(),
            })}
            {renderToggleButton({
                label: 'Strikethrough',
                icon: <StrikethroughIcon />,
                isActive: editor.isActive('strike'),
                onClick: () => editor.chain().focus().toggleStrike().run(),
            })}
            <span className="wysiwyg-toolbar-separator" aria-hidden="true" />
            {renderToggleButton({
                label: 'Ordered list',
                icon: <ListOrderedIcon />,
                isActive: editor.isActive('orderedList'),
                onClick: () => editor.chain().focus().toggleOrderedList().run(),
            })}
            {renderToggleButton({
                label: 'Bullet list',
                icon: <ListIcon />,
                isActive: editor.isActive('bulletList'),
                onClick: () => editor.chain().focus().toggleBulletList().run(),
            })}
            <span className="wysiwyg-toolbar-separator" aria-hidden="true" />
            {renderToggleButton({
                label: 'Add link',
                icon: <LinkIcon />,
                isActive: editor.isActive('link'),
                onClick: onSetLink,
            })}
            {renderToggleButton({
                label: 'Remove link',
                icon: <UnlinkIcon />,
                isActive: false,
                disabled: !editor.isActive('link'),
                onClick: onUnsetLink,
            })}
            {renderToggleButton({
                label: 'Clear formatting',
                icon: <EraserIcon />,
                isActive: false,
                onClick: onClearFormatting,
            })}
        </div>
    );
};

const WYSIWYG: React.FC<WYSIWYGProps> = (props) => {
    const {
        value = '',
        onChange,
        onBlur,
        placeholder = 'Enter text...',
        isErrored = false,
        name,
        allowCodeBlock = false,
    } = props;

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Off by default: no toolbar button, so a code block can only arrive by paste.
                codeBlock: allowCodeBlock ? undefined : false,
                link: {
                    openOnClick: false,
                    autolink: true,
                    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
                },
            }),
            Placeholder.configure({ placeholder }),
        ],
        content: value,
        immediatelyRender: false,
        onUpdate: ({ editor: instance }) => {
            if (!onChange) return;

            const html = instance.isEmpty ? '' : instance.getHTML();

            onChange(html);
        },
        onBlur: () => {
            onBlur?.();
        },
        editorProps: {
            attributes: {
                class: 'wysiwyg-editor',
            },
        },
    });

    useEffect(() => {
        if (!editor) return;
        const current = editor.isEmpty ? '' : editor.getHTML();

        if ((value || '') === current) return;

        editor.commands.setContent(value || '', { emitUpdate: false });
    }, [value, editor]);

    return (
        <div className={cn('wysiwyg-wrapper relative mb-4 w-full', isErrored && 'is-errored')} data-name={name}>
            {editor && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
};

export default WYSIWYG;

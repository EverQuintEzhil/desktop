import MDEditor from '@uiw/react-md-editor';
import React, { useCallback } from 'react';

import { cn } from '@/lib/utils';

import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

import './markdown-editor.scss';

export interface MarkdownEditorProps {
    value?: string;
    onChange?: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
    styles?: string;
    isErrored?: boolean;
    name?: string;
    height?: number;
    preview?: 'live' | 'edit' | 'preview';
    visibleDragbar?: boolean;
    hideToolbar?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = (props) => {
    const {
        value = '',
        onChange,
        onBlur,
        placeholder = 'Enter markdown...',
        styles,
        isErrored = false,
        name,
        className,
        height = 200,
        preview = 'live',
        visibleDragbar = true,
        hideToolbar = false,
    } = props;

    const handleChange = useCallback(
        (val?: string) => {
            if (onChange && val !== undefined) {
                onChange(val);
            }
        },
        [onChange],
    );

    const handleBlur = useCallback(() => {
        if (onBlur) {
            onBlur();
        }
    }, [onBlur]);

    return (
        <div
            className={cn('markdown-editor relative mb-4 w-full', isErrored && 'is-errored', className)}
            data-color-mode="light"
            data-name={name}
        >
            {styles ? <style>{`.markdown-editor { ${styles} }`}</style> : null}
            <MDEditor
                value={value}
                onChange={handleChange}
                preview={preview}
                height={height}
                visibleDragbar={visibleDragbar}
                hideToolbar={hideToolbar}
                textareaProps={{
                    placeholder,
                    onBlur: handleBlur,
                }}
            />
        </div>
    );
};

export default MarkdownEditor;

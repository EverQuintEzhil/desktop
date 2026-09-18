import CodeMirror from '@uiw/react-codemirror';
import { Loader2Icon } from 'lucide-react';
import React from 'react';

import Markdown from '@/components/markdown/markdown';
import type { MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';

import { isMarkdownFile, isCodeFile, stripFrontmatter } from '../utils';

import { FrontmatterSafeEditor } from './frontmatter-safe-editor';

interface SkillFileEditorProps {
    selectedFile: string | null;
    isLoadingFile: boolean;
    fileContent: string;
    onContentChange: (val: string) => void;
    readOnly?: boolean;
    mdViewMode?: MarkdownViewMode;
}

export const SkillFileEditor: React.FC<SkillFileEditorProps> = ({
    selectedFile,
    isLoadingFile,
    fileContent,
    onContentChange,
    readOnly = false,
    mdViewMode = 'rendered',
}) => {
    if (!selectedFile) return null;

    if (isLoadingFile) {
        return (
            <div className="flex h-full flex-1 flex-col items-center justify-center text-sm text-text-secondary">
                <Loader2Icon className="mb-2 animate-spin text-primary" size={24} />
                Loading file...
            </div>
        );
    }

    if (isMarkdownFile(selectedFile)) {
        if (mdViewMode === 'code') {
            return (
                <div className="code-editor-wrapper h-full flex-1 overflow-hidden">
                    <CodeMirror
                        value={fileContent}
                        theme="light"
                        readOnly={readOnly}
                        onChange={onContentChange}
                        basicSetup={{ lineNumbers: true }}
                        height="100%"
                        className="h-full"
                        style={{ fontSize: '14px' }}
                    />
                </div>
            );
        }

        // Read-only rendered view: static Markdown renderer (frontmatter stripped). The TipTap
        // editor is reserved for editing, since its markdown round-trip is lossy for frontmatter.
        if (readOnly) {
            const renderedContent = stripFrontmatter(fileContent);

            return (
                <div className="scrollbar-controller scrollbar-vertical h-full min-h-0 flex-1 overflow-hidden rounded-xl bg-card p-6">
                    <div className="mx-auto max-w-6xl">
                        {renderedContent.trim() ? (
                            <Markdown>{renderedContent}</Markdown>
                        ) : (
                            <div className="py-2 text-sm text-muted-foreground italic">This file is empty.</div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="h-full min-h-0 flex-1 overflow-hidden rounded-xl">
                <FrontmatterSafeEditor
                    value={fileContent}
                    onChange={onContentChange}
                    placeholder="Write markdown..."
                    enableMentions={false}
                    readOnly={readOnly}
                    className="h-full"
                    contentClassName="h-full"
                    editorClassName="ca-instr-editor-file scrollbar-controller scrollbar-vertical"
                />
            </div>
        );
    }

    if (
        isCodeFile(selectedFile) ||
        selectedFile.toLowerCase().endsWith('.txt') ||
        selectedFile.toLowerCase().endsWith('.csv')
    ) {
        return (
            <div className="code-editor-wrapper h-full flex-1 overflow-hidden">
                <CodeMirror
                    value={fileContent}
                    theme="light"
                    readOnly={isLoadingFile || readOnly}
                    onChange={onContentChange}
                    basicSetup={{ lineNumbers: true }}
                    height="100%"
                    className="h-full"
                    style={{ fontSize: '14px' }}
                />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-1 items-center justify-center text-sm text-text-secondary">
            This file can&apos;t be edited
        </div>
    );
};

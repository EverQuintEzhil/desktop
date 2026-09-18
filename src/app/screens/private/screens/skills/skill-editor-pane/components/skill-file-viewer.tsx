import CodeMirror from '@uiw/react-codemirror';
import { FileIcon, FileXIcon, ImageIcon } from 'lucide-react';

import { stripFrontmatter } from '@/admin/screens/private/screens/admin/components/skills/components/skill-detail/components/skill-instructions/utils';
import Markdown from '@/components/markdown/markdown';
import type { MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';
import { Skeleton } from '@/components/ui/skeleton';

import { isImageFile, isMarkdownFile, isViewableTextFile } from '../utils/is-file-type';

export interface Props {
    selectedFile: string | null;
    fileContent: string;
    mdViewMode: MarkdownViewMode;
    isLoadingFile: boolean;
    isFetchingRoot: boolean;
    isAwaitingDefaultFile: boolean;
}

const SkillFileViewer = ({
    selectedFile,
    fileContent,
    mdViewMode,
    isLoadingFile,
    isFetchingRoot,
    isAwaitingDefaultFile,
}: Props) => {
    if (isLoadingFile || (!selectedFile && isFetchingRoot) || isAwaitingDefaultFile) {
        return (
            <div className="scrollbar-controller scrollbar-vertical absolute inset-0 bg-card p-6">
                <div className="flex max-w-2xl flex-col gap-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="pt-2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/5" />
                    <div className="pt-2" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        );
    }

    if (!selectedFile) {
        return (
            <div className="flex w-full max-w-[340px] flex-col items-center gap-5 rounded-2xl bg-card px-10 py-12 text-center">
                <div className="flex size-16 items-center justify-center rounded-[20px] bg-primary/10 text-primary">
                    <FileIcon size={30} />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <h3 className="text-lg font-bold tracking-tight text-foreground">No file open</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Open the Explorer above to browse this skill&apos;s files.
                    </p>
                </div>
            </div>
        );
    }

    if (isMarkdownFile(selectedFile)) {
        if (mdViewMode === 'code') {
            return (
                <div className="code-editor-wrapper absolute inset-0 overflow-hidden bg-card">
                    <CodeMirror
                        value={fileContent}
                        theme="light"
                        editable={false}
                        basicSetup={{ lineNumbers: true }}
                        height="100%"
                        className="h-full"
                        style={{ fontSize: '14px' }}
                    />
                </div>
            );
        }

        const renderedContent = stripFrontmatter(fileContent);

        return (
            <div className="scrollbar-controller scrollbar-vertical absolute inset-0 bg-card p-6">
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

    if (isViewableTextFile(selectedFile)) {
        return (
            <div className="code-editor-wrapper absolute inset-0 overflow-hidden bg-card">
                <CodeMirror
                    value={fileContent}
                    theme="light"
                    editable={false}
                    basicSetup={{ lineNumbers: true }}
                    height="100%"
                    className="h-full"
                    style={{ fontSize: '14px' }}
                />
            </div>
        );
    }

    const isImage = isImageFile(selectedFile);

    return (
        <div className="flex size-full flex-col items-center justify-center gap-6 rounded-2xl bg-card p-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-[20px] bg-primary/10 text-primary">
                {isImage ? <ImageIcon size={30} /> : <FileXIcon size={30} />}
            </div>
            <div className="flex flex-col items-center gap-1">
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {isImage ? 'Image file' : 'Binary file'}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {isImage
                        ? "Image preview isn't available in the editor. Select a text or code file to start editing."
                        : "This file type can't be previewed or edited here. Select a text, markdown, or code file instead."}
                </p>
            </div>
        </div>
    );
};

export default SkillFileViewer;

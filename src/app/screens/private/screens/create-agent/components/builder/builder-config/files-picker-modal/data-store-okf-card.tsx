import { useEffect, useState } from 'react';

import Markdown from '@/components/markdown/markdown';
import { MarkdownViewToggle, type MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';

interface DataStoreOkfCardProps {
    okf: DataStoreType['okf'];
}

const pickDefaultFile = (files: { path: string; content: string }[]) =>
    files.find((file) => file.path === 'store.md') ?? files[0];

/**
 * Read-only OKF bundle preview for the datastore picker detail pane — after Tools.
 * Shows one file at a time (default store.md) and fills the remaining pane height.
 */
export const DataStoreOkfCard = ({ okf }: DataStoreOkfCardProps) => {
    const files = okf?.files ?? [];
    const defaultFile = pickDefaultFile(files);

    const [selectedPath, setSelectedPath] = useState<string | undefined>(defaultFile?.path);
    const [viewMode, setViewMode] = useState<MarkdownViewMode>('rendered');

    useEffect(() => {
        setSelectedPath(pickDefaultFile(okf?.files ?? [])?.path);
        setViewMode('rendered');
    }, [okf]);

    const selectedFile = files.find((file) => file.path === selectedPath) ?? defaultFile;

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <span className="shrink-0 text-sm font-semibold text-text-secondary">Open Knowledge Format (OKF)</span>
            {files.length === 0 ? (
                <div className="rounded-xl border bg-card px-5 py-4">
                    <p className="m-0 text-sm leading-relaxed text-text-secondary">Not generated yet</p>
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
                        <div className="scrollbar-controller scrollbar-horizontal flex flex-wrap items-center gap-1">
                            {files.map((file) => (
                                <button
                                    key={file.path}
                                    type="button"
                                    onClick={() => setSelectedPath(file.path)}
                                    className={cn(
                                        'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                        file.path === selectedFile?.path
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-text-secondary hover:bg-muted',
                                    )}
                                >
                                    {file.path}
                                </button>
                            ))}
                        </div>
                        <MarkdownViewToggle mode={viewMode} onModeChange={setViewMode} />
                    </div>
                    <div className="scrollbar-controller scrollbar-vertical min-h-0 flex-1 px-5 py-4">
                        {viewMode === 'code' ? (
                            <pre className="text-xs whitespace-pre-wrap text-foreground">{selectedFile?.content}</pre>
                        ) : (
                            <Markdown>{selectedFile?.content ?? ''}</Markdown>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

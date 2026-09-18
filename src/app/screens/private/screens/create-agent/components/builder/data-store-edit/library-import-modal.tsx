import { FilesIcon, LibraryBigIcon, Loader2Icon, XIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import useMediaLibrary, {
    type LibraryFilters,
    type LibraryScope,
} from '@/components/agent-chat/hooks/use-media-library';
import {
    BORDER_HOVER_CLASS_NAME,
    FileThumb,
    SURFACE_HOVER_CLASS_NAME,
    formatFileDate,
    formatFileSize,
    isImageFile,
} from '@/components/file-list';
import SearchInput from '@/components/search-input/search-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInfiniteScroll } from '@/hooks';
import { uiAxios } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import { showErrorToast } from '@/utils';

interface LibraryImportModalProps {
    onImportFiles: (files: File[]) => void;
}

const SCOPES: { value: LibraryScope; label: string }[] = [
    { value: 'yours', label: 'My files' },
    { value: 'shared', label: 'Shared with me' },
    { value: 'all', label: 'All files' },
];

const TAB_TRIGGER_CLASS_NAME = cn(
    'h-9! w-auto! flex-none! justify-center! rounded-none bg-transparent! px-0 text-sm font-medium text-text-secondary shadow-none!',
    'after:inset-x-0! after:inset-y-auto! after:right-auto! after:-bottom-px! after:h-px! after:w-full! after:bg-primary',
    'hover:text-primary data-[state=active]:bg-transparent! data-[state=active]:text-primary',
);

const LibraryImportModal = ({ onImportFiles }: LibraryImportModalProps) => {
    const user = useSelector(selectUser);
    const userId = user._id || '';

    const [open, setOpen] = useState(false);
    const [scope, setScope] = useState<LibraryScope>('yours');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isImporting, setIsImporting] = useState(false);

    const filters = useMemo<LibraryFilters>(() => ({ sort: 'newest' }), []);

    const {
        state: { history, loading, error, showMoreLoading },
        fetchNextPage,
        hasNextPage,
    } = useMediaLibrary({
        userId,
        scope,
        searchQuery: search,
        filters,
    });

    const { loadMoreRef } = useInfiniteScroll({
        loading,
        showMoreLoading,
        hasMore: !!hasNextPage,
        itemsLength: history.length,
        onLoadMore: () => {
            void fetchNextPage();
        },
    });

    const resetState = useCallback(() => {
        setSelectedIds(new Set());
        setSearch('');
        setScope('yours');
    }, []);

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (isImporting) return;
            setOpen(nextOpen);
            if (!nextOpen) resetState();
        },
        [isImporting, resetState],
    );

    const toggleSelect = useCallback((id: string, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);

            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });
    }, []);

    const handleImport = useCallback(async () => {
        const selectedItems = history.filter((item) => selectedIds.has(item._id));

        if (selectedItems.length === 0) return;

        setIsImporting(true);

        try {
            const files = await Promise.all(
                selectedItems.map(async (item) => {
                    const response = await uiAxios.get<Blob>(item.url, { responseType: 'blob' });

                    return new File([response.data], item.name || 'file', {
                        type: response.data.type || item.type || undefined,
                    });
                }),
            );

            onImportFiles(files);
            setOpen(false);
            resetState();
        } catch {
            showErrorToast('Failed to import files. Please try again.');
        } finally {
            setIsImporting(false);
        }
    }, [history, selectedIds, onImportFiles, resetState]);

    const renderRow = (item: (typeof history)[number]) => {
        const checked = selectedIds.has(item._id);
        const meta = [formatFileSize(item.size), formatFileDate(item.createdAt)].filter(Boolean).join(' · ');

        return (
            <li
                key={item._id}
                className={cn(
                    'group flex cursor-pointer items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
                    'transition-colors duration-140',
                    SURFACE_HOVER_CLASS_NAME,
                )}
                role="button"
                tabIndex={0}
                onClick={() => toggleSelect(item._id, !checked)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSelect(item._id, !checked);
                    }
                }}
            >
                <div onClick={(e) => e.stopPropagation()} role="presentation">
                    <Checkbox
                        checked={checked}
                        className="cursor-pointer"
                        onChange={(_, isChecked) => toggleSelect(item._id, isChecked)}
                    />
                </div>

                <FileThumb
                    thumbnailUrl={item.thumbnailUrl}
                    extension={item.extension}
                    fileName={item.name}
                    isImage={isImageFile({ extension: item.extension, name: item.name, type: item.type })}
                />

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                        {item.name}
                    </span>
                    {meta && <span className="text-xs text-text-secondary">{meta}</span>}
                </span>
            </li>
        );
    };

    const renderBody = () => {
        if (loading) {
            return (
                <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <li
                            key={i}
                            className="flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0"
                        >
                            <div className="size-4 shrink-0 rounded bg-foreground/10" />
                            <div className="size-9 shrink-0 rounded-lg bg-foreground/10" />
                            <div
                                className="h-3 flex-1 rounded bg-foreground/10"
                                style={{ width: `${55 + (i % 3) * 15}%` }}
                            />
                        </li>
                    ))}
                </ul>
            );
        }

        if (error) {
            return <p className="px-2 py-6 text-center text-sm text-destructive">{error}</p>;
        }

        if (history.length === 0) {
            return (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-secondary bg-card p-6 text-center">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FilesIcon className="size-6" />
                    </span>
                    <span className="text-sm font-medium">No files found</span>
                    <span className="max-w-sm text-sm text-text-secondary">
                        {search ? 'Try a different search or scope.' : 'Files in your library will appear here.'}
                    </span>
                </div>
            );
        }

        return (
            <>
                <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                    {history.map(renderRow)}
                </ul>
                <div ref={loadMoreRef} />
                {showMoreLoading && (
                    <div className="flex justify-center py-3">
                        <Loader2Icon className="size-4 animate-spin text-text-secondary" aria-hidden="true" />
                    </div>
                )}
            </>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(true)}
                className={cn(
                    'group h-auto flex-1 justify-start gap-3 rounded-2xl border border-dashed border-border-secondary bg-card px-4 py-4',
                    'text-left text-foreground transition-colors duration-140',
                    SURFACE_HOVER_CLASS_NAME,
                    BORDER_HOVER_CLASS_NAME,
                )}
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LibraryBigIcon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium transition-colors group-hover:text-primary">
                        Import from library
                    </span>
                    <span className="text-xs text-text-secondary">browse your media library</span>
                </span>
            </Button>

            <DialogContent className="flex h-[85vh] w-[calc(100%-2rem)] max-w-[720px] flex-col gap-0 overflow-hidden rounded-2xl bg-background p-0">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
                    <DialogTitle className="text-base font-semibold">Import from library</DialogTitle>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Close import dialog"
                        disabled={isImporting}
                        onClick={() => handleOpenChange(false)}
                    >
                        <XIcon className="size-4" />
                    </Button>
                </div>

                <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-3">
                    <SearchInput
                        search={search}
                        onChange={setSearch}
                        searchOnChange
                        autoFocus={false}
                        placeholder="Search files"
                    />
                    <Tabs
                        value={scope}
                        onValueChange={(value) => setScope(value as LibraryScope)}
                        className="min-w-0 gap-0"
                    >
                        <TabsList
                            variant="line"
                            className="h-10 w-full flex-row! items-center! justify-start! gap-5 border-b-0 p-0"
                        >
                            {SCOPES.map((s) => (
                                <TabsTrigger key={s.value} value={s.value} className={TAB_TRIGGER_CLASS_NAME}>
                                    {s.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

                <div className="scrollbar-controller scrollbar-vertical min-h-0 flex-1 px-5 py-4">{renderBody()}</div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-4">
                    <span className="text-sm text-text-secondary">
                        {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select files to import'}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isImporting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                void handleImport();
                            }}
                            disabled={selectedIds.size === 0 || isImporting}
                        >
                            {isImporting && <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />}
                            {isImporting
                                ? 'Importing...'
                                : `Import${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default LibraryImportModal;

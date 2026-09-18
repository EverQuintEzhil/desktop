import { DownloadIcon, XIcon } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';

import CopyButton from '@/components/copy-button';
import ErrorBoundary from '@/components/error-boundary';
import { isImageFile, isPdfFile, type SharedFileItem } from '@/components/file-list/file-list-utils';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { Spinner } from '@/components/ui/spinner';

// LibraryPreviewContent pulls in CodeMirror and ~13 legacy language modes (~700KB); it only ever
// mounts after a chip click, and the SDK bundle in packages/chat-ui-sdk externalizes nothing.
const LibraryPreviewContent = lazy(() => import('@/components/file-list/library-preview-content'));

interface Props {
    item: SharedFileItem;
    name: string;
    isOpen: boolean;
    onClose: () => void;
    loadFile?: (url: string, signal: AbortSignal) => Promise<Blob>;
    onDownload?: () => void;
    isDownloading?: boolean;
}

export const FilePreviewDialog = ({
    item,
    name,
    isOpen,
    onClose,
    loadFile,
    onDownload,
    isDownloading = false,
}: Props) => {
    const [previewText, setPreviewText] = useState<string>('');

    useEffect(() => {
        setPreviewText('');
    }, [isOpen, item.url]);

    const renderCopyButton = () => {
        if (isPdfFile(item) || isImageFile(item) || !previewText) return null;

        return <CopyButton text={previewText} ariaLabel="Copy text" tooltipContent="Copy text" />;
    };

    const renderDownloadButton = () => {
        if (!onDownload) return null;

        return (
            <SimpleTooltip content="Download">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Download"
                    disabled={isDownloading}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={onDownload}
                >
                    {isDownloading ? <Spinner className="size-4" /> : <DownloadIcon className="size-4" />}
                </Button>
            </SimpleTooltip>
        );
    };

    const renderPreviewFallback = () => (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Spinner className="size-6" />
        </div>
    );

    const renderPreviewError = () => (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Unable to load the preview. Please try downloading the file instead.
        </div>
    );

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose();
            }}
        >
            <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-[900px] flex-col gap-0 bg-card p-0 text-foreground">
                <DialogHeader className="flex-row items-center justify-between gap-3">
                    <DialogTitle className="min-w-0 truncate text-base font-semibold">{name}</DialogTitle>
                    <DialogDescription className="sr-only">{`Preview of ${name}`}</DialogDescription>
                    <div className="flex shrink-0 items-center gap-1">
                        {renderCopyButton()}
                        {renderDownloadButton()}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Close preview"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                        >
                            <XIcon className="size-4" />
                        </Button>
                    </div>
                </DialogHeader>
                <DialogBody className="scrollbar-controller scrollbar-vertical min-h-0 flex-1 p-4">
                    <ErrorBoundary fallback={renderPreviewError()}>
                        <Suspense fallback={renderPreviewFallback()}>
                            <LibraryPreviewContent
                                item={item}
                                theme="auto"
                                onContentLoaded={setPreviewText}
                                loadFile={loadFile}
                                onDownload={onDownload}
                                isDownloading={isDownloading}
                            />
                        </Suspense>
                    </ErrorBoundary>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
};

export default FilePreviewDialog;

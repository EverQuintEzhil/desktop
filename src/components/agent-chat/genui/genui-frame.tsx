import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { FileDown, ImageDown, Loader2, Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ChatBlock } from '@/components/chat/blocks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { showErrorToast } from '@/utils';

type ExportFormat = 'png' | 'pdf';

const EXPORT_WIDTH = 1280;
// Recharts mount animations run up to ~1.5s and the responsive grid is ResizeObserver-driven,
// so give the off-screen export copy time to settle before capturing.
const EXPORT_SETTLE_MS = 1800;

const slugify = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const resolveBackgroundColor = (): string => {
    if (typeof document === 'undefined') return '#ffffff';

    // Match the exported surface to the card background (bg-card), not the page
    // background. Probe with a throwaway node so the full var chain resolves to rgb.
    const probe = document.createElement('div');

    probe.style.backgroundColor = 'var(--card)';
    document.body.appendChild(probe);

    const color = window.getComputedStyle(probe).backgroundColor;

    document.body.removeChild(probe);

    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return '#ffffff';

    return color;
};

const parseRgb = (color: string): [number, number, number] => {
    const match = color.match(/(\d+(?:\.\d+)?)/g);

    if (match && match.length >= 3) {
        return [Number(match[0]), Number(match[1]), Number(match[2])];
    }

    return [255, 255, 255];
};

const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');

    link.href = dataUrl;
    link.download = filename;
    link.click();
};

const exportNode = async (node: HTMLElement, baseName: string, exportFormat: ExportFormat) => {
    const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: resolveBackgroundColor(),
    });

    if (exportFormat === 'png') {
        downloadDataUrl(dataUrl, `${baseName}.png`);

        return;
    }

    const { width, height } = node.getBoundingClientRect();
    const margin = 24;
    const pageWidth = width + margin * 2;
    const pageHeight = height + margin * 2;
    const pdf = new jsPDF({
        orientation: pageWidth > pageHeight ? 'l' : 'p',
        unit: 'px',
        format: [pageWidth, pageHeight],
    });

    const [r, g, b] = parseRgb(resolveBackgroundColor());

    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.addImage(dataUrl, 'PNG', margin, margin, width, height);
    pdf.save(`${baseName}.pdf`);
};

interface FrameToolbarProps {
    onExport: (exportFormat: ExportFormat) => void;
    pendingExport: ExportFormat | null;
    onFullscreen?: () => void;
}

const FrameToolbar = ({ onExport, pendingExport, onFullscreen }: FrameToolbarProps) => {
    const isExporting = pendingExport !== null;

    return (
        <TooltipProvider>
            <div className="frame-toolbar flex items-center gap-0.5">
                {onFullscreen ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                className="justify-center"
                                onClick={onFullscreen}
                                aria-label="Full screen"
                            >
                                <Maximize2 />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Full screen</TooltipContent>
                    </Tooltip>
                ) : null}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            className="justify-center"
                            disabled={isExporting}
                            onClick={() => onExport('png')}
                            aria-label="Export as image"
                        >
                            {pendingExport === 'png' ? <Loader2 className="animate-spin" /> : <ImageDown />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as image</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            className="justify-center"
                            disabled={isExporting}
                            onClick={() => onExport('pdf')}
                            aria-label="Export as PDF"
                        >
                            {pendingExport === 'pdf' ? <Loader2 className="animate-spin" /> : <FileDown />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as PDF</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
};

interface GenUIFrameProps {
    title?: string;
    renderContent: () => ReactNode;
}

export const GenUIFrame = ({ title, renderContent }: GenUIFrameProps) => {
    const exportRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [pendingExport, setPendingExport] = useState<ExportFormat | null>(null);

    const baseName = (title ? slugify(title) : '') || 'dashboard';

    useEffect(() => {
        if (!pendingExport) return undefined;

        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let rafId = requestAnimationFrame(() => {
            rafId = requestAnimationFrame(() => {
                timeoutId = setTimeout(() => {
                    if (cancelled) return;

                    const node = exportRef.current;

                    if (!node) {
                        setPendingExport(null);

                        return;
                    }

                    exportNode(node, baseName, pendingExport)
                        .catch((error: unknown) => {
                            showErrorToast(`Failed to export as ${pendingExport === 'png' ? 'image' : 'PDF'}`);
                            console.error('[genui] export failed', error);
                        })
                        .finally(() => {
                            if (!cancelled) setPendingExport(null);
                        });
                }, EXPORT_SETTLE_MS);
            });
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);

            if (timeoutId !== undefined) clearTimeout(timeoutId);
        };
    }, [pendingExport, baseName]);

    const handleExport = (exportFormat: ExportFormat) => {
        if (pendingExport) return;

        setPendingExport(exportFormat);
    };

    return (
        <>
            <ChatBlock
                dataSlot="genui-frame"
                className="genui-frame group"
                header={
                    <>
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            <span className="truncate text-sm font-medium text-foreground">{title ?? 'Dashboard'}</span>
                        </div>
                        <div className="ml-auto">
                            <FrameToolbar
                                onExport={handleExport}
                                pendingExport={pendingExport}
                                onFullscreen={() => setIsFullscreen(true)}
                            />
                        </div>
                    </>
                }
                scrollBody
                bodyClassName="p-4"
            >
                {renderContent()}
            </ChatBlock>
            {pendingExport ? (
                <div
                    aria-hidden
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: -100000,
                        width: EXPORT_WIDTH,
                        pointerEvents: 'none',
                        zIndex: -1,
                    }}
                >
                    <div ref={exportRef} className="*:mx-auto">
                        {renderContent()}
                    </div>
                </div>
            ) : null}
            <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
                <DialogContent className="top-0 left-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none">
                    <DialogHeader className="flex-row items-center justify-between bg-muted-foreground/5 py-2">
                        <DialogTitle className="truncate text-base font-medium">{title ?? 'Dashboard'}</DialogTitle>
                        <div className="flex items-center gap-1">
                            <FrameToolbar onExport={handleExport} pendingExport={pendingExport} />
                            <DialogClose asChild>
                                <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    className="justify-center"
                                    aria-label="Close full screen"
                                >
                                    <X />
                                </Button>
                            </DialogClose>
                        </div>
                    </DialogHeader>
                    <DialogBody className="scrollbar-controller scrollbar-vertical flex-1 bg-card py-8">
                        <div className="*:mx-auto">{renderContent()}</div>
                    </DialogBody>
                </DialogContent>
            </Dialog>
        </>
    );
};

import { CodeXmlIcon, Maximize2Icon, PlayIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import CopyButton from '@/components/copy-button/copy-button';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { sanitizeSvgPreview } from '@/lib/sanitize-html';
import { cn } from '@/lib/utils';

type PreviewKind = 'svg' | 'html';
type ViewMode = 'preview' | 'code';

export interface HtmlSvgPreviewProps {
    code: string;
    language: string;
    isStreaming?: boolean;
}

const surfaceClassName = 'bg-gray-800 text-gray-200';
const headerButtonClassName = 'text-primary hover:bg-primary/10 hover:text-primary';
const headerActiveButtonClassName = 'rounded-full bg-primary/10 text-primary';
const fullscreenActiveButtonClassName = 'rounded-full bg-accent text-foreground';

const LANGUAGE_LABELS: Record<string, string> = {
    html: 'HTML',
    svg: 'SVG',
    xml: 'XML',
};

const hasSvgRoot = (code: string): boolean => {
    let rest = code.trim();
    let previous = '';

    while (rest !== previous) {
        previous = rest;
        rest = rest
            .replace(/^<\?xml[^>]*\?>\s*/i, '')
            .replace(/^<!DOCTYPE[^>]*>\s*/i, '')
            .replace(/^<!--[\s\S]*?-->\s*/, '');
    }

    return /^<svg[\s>]/i.test(rest);
};

const resolvePreviewKind = (language: string, code: string): PreviewKind | null => {
    if (language === 'html') return 'html';
    if (language === 'svg') return 'svg';
    if (language === 'xml' && hasSvgRoot(code)) return 'svg';

    return null;
};

interface ViewToggleButtonsProps {
    view: ViewMode;
    onViewChange: (view: ViewMode) => void;
    buttonClassName?: string;
    activeButtonClassName?: string;
}

const ViewToggleButtons = ({ view, onViewChange, buttonClassName, activeButtonClassName }: ViewToggleButtonsProps) => (
    <>
        <SimpleTooltip content="Code" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(buttonClassName, view === 'code' && activeButtonClassName)}
                aria-label="Code"
                aria-pressed={view === 'code'}
                onClick={() => onViewChange('code')}
            >
                <CodeXmlIcon />
            </Button>
        </SimpleTooltip>
        <SimpleTooltip content="Preview" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(buttonClassName, view === 'preview' && activeButtonClassName)}
                aria-label="Preview"
                aria-pressed={view === 'preview'}
                onClick={() => onViewChange('preview')}
            >
                <PlayIcon />
            </Button>
        </SimpleTooltip>
    </>
);

const HtmlSvgPreview = ({ code, language, isStreaming = false }: HtmlSvgPreviewProps) => {
    const [viewMode, setViewMode] = useState<ViewMode>('preview');
    const [fullscreenView, setFullscreenView] = useState<ViewMode>('preview');
    const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
    const normalizedLanguage = language.toLowerCase();
    const languageLabel = LANGUAGE_LABELS[normalizedLanguage] ?? language;
    const previewKind = useMemo(() => resolvePreviewKind(normalizedLanguage, code), [normalizedLanguage, code]);
    const sanitizedSvg = useMemo(() => {
        if (previewKind !== 'svg' || isStreaming) return '';

        return sanitizeSvgPreview(code);
    }, [previewKind, isStreaming, code]);
    const canPreview = previewKind === 'html' || (previewKind === 'svg' && sanitizedSvg.includes('<svg'));

    const openFullscreen = () => {
        setFullscreenView('preview');
        setIsFullscreenOpen(true);
    };

    const renderHeaderActions = () => (
        <>
            <ViewToggleButtons
                view={viewMode}
                onViewChange={setViewMode}
                buttonClassName={headerButtonClassName}
                activeButtonClassName={headerActiveButtonClassName}
            />
            <SimpleTooltip content="Full screen" side="bottom">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={headerButtonClassName}
                    aria-label="Full screen"
                    onClick={openFullscreen}
                >
                    <Maximize2Icon />
                </Button>
            </SimpleTooltip>
        </>
    );

    const renderHeader = (showActions: boolean) => (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted-foreground/5 px-4 py-2.5 text-xs">
            <span className="truncate text-sm font-medium text-foreground">{languageLabel}</span>
            <div className="flex items-center gap-1" role="group" aria-label={`${languageLabel} block actions`}>
                <CopyButton text={code} className={headerButtonClassName} buttonType="default" />
                {showActions ? renderHeaderActions() : null}
            </div>
        </div>
    );

    const renderCode = (className?: string) => (
        <pre
            className={cn(
                'scrollbar-controller scrollbar-vertical my-0! px-4 pt-2 pb-4 text-xs leading-relaxed',
                surfaceClassName,
                className ?? 'max-h-[400px] rounded-b-md',
            )}
        >
            <code>{code}</code>
        </pre>
    );

    const renderSvgPreview = (className?: string) => (
        <div
            className={cn(
                'scrollbar-controller scrollbar-vertical scrollbar-horizontal flex justify-center border bg-white p-4 [&_svg]:max-w-full',
                className ?? 'max-h-[400px] rounded-b-md border-t-0',
            )}
        >
            <div dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
        </div>
    );

    const renderHtmlPreview = (className?: string) => (
        <iframe
            title={`${languageLabel} preview`}
            sandbox="allow-scripts"
            srcDoc={code}
            className={cn('w-full border bg-white', className ?? 'h-[320px] rounded-b-md border-t-0')}
        />
    );

    const renderBody = (view: ViewMode, fullscreenClassName?: string) => {
        if (view === 'code') return renderCode(fullscreenClassName && `${fullscreenClassName} rounded-md pt-3`);
        if (previewKind === 'html')
            return renderHtmlPreview(fullscreenClassName && `${fullscreenClassName} rounded-md`);

        return renderSvgPreview(fullscreenClassName && `${fullscreenClassName} rounded-md`);
    };

    const renderFullscreenDialog = () => (
        <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
            <DialogContent
                className={cn(
                    'grid-rows-[auto_minmax(0,1fr)]',
                    'top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0',
                    'overflow-hidden rounded-none border-0 p-0 shadow-none',
                )}
                overlayClassName="bg-black/50"
                aria-describedby={undefined}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="min-h-10 flex-row items-center gap-2 px-2 py-1">
                    <DialogTitle className="pl-2 text-sm font-semibold">{languageLabel}</DialogTitle>
                    <div
                        className="ml-auto flex items-center gap-1.5"
                        role="group"
                        aria-label={`Fullscreen ${languageLabel} actions`}
                    >
                        <CopyButton text={code} buttonType="default" />
                        <ViewToggleButtons
                            view={fullscreenView}
                            onViewChange={setFullscreenView}
                            activeButtonClassName={fullscreenActiveButtonClassName}
                        />
                        <DialogClose asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close fullscreen preview">
                                <XIcon />
                            </Button>
                        </DialogClose>
                    </div>
                </DialogHeader>
                <DialogBody className="min-h-0 overflow-hidden p-3">
                    {renderBody(fullscreenView, 'h-full max-h-none')}
                </DialogBody>
            </DialogContent>
        </Dialog>
    );

    if (previewKind === null || isStreaming || !canPreview) {
        return (
            <div className="my-2.5! overflow-hidden rounded-xl border border-border bg-card">
                {renderHeader(false)}
                {renderCode()}
            </div>
        );
    }

    return (
        <div className="my-2.5! overflow-hidden rounded-xl border border-border bg-card">
            {renderHeader(true)}
            {renderBody(viewMode)}
            {renderFullscreenDialog()}
        </div>
    );
};

export default HtmlSvgPreview;

import { json } from '@codemirror/lang-json';
import { StreamLanguage } from '@codemirror/language';
import { java } from '@codemirror/legacy-modes/mode/clike';
import { css, less, sCSS } from '@codemirror/legacy-modes/mode/css';
import { go } from '@codemirror/legacy-modes/mode/go';
import { javascript } from '@codemirror/legacy-modes/mode/javascript';
import { python } from '@codemirror/legacy-modes/mode/python';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { standardSQL } from '@codemirror/legacy-modes/mode/sql';
import { xml } from '@codemirror/legacy-modes/mode/xml';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import DOMPurify from 'dompurify';
import { DownloadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import Markdown from '@/components/markdown/markdown';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import uiAxios from '@/lib/axios';
import { cn } from '@/lib/utils';

import DocPreview from './doc-preview';
import {
    formatFileSize,
    isDocFile,
    isHtmlFile,
    isImageFile,
    isMarkdownFile,
    isPdfFile,
    isSpreadsheetFile,
    type SharedFileItem,
} from './file-list-utils';
import SpreadsheetPreview from './spreadsheet-preview';

interface LibraryPreviewContentProps {
    item: SharedFileItem;
    /** `dark` is the black media-lightbox chrome; `auto` follows the app appearance. */
    theme?: 'dark' | 'auto';
    onContentLoaded?: (text: string) => void;
    /** Auth channel override for callers `uiAxios` cannot serve; must be referentially stable — it is an effect dependency. */
    loadFile?: (url: string, signal: AbortSignal) => Promise<Blob>;
    /** When provided, the error states offer a Download button as the fallback action. */
    onDownload?: () => void;
    isDownloading?: boolean;
}

// The app appearance is applied by toggling `dark` on <html> (see src/hooks/use-appearance.ts);
// there is no context exposing the resolved value.
const isAppearanceDark = (): boolean =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

const codeExtensionsFor = (extension: string): Extension[] => {
    switch (extension) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return [StreamLanguage.define(javascript)];
        case 'json':
            return [json()];
        case 'css':
            return [StreamLanguage.define(css)];
        case 'scss':
            return [StreamLanguage.define(sCSS)];
        case 'less':
            return [StreamLanguage.define(less)];
        case 'yaml':
        case 'yml':
            return [StreamLanguage.define(yaml)];
        case 'xml':
            return [StreamLanguage.define(xml)];
        case 'sh':
            return [StreamLanguage.define(shell)];
        case 'py':
            return [StreamLanguage.define(python)];
        case 'go':
            return [StreamLanguage.define(go)];
        case 'java':
            return [StreamLanguage.define(java)];
        case 'rb':
            return [StreamLanguage.define(ruby)];
        case 'sql':
            return [StreamLanguage.define(standardSQL)];
        default:
            return [];
    }
};

// Parsing a workbook or docx happens in memory on the main thread, so very large files
// get the download fallback instead of a multi-second freeze.
const MAX_PARSED_PREVIEW_BYTES = 5 * 1024 * 1024;

// The sandboxed srcDoc document cannot see the app stylesheet, so `.scrollbar-controller`'s
// look (src/index.css, light values — the iframe canvas is always white) is inlined here.
const IFRAME_SCROLLBAR_STYLE = `<style>
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f3f4f6; border-radius: 3px; }
    ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
    @supports not selector(::-webkit-scrollbar) {
        html { scrollbar-width: thin; scrollbar-color: #d1d5db #f3f4f6; }
    }
</style>`;

const LibraryPreviewContent = ({
    item,
    theme = 'dark',
    onContentLoaded,
    loadFile,
    onDownload,
    isDownloading = false,
}: LibraryPreviewContentProps) => {
    const isPdf = isPdfFile(item);
    const isImage = isImageFile(item);
    const isSpreadsheet = isSpreadsheetFile(item) && !isImage;
    const isDoc = isDocFile(item) && !isImage;
    const needsParsedBlob = isSpreadsheet || isDoc;
    const isBinary = isPdf || isImage || needsParsedBlob;
    const isDarkChrome = theme === 'dark';

    const [text, setText] = useState<string>('');
    const [blobUrl, setBlobUrl] = useState<string>('');
    const [parsedBlob, setParsedBlob] = useState<Blob | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [codeTheme] = useState<'light' | 'dark'>(() => (isAppearanceDark() ? 'dark' : 'light'));

    const onContentLoadedRef = useRef(onContentLoaded);

    useEffect(() => {
        onContentLoadedRef.current = onContentLoaded;
    }, [onContentLoaded]);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        setText('');
        setBlobUrl('');
        setParsedBlob(null);

        if (!item.url) return;

        const controller = new AbortController();
        let objectUrl = '';

        const fetchBlob = async (): Promise<Blob> => {
            if (loadFile) return loadFile(item.url!, controller.signal);

            const response = await uiAxios.get<Blob>(item.url!, {
                responseType: 'blob',
                signal: controller.signal,
            });

            return response.data as Blob;
        };

        const fetchText = async (): Promise<string> => {
            if (loadFile) return (await loadFile(item.url!, controller.signal)).text();

            const response = await uiAxios.get<string>(item.url!, {
                responseType: 'text',
                signal: controller.signal,
            });

            return typeof response.data === 'string' ? response.data : String(response.data);
        };

        const loadBinary = async () => {
            try {
                const blob = await fetchBlob();

                if (controller.signal.aborted) return;

                if (needsParsedBlob) {
                    if (blob.size > MAX_PARSED_PREVIEW_BYTES) {
                        setError(
                            `${item.name ?? 'This file'} (${formatFileSize(blob.size)}) is too large to preview. Please try downloading it instead.`,
                        );
                    } else {
                        setParsedBlob(blob);
                    }

                    return;
                }

                objectUrl = URL.createObjectURL(blob);
                setBlobUrl(objectUrl);
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error('Error loading file preview:', err);
                setError('Unable to load this file. Please try downloading it instead.');
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        const loadText = async () => {
            try {
                const loaded = await fetchText();

                if (controller.signal.aborted) return;

                setText(loaded);
                onContentLoadedRef.current?.(loaded);
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error('Error loading file preview:', err);
                setError('Unable to load this file. Please try downloading it instead.');
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        if (isBinary) {
            void loadBinary();
        } else {
            void loadText();
        }

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [item.url, item.name, isBinary, needsParsedBlob, loadFile]);

    const renderPdf = () => (
        <object
            data={`${blobUrl}#toolbar=1`}
            type="application/pdf"
            title={item.name}
            className="h-full w-full rounded-lg bg-white"
        >
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
                <p>This browser can&apos;t preview PDFs inline.</p>
                <a
                    href={blobUrl}
                    download={item.name}
                    className="rounded-full bg-white/10 px-4 py-2 text-white underline-offset-2 hover:underline"
                >
                    Download PDF
                </a>
            </div>
        </object>
    );

    const renderHtml = () => {
        const clean = DOMPurify.sanitize(text);

        return (
            <iframe
                sandbox=""
                title={item.name}
                srcDoc={`${IFRAME_SCROLLBAR_STYLE}${clean}`}
                className="h-full w-full rounded-lg border-0 bg-white"
            />
        );
    };

    const renderMarkdown = () => (
        <div className="prose scrollbar-controller scrollbar-vertical scrollbar-horizontal h-full w-full max-w-full! rounded-lg bg-background p-6 text-foreground">
            <Markdown>{text}</Markdown>
        </div>
    );

    const renderCode = () => (
        <CodeMirror
            value={text}
            theme={isDarkChrome ? oneDark : codeTheme}
            readOnly
            editable={false}
            extensions={codeExtensionsFor(item.extension || '')}
            basicSetup={{ lineNumbers: true }}
            height="100%"
            className="scrollbar-controller scrollbar-vertical scrollbar-horizontal h-full w-full rounded-lg"
        />
    );

    const renderImage = () => (
        <div className="flex h-full w-full items-center justify-center">
            <img
                src={blobUrl}
                alt={item.name}
                className="max-h-full max-w-full rounded-lg object-contain ring-1 ring-white/15"
                style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 24px 24px' }}
            />
        </div>
    );

    const renderContent = () => {
        if (isImage) return renderImage();
        if (isPdf) return renderPdf();
        if (isSpreadsheet && parsedBlob) {
            return (
                <SpreadsheetPreview
                    blob={parsedBlob}
                    name={item.name}
                    onContentLoaded={(csv) => onContentLoadedRef.current?.(csv)}
                />
            );
        }
        if (isDoc && parsedBlob) return <DocPreview blob={parsedBlob} name={item.name} />;
        if (isHtmlFile(item)) return renderHtml();
        if (isMarkdownFile(item)) return renderMarkdown();

        return renderCode();
    };

    if (isLoading) {
        return (
            <div
                className={cn(
                    'flex h-full w-full items-center justify-center',
                    isDarkChrome ? 'text-white' : 'text-muted-foreground',
                )}
            >
                <Spinner className="size-6" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center text-sm">
                <p className={isDarkChrome ? 'text-white/80' : 'text-muted-foreground'}>{error}</p>
                {onDownload ? (
                    <Button type="button" variant="outline" disabled={isDownloading} onClick={onDownload}>
                        {isDownloading ? <Spinner className="size-4" /> : <DownloadIcon className="size-4" />}
                        Download
                    </Button>
                ) : null}
            </div>
        );
    }

    return renderContent();
};

export default LibraryPreviewContent;

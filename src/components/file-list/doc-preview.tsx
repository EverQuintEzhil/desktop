import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { sanitizeHtmlViewer } from '@/lib/sanitize-html';

interface DocPreviewProps {
    blob: Blob;
    name?: string;
}

const DocPreview = ({ blob, name }: DocPreviewProps) => {
    const [html, setHtml] = useState<string>('');
    const [isParsing, setIsParsing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        setIsParsing(true);
        setError(null);
        setHtml('');

        const parse = async () => {
            try {
                // mammoth is CJS-only; under Vite's interop the callable API lands on `default`.
                const mammothModule = await import('mammoth');
                const mammoth = mammothModule.default ?? mammothModule;
                const arrayBuffer = await blob.arrayBuffer();

                if (controller.signal.aborted) return;

                const result = await mammoth.convertToHtml({ arrayBuffer });

                if (controller.signal.aborted) return;

                setHtml(sanitizeHtmlViewer(result.value));
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error('Error parsing document preview:', err);
                setError('Unable to load this file. Please try downloading it instead.');
            } finally {
                if (!controller.signal.aborted) setIsParsing(false);
            }
        };

        void parse();

        return () => {
            controller.abort();
        };
    }, [blob]);

    if (isParsing) {
        return (
            <div className="doc-preview flex h-full w-full items-center justify-center text-muted-foreground">
                <Spinner className="size-6" />
            </div>
        );
    }

    // mammoth silently drops content it cannot convert (text boxes, charts), which can leave an
    // empty body for a non-empty document.
    if (error || !html) {
        return (
            <div className="doc-preview flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {error ?? 'This document has no previewable content. Please try downloading it instead.'}
            </div>
        );
    }

    return (
        <div
            className="doc-preview markdown prose scrollbar-controller scrollbar-vertical h-full w-full max-w-full! rounded-lg bg-background p-6 text-foreground"
            aria-label={name ? `Preview of ${name}` : 'Document preview'}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

export default DocPreview;

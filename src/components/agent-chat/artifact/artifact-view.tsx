import { useMemo } from 'react';

import Markdown, { CARD_PROSE_CLASS_NAME } from '@/components/markdown';
import { sanitizeSvgPreview } from '@/lib/sanitize-html';
import { cn } from '@/lib/utils';

import { ArtifactCode } from './artifact-code';
import { ArtifactMermaid } from './artifact-mermaid';
import type { ArtifactVersion } from './artifact-types';

interface ArtifactViewProps {
    version: ArtifactVersion;
    mode: 'preview' | 'code';
    className?: string;
}

const HTML_CONTENT_SECURITY_POLICY = [
    "default-src 'none'",
    'img-src data: blob:',
    'media-src data: blob:',
    'font-src data:',
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
    "form-action 'none'",
    "base-uri 'none'",
].join('; ');

const CSP_META_TAG = `<meta http-equiv="Content-Security-Policy" content="${HTML_CONTENT_SECURITY_POLICY}">`;

// The preview runs in its own document, so .scrollbar-controller cannot reach it. Mirror that
// rule inside the frame, with a transparent track so it sits on a light or a dark artifact alike.
const PREVIEW_SCROLLBAR_STYLE = [
    '<style>',
    '::-webkit-scrollbar{width:6px;height:6px}',
    '::-webkit-scrollbar-track{background:transparent}',
    '::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}',
    '::-webkit-scrollbar-thumb:hover{background:#9ca3af}',
    '@supports not selector(::-webkit-scrollbar){html{scrollbar-width:thin;scrollbar-color:#d1d5db transparent}}',
    '</style>',
].join('');

const LEADING_DOCTYPE = /^\s*<!doctype[^>]*>/i;

const withContentSecurityPolicy = (html: string): string => {
    const doctype = LEADING_DOCTYPE.exec(html);
    const insertAt = doctype ? doctype[0].length : 0;

    return `${html.slice(0, insertAt)}${CSP_META_TAG}${PREVIEW_SCROLLBAR_STYLE}${html.slice(insertAt)}`;
};

export const ArtifactView = ({ version, mode, className }: ArtifactViewProps) => {
    const sanitizedSvg = useMemo(
        () => (version.artifactType === 'svg' ? sanitizeSvgPreview(version.content) : ''),
        [version.artifactType, version.content],
    );

    const sandboxedHtml = useMemo(
        () => (version.artifactType === 'html' ? withContentSecurityPolicy(version.content) : ''),
        [version.artifactType, version.content],
    );

    if (mode === 'code') {
        return <ArtifactCode content={version.content} className={className} />;
    }

    if (version.artifactType === 'mermaid') {
        return <ArtifactMermaid content={version.content} className={className} />;
    }

    if (version.artifactType === 'html') {
        return (
            <iframe
                title={version.title || 'Artifact preview'}
                sandbox="allow-scripts"
                srcDoc={sandboxedHtml}
                // An iframe is a replaced element: with height:auto it keeps its 150px intrinsic
                // height and ignores a stretching `bottom`, so it needs an explicit height.
                className={cn('h-full w-full border-0 bg-white', className)}
            />
        );
    }

    if (version.artifactType === 'svg') {
        return (
            <div
                className={cn(
                    'scrollbar-controller scrollbar-vertical scrollbar-horizontal flex justify-center bg-white p-4 [&_svg]:max-w-full',
                    className,
                )}
            >
                <div dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
            </div>
        );
    }

    if (version.artifactType === 'markdown') {
        return (
            <div className={cn('scrollbar-controller scrollbar-vertical bg-card px-4 py-3', className)}>
                <div className={CARD_PROSE_CLASS_NAME}>
                    <Markdown>{version.content}</Markdown>
                </div>
            </div>
        );
    }

    return <ArtifactCode content={version.content} className={className} />;
};

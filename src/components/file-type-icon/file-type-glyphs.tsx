import type { ReactNode } from 'react';

/** The design's category set — one mark per file category, not per extension. */
export type FileGlyphName =
    | 'pdf'
    | 'doc'
    | 'sheet'
    | 'slides'
    | 'markdown'
    | 'code'
    | 'html'
    | 'image'
    | 'audio'
    | 'video'
    | 'archive'
    | 'file';

// The page silhouette the pdf and doc marks are built from, left open at the bottom so the filled
// label chip closes it off.
const CHIPPED_PAGE: ReactNode = (
    <>
        <path d="M6 3.5h7l5 5v4.5" />
        <path d="M13 3.5V8a1 1 0 0 0 1 1h4" />
        <path d="M6 3.5A2.5 2.5 0 0 0 3.5 6v6.5" />
    </>
);

// The closed page the code, archive and fallback marks share.
const FOLDED_PAGE: ReactNode = (
    <>
        <path d="M13 3.5H6.5A2.5 2.5 0 0 0 4 6v12a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18V9z" />
        <path d="M13 3.5V8a1 1 0 0 0 1 1h6" />
    </>
);

// `stroke="none"` keeps the chip and its label out of the 1.9 stroke the svg sets for the artwork.
const renderLabelChip = (label: string, fontSize: number, letterSpacing: number): ReactNode => (
    <>
        <rect x="3.5" y="13" width="17" height="7.5" rx="2" stroke="none" fill="currentColor" />
        <text
            x="12"
            y="18.6"
            textAnchor="middle"
            stroke="none"
            fontFamily="ui-monospace, monospace"
            fontWeight="600"
            fontSize={fontSize}
            letterSpacing={letterSpacing}
            style={{ fill: 'var(--file-type-label)' }}
        >
            {label}
        </text>
    </>
);

export const FILE_GLYPHS: Record<FileGlyphName, ReactNode> = {
    pdf: (
        <>
            {CHIPPED_PAGE}
            {renderLabelChip('PDF', 4.6, 0.3)}
        </>
    ),
    doc: (
        <>
            {CHIPPED_PAGE}
            {renderLabelChip('DOC', 4, 0.2)}
        </>
    ),
    sheet: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M3 10h18" />
            <path d="M10 10v10" />
        </>
    ),
    slides: (
        <>
            <rect x="3" y="4" width="18" height="12.5" rx="3" />
            <path d="M8 20.5h8" />
            <path d="M12 16.5v4" />
        </>
    ),
    markdown: (
        <>
            <rect x="2.5" y="6" width="19" height="12" rx="3" />
            <path d="M6.5 15v-6l2.5 3 2.5-3v6" />
            <path d="M15.5 9v6" />
            <path d="M13.5 13l2 2 2-2" />
        </>
    ),
    code: (
        <>
            {FOLDED_PAGE}
            <path d="M10.5 12.5L8.5 14.75l2 2.25" />
            <path d="M14 12.5l2 2.25-2 2.25" />
        </>
    ),
    html: (
        <>
            <rect x="2.5" y="5" width="19" height="14" rx="3" />
            <path d="M8.5 9.5L6 12l2.5 2.5" />
            <path d="M15.5 9.5L18 12l-2.5 2.5" />
            <path d="M13 9l-2 6" />
        </>
    ),
    image: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="9" cy="9.5" r="1.6" />
            <path d="M3.5 17l4.5-4 5 4" />
            <path d="M13 16l3-2.5 4.5 3.5" />
        </>
    ),
    audio: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M7.5 13.5v-3" />
            <path d="M10.5 15.5v-7" />
            <path d="M13.5 14v-4" />
            <path d="M16.5 16v-8" />
        </>
    ),
    video: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M10.5 9l4.5 3-4.5 3z" />
        </>
    ),
    archive: (
        <>
            {FOLDED_PAGE}
            <path d="M9.5 4v3" />
            <path d="M9.5 9.5v3" />
            <rect x="8" y="14.5" width="3" height="4" rx="1" />
        </>
    ),
    file: FOLDED_PAGE,
};

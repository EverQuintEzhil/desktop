import {
    ARCHIVE_EXTENSIONS,
    AUDIO_EXTENSIONS,
    CODE_TEXT_EXTENSIONS,
    DOCUMENT_EXTENSIONS,
    HTML_EXTENSIONS,
    IMAGE_EXTENSIONS,
    MARKDOWN_EXTENSIONS,
    PDF_EXTENSIONS,
    PRESENTATION_EXTENSIONS,
    SPREADSHEET_EXTENSIONS,
    VIDEO_EXTENSIONS,
    extensionOf,
    isPdfFile,
    type SharedFileItem,
} from '@/components/file-list/file-list-utils';

import type { FileGlyphName } from './file-type-glyphs';

export interface FileGlyph {
    glyph: FileGlyphName;
    /** A `--file-type-*` custom property from `src/index.css`. */
    colorToken: string;
}

// One entry per category, keyed to the shared extension constants, so a new extension is a list
// entry rather than a new mark. Order matters: AUDIO before VIDEO so `ogg` reads as audio, and
// SPREADSHEET before CODE_TEXT so `csv` is a spreadsheet rather than a text file.
const LOOKUP: { glyph: FileGlyphName; extensions: string[]; colorToken: string }[] = [
    { glyph: 'image', extensions: IMAGE_EXTENSIONS, colorToken: '--file-type-image' },
    { glyph: 'audio', extensions: AUDIO_EXTENSIONS, colorToken: '--file-type-audio' },
    { glyph: 'video', extensions: VIDEO_EXTENSIONS, colorToken: '--file-type-video' },
    { glyph: 'pdf', extensions: PDF_EXTENSIONS, colorToken: '--file-type-pdf' },
    { glyph: 'html', extensions: HTML_EXTENSIONS, colorToken: '--file-type-html' },
    { glyph: 'markdown', extensions: MARKDOWN_EXTENSIONS, colorToken: '--file-type-markdown' },
    { glyph: 'sheet', extensions: SPREADSHEET_EXTENSIONS, colorToken: '--file-type-sheet' },
    { glyph: 'slides', extensions: PRESENTATION_EXTENSIONS, colorToken: '--file-type-slides' },
    { glyph: 'doc', extensions: DOCUMENT_EXTENSIONS, colorToken: '--file-type-doc' },
    { glyph: 'code', extensions: CODE_TEXT_EXTENSIONS, colorToken: '--file-type-code' },
    { glyph: 'archive', extensions: ARCHIVE_EXTENSIONS, colorToken: '--file-type-archive' },
];

const FALLBACK: FileGlyph = { glyph: 'file', colorToken: '--file-type-file' };

export const fileGlyphFor = (item: SharedFileItem): FileGlyph => {
    const extension = extensionOf(item);

    if (extension) {
        const hit = LOOKUP.find(({ extensions }) => extensions.includes(extension));

        if (hit) return { glyph: hit.glyph, colorToken: hit.colorToken };
    }

    // An attachment can arrive with a name carrying no extension at all — a pasted file, or a page
    // saved under its title. Mime type rescues the one category the set marks unmistakably.
    if (isPdfFile(item)) return { glyph: 'pdf', colorToken: '--file-type-pdf' };

    return FALLBACK;
};

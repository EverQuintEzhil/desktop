import {
    FileArchiveIcon,
    FileAudioIcon,
    FileCodeIcon,
    FileIcon,
    FileSpreadsheetIcon,
    FileTextIcon,
    FileVideoIcon,
    ImageIcon,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
    extensionOf,
    fileIconFor,
    isCodeTextFile,
    isDocFile,
    isHtmlFile,
    isImageFile,
    isMarkdownFile,
    isPdfFile,
    isPreviewableFile,
    isSpreadsheetFile,
    isVideoFile,
    normalizeExt,
    type SharedFileItem,
} from './file-list-utils';

describe('normalizeExt', () => {
    it('lowercases and strips leading dots', () => {
        expect(normalizeExt('.PNG')).toBe('png');
        expect(normalizeExt('..Md')).toBe('md');
    });

    it('answers an empty string for a missing value', () => {
        expect(normalizeExt(undefined)).toBe('');
        expect(normalizeExt('')).toBe('');
    });
});

describe('extensionOf', () => {
    it('prefers the explicit extension field', () => {
        expect(extensionOf({ extension: 'pdf', name: 'brief.png' })).toBe('pdf');
    });

    it('lowercases an uppercase extension', () => {
        expect(extensionOf({ extension: 'PDF' })).toBe('pdf');
    });

    it('accepts a dot-prefixed extension', () => {
        expect(extensionOf({ extension: '.MD' })).toBe('md');
    });

    it('derives the extension from the name when no extension field is present', () => {
        expect(extensionOf({ name: 'notes.md' })).toBe('md');
    });

    it('takes only the last segment of a multi-dot name', () => {
        expect(extensionOf({ name: 'archive.tar.gz' })).toBe('gz');
    });

    it('lowercases an extension derived from an uppercase name', () => {
        expect(extensionOf({ name: 'PHOTO.PNG' })).toBe('png');
    });

    // Documented, not endorsed: `String.split` returns the whole string when the
    // separator is absent, so a name with no dot becomes its own extension.
    it('treats a name with no dot as being entirely the extension', () => {
        expect(extensionOf({ name: 'README' })).toBe('readme');
    });

    it('reads a leading-dot name as an extension with no basename', () => {
        expect(extensionOf({ name: '.gitignore' })).toBe('gitignore');
    });

    it('answers an empty string for an empty or absent name', () => {
        expect(extensionOf({ name: '' })).toBe('');
        expect(extensionOf({})).toBe('');
    });

    // `??` only falls back on null/undefined, so an empty-string extension wins
    // over the name rather than deferring to it.
    it('does not fall back to the name when the extension field is an empty string', () => {
        expect(extensionOf({ extension: '', name: 'photo.png' })).toBe('');
    });
});

interface PredicateCase {
    label: string;
    predicate: (item: SharedFileItem) => boolean;
    positiveExtension: string;
    negativeExtension: string;
    /** The FM-193 shape: the chat composer passes a name and no `extension`. */
    nameOnly: string;
}

const predicateCases: PredicateCase[] = [
    {
        label: 'isImageFile',
        predicate: isImageFile,
        positiveExtension: 'png',
        negativeExtension: 'pdf',
        nameOnly: 'photo.png',
    },
    {
        label: 'isVideoFile',
        predicate: isVideoFile,
        positiveExtension: 'mp4',
        negativeExtension: 'png',
        nameOnly: 'clip.mp4',
    },
    {
        label: 'isPdfFile',
        predicate: isPdfFile,
        positiveExtension: 'pdf',
        negativeExtension: 'png',
        nameOnly: 'brief.pdf',
    },
    {
        label: 'isHtmlFile',
        predicate: isHtmlFile,
        positiveExtension: 'html',
        negativeExtension: 'pdf',
        nameOnly: 'page.htm',
    },
    {
        label: 'isMarkdownFile',
        predicate: isMarkdownFile,
        positiveExtension: 'md',
        negativeExtension: 'txt',
        nameOnly: 'notes.markdown',
    },
    {
        label: 'isCodeTextFile',
        predicate: isCodeTextFile,
        positiveExtension: 'ts',
        negativeExtension: 'md',
        nameOnly: 'config.json',
    },
];

describe.each(predicateCases)('$label', ({ predicate, positiveExtension, negativeExtension, nameOnly }) => {
    it(`matches an item whose extension is ${positiveExtension}`, () => {
        expect(predicate({ extension: positiveExtension })).toBe(true);
    });

    it(`rejects an item whose extension is ${negativeExtension}`, () => {
        expect(predicate({ extension: negativeExtension })).toBe(false);
    });

    it(`matches ${nameOnly} carrying only a name`, () => {
        expect(predicate({ name: nameOnly })).toBe(true);
    });

    it('rejects an item with neither an extension nor a name', () => {
        expect(predicate({})).toBe(false);
    });
});

describe('mime-type fallbacks', () => {
    it('matches image, video and pdf on the type field when the extension is unknown', () => {
        expect(isImageFile({ name: 'blob', type: 'IMAGE/png' })).toBe(true);
        expect(isVideoFile({ name: 'blob', type: 'video/mp4' })).toBe(true);
        expect(isPdfFile({ name: 'blob', type: 'application/pdf' })).toBe(true);
    });

    // The chat composer sets `type: 'file'` on every attachment, so the type
    // fallback must not turn an arbitrary attachment into an image.
    it('does not match a generic chat attachment type', () => {
        expect(isImageFile({ name: 'notes.md', type: 'file' })).toBe(false);
        expect(isVideoFile({ name: 'notes.md', type: 'file' })).toBe(false);
        expect(isPdfFile({ name: 'notes.md', type: 'file' })).toBe(false);
    });

    it('offers no type fallback for html, markdown or code', () => {
        expect(isHtmlFile({ name: 'page', type: 'text/html' })).toBe(false);
        expect(isMarkdownFile({ name: 'notes', type: 'text/markdown' })).toBe(false);
        expect(isCodeTextFile({ name: 'main', type: 'text/plain' })).toBe(false);
    });
});

describe('isSpreadsheetFile', () => {
    it.each(['csv', 'tsv', 'xls', 'xlsx', 'ods'])('accepts a .%s item', (extension) => {
        expect(isSpreadsheetFile({ extension })).toBe(true);
    });

    it('rejects .numbers, which SheetJS cannot read', () => {
        expect(isSpreadsheetFile({ extension: 'numbers' })).toBe(false);
    });
});

describe('isDocFile', () => {
    it('accepts a .docx item', () => {
        expect(isDocFile({ name: 'proposal.docx' })).toBe(true);
    });

    it.each(['doc', 'rtf', 'odt', 'pages'])('rejects a .%s item, which mammoth cannot read', (extension) => {
        expect(isDocFile({ extension })).toBe(false);
    });
});

describe('isPreviewableFile', () => {
    it.each(['png', 'mp4', 'pdf', 'html', 'md', 'json', 'csv', 'xls', 'xlsx', 'docx'])(
        'accepts a .%s item',
        (extension) => {
            expect(isPreviewableFile({ extension })).toBe(true);
        },
    );

    it.each(['doc', 'numbers', 'zip'])('rejects a .%s item', (extension) => {
        expect(isPreviewableFile({ extension })).toBe(false);
    });

    it('accepts an item carrying only a name', () => {
        expect(isPreviewableFile({ name: 'config.yaml' })).toBe(true);
    });

    it('rejects an item with no extension and no name', () => {
        expect(isPreviewableFile({})).toBe(false);
    });

    // The aggregate spans video, which LibraryPreviewContent has no branch for —
    // a caller that previews everything `isPreviewableFile` accepts would hand a
    // video to the CodeMirror fallback. `composer-file-preview-list` therefore
    // composes the individual predicates instead of using this aggregate.
    it('accepts video even though it is neither text nor a rendered binary', () => {
        expect(isPreviewableFile({ name: 'clip.mov' })).toBe(true);
        expect(isVideoFile({ name: 'clip.mov' })).toBe(true);
        expect(isCodeTextFile({ name: 'clip.mov' })).toBe(false);
    });

    it('accepts anything matched only by its mime type', () => {
        expect(isPreviewableFile({ name: 'blob', type: 'image/png' })).toBe(true);
    });
});

describe('fileIconFor', () => {
    it('gives markdown a text icon rather than the generic file icon', () => {
        expect(fileIconFor('md')).toBe(FileTextIcon);
        expect(fileIconFor('markdown')).toBe(FileTextIcon);
        expect(fileIconFor('.MD')).toBe(FileTextIcon);
    });

    it('keeps the icons the other families already had', () => {
        expect(fileIconFor('pdf')).toBe(FileTextIcon);
        expect(fileIconFor('png')).toBe(ImageIcon);
        expect(fileIconFor('xlsx')).toBe(FileSpreadsheetIcon);
    });

    it('gives html, code and text-config families a code icon', () => {
        expect(fileIconFor('html')).toBe(FileCodeIcon);
        expect(fileIconFor('htm')).toBe(FileCodeIcon);
        expect(fileIconFor('json')).toBe(FileCodeIcon);
        expect(fileIconFor('yaml')).toBe(FileCodeIcon);
    });

    it('keeps txt on the text icon rather than the code icon it shares a list with', () => {
        expect(fileIconFor('txt')).toBe(FileTextIcon);
    });

    it('gives archives and audio their own icons', () => {
        expect(fileIconFor('zip')).toBe(FileArchiveIcon);
        expect(fileIconFor('gz')).toBe(FileArchiveIcon);
        expect(fileIconFor('mp3')).toBe(FileAudioIcon);
        expect(fileIconFor('opus')).toBe(FileAudioIcon);
    });

    // `ogg` sits in both lists; audio is the likelier chat attachment, and the video *predicate*
    // still claims it so previewing is unaffected.
    it('reads ogg as audio for the icon while leaving the video predicate alone', () => {
        expect(fileIconFor('ogg')).toBe(FileAudioIcon);
        expect(isVideoFile({ extension: 'ogg' })).toBe(true);
    });

    it('keeps the real video containers on the video icon', () => {
        expect(fileIconFor('mp4')).toBe(FileVideoIcon);
        expect(fileIconFor('mov')).toBe(FileVideoIcon);
    });

    it('falls back to the generic file icon', () => {
        expect(fileIconFor('dwg')).toBe(FileIcon);
        expect(fileIconFor(undefined)).toBe(FileIcon);
    });
});

describe('extension-first resolution', () => {
    // The file-list surfaces resolve a lucide icon from an item whose only signal is its name.
    // Chat attachment chips take a different route entirely — see `fileGlyphFor`.
    it('resolves an item carrying only a name', () => {
        expect(fileIconFor(extensionOf({ name: 'Amplify-2.0-announcement.html' }))).toBe(FileCodeIcon);
        expect(fileIconFor(extensionOf({ name: 'brief.pdf' }))).toBe(FileTextIcon);
        expect(fileIconFor(extensionOf({ name: 'sheet.xlsx' }))).toBe(FileSpreadsheetIcon);
    });

    // Admin message files store a dot-prefixed extension beside an extensionless name.
    it('resolves a dot-prefixed extension on a name that carries none', () => {
        expect(fileIconFor(extensionOf({ extension: '.pdf', name: 'Q3 report' }))).toBe(FileTextIcon);
        expect(fileIconFor(extensionOf({ extension: '.XLSX', name: 'Q3 numbers' }))).toBe(FileSpreadsheetIcon);
    });
});

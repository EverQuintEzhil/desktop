import { describe, expect, it } from 'vitest';

import { fileGlyphFor } from './file-type-glyph';

const glyphOf = (name: string) => fileGlyphFor({ name }).glyph;

describe('fileGlyphFor', () => {
    it('maps each category to its own mark and accent', () => {
        expect(fileGlyphFor({ name: 'brief.pdf' })).toEqual({ glyph: 'pdf', colorToken: '--file-type-pdf' });
        expect(fileGlyphFor({ name: 'contract.docx' })).toEqual({ glyph: 'doc', colorToken: '--file-type-doc' });
        expect(fileGlyphFor({ name: 'model.xlsx' })).toEqual({ glyph: 'sheet', colorToken: '--file-type-sheet' });
        expect(fileGlyphFor({ name: 'kickoff.pptx' })).toEqual({ glyph: 'slides', colorToken: '--file-type-slides' });
        expect(fileGlyphFor({ name: 'README.md' })).toEqual({ glyph: 'markdown', colorToken: '--file-type-markdown' });
        expect(fileGlyphFor({ name: 'page.html' })).toEqual({ glyph: 'html', colorToken: '--file-type-html' });
        expect(fileGlyphFor({ name: 'shot.png' })).toEqual({ glyph: 'image', colorToken: '--file-type-image' });
        expect(fileGlyphFor({ name: 'main.ts' })).toEqual({ glyph: 'code', colorToken: '--file-type-code' });
    });

    it('uses the marks added for audio, video and archives', () => {
        expect(fileGlyphFor({ name: 'voice.mp3' })).toEqual({ glyph: 'audio', colorToken: '--file-type-audio' });
        expect(fileGlyphFor({ name: 'clip.mp4' })).toEqual({ glyph: 'video', colorToken: '--file-type-video' });
        expect(fileGlyphFor({ name: 'bundle.zip' })).toEqual({ glyph: 'archive', colorToken: '--file-type-archive' });
    });

    // The two orderings the design calls out, both of which a plain alphabetical list would break.
    it('reads ogg as audio and csv as a spreadsheet', () => {
        expect(glyphOf('interview.ogg')).toBe('audio');
        expect(glyphOf('activity-log.csv')).toBe('sheet');
        expect(glyphOf('export.tsv')).toBe('sheet');
    });

    // What the chips showed side by side when every code-shaped file wore one hue.
    it('separates the four types that used to look alike', () => {
        expect(glyphOf('marks-register-ios.jsx')).toBe('code');
        expect(glyphOf('activity-log.csv')).toBe('sheet');
        expect(glyphOf('42001.svg')).toBe('image');
        expect(glyphOf('Amplify-2.0-announcement.html')).toBe('html');
    });

    it('keeps txt and log on the code mark rather than inventing one', () => {
        expect(glyphOf('notes.txt')).toBe('code');
        expect(glyphOf('build-out.log')).toBe('code');
    });

    it('reads a dot-prefixed extension and ignores case', () => {
        expect(fileGlyphFor({ extension: '.PDF', name: 'Q3 report' }).glyph).toBe('pdf');
        expect(glyphOf('PHOTO.PNG')).toBe('image');
    });

    it('rescues an extensionless pdf by its mime type', () => {
        expect(fileGlyphFor({ name: 'blob', type: 'application/pdf' }).glyph).toBe('pdf');
    });

    it('falls back to the plain page when the type cannot be identified', () => {
        expect(fileGlyphFor({ name: "Amplify 2.0 — What's new", type: 'file' })).toEqual({
            glyph: 'file',
            colorToken: '--file-type-file',
        });
        expect(glyphOf('drawing.dwg')).toBe('file');
        expect(fileGlyphFor({})).toEqual({ glyph: 'file', colorToken: '--file-type-file' });
    });
});

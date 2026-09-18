import { describe, expect, it } from 'vitest';

import { isAllowedFile, unsupportedFilesMessage } from './file-upload';

const fileOf = (name: string, type: string): File => new File(['# Notes'], name, { type });

describe('isAllowedFile', () => {
    it('allows a .md file', () => {
        expect(isAllowedFile(fileOf('notes.md', 'text/markdown'))).toBe(true);
    });

    it('allows a .md file whose type the browser reported as text/plain', () => {
        expect(isAllowedFile(fileOf('notes.md', 'text/plain'))).toBe(true);
    });

    it('allows a .md file when the browser reported no type', () => {
        expect(isAllowedFile(fileOf('notes.md', ''))).toBe(true);
    });

    it('allows a .markdown file', () => {
        expect(isAllowedFile(fileOf('notes.markdown', 'text/markdown'))).toBe(true);
    });

    it('allows .MD regardless of case', () => {
        expect(isAllowedFile(fileOf('NOTES.MD', 'text/markdown'))).toBe(true);
    });

    it('allows the types that already worked', () => {
        expect(isAllowedFile(fileOf('brief.pdf', 'application/pdf'))).toBe(true);
        expect(isAllowedFile(fileOf('notes.txt', 'text/plain'))).toBe(true);
        expect(isAllowedFile(fileOf('shot.png', 'image/png'))).toBe(true);
    });

    it('rejects a type that is not on the list', () => {
        expect(isAllowedFile(fileOf('malware.exe', 'application/octet-stream'))).toBe(false);
        expect(isAllowedFile(fileOf('archive.zip', 'application/zip'))).toBe(false);
    });

    it('rejects a file with no extension', () => {
        expect(isAllowedFile(fileOf('README', 'text/plain'))).toBe(false);
    });
});

describe('unsupportedFilesMessage', () => {
    it('names markdown among the allowed types for a single rejected file', () => {
        expect(unsupportedFilesMessage(1)).toBe(
            'Unsupported file type. Allowed: images, PDF, Word, text, Markdown, Excel, PowerPoint.',
        );
    });

    it('counts the files instead of listing types when several are rejected', () => {
        expect(unsupportedFilesMessage(3)).toBe('3 files have an unsupported type.');
    });
});

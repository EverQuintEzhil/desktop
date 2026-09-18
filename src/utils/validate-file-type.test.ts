import { describe, expect, it } from 'vitest';

import { ACCEPTED_FILE_TYPES } from '@/app/screens/private/screens/agent/components/chat-agent/components/project-detail/file-upload';

import { describeAcceptedTypes, isFileAllowed, partitionFilesByAccept } from './validate-file-type';

const fileOf = (name: string, type: string): File => new File(['# Notes'], name, { type });

describe('isFileAllowed with the space knowledge accept list', () => {
    it('accepts a .md file that reports text/markdown', () => {
        expect(isFileAllowed(fileOf('notes.md', 'text/markdown'), ACCEPTED_FILE_TYPES)).toBe(true);
    });

    it('accepts a .md file that reports text/x-markdown', () => {
        expect(isFileAllowed(fileOf('notes.md', 'text/x-markdown'), ACCEPTED_FILE_TYPES)).toBe(true);
    });

    it('accepts a .md file that reports text/plain', () => {
        expect(isFileAllowed(fileOf('notes.md', 'text/plain'), ACCEPTED_FILE_TYPES)).toBe(true);
    });

    it('accepts a .md file when the browser reports no type', () => {
        expect(isFileAllowed(fileOf('notes.md', ''), ACCEPTED_FILE_TYPES)).toBe(true);
    });

    it('accepts a .markdown file', () => {
        expect(isFileAllowed(fileOf('notes.markdown', 'text/markdown'), ACCEPTED_FILE_TYPES)).toBe(true);
    });

    it('accepts .MD regardless of case', () => {
        expect(isFileAllowed(fileOf('NOTES.MD', 'text/markdown'), ACCEPTED_FILE_TYPES)).toBe(true);
    });

    it('still accepts the types that already worked', () => {
        expect(isFileAllowed(fileOf('brief.pdf', 'application/pdf'), ACCEPTED_FILE_TYPES)).toBe(true);
        expect(isFileAllowed(fileOf('notes.txt', 'text/plain'), ACCEPTED_FILE_TYPES)).toBe(true);
        expect(isFileAllowed(fileOf('shot.png', 'image/png'), ACCEPTED_FILE_TYPES)).toBe(true);
    });

    it('still rejects a type that is not on the list', () => {
        expect(isFileAllowed(fileOf('malware.exe', 'application/octet-stream'), ACCEPTED_FILE_TYPES)).toBe(false);
        expect(isFileAllowed(fileOf('archive.zip', 'application/zip'), ACCEPTED_FILE_TYPES)).toBe(false);
    });

    it('rejects a binary renamed to .md', () => {
        expect(isFileAllowed(fileOf('payload.md', 'application/octet-stream'), ACCEPTED_FILE_TYPES)).toBe(false);
    });
});

describe('partitionFilesByAccept', () => {
    it('keeps the markdown file and drops the executable', () => {
        const { accepted, rejected } = partitionFilesByAccept(
            [fileOf('notes.md', 'text/markdown'), fileOf('malware.exe', 'application/octet-stream')],
            ACCEPTED_FILE_TYPES,
        );

        expect(accepted.map((file) => file.name)).toEqual(['notes.md']);
        expect(rejected.map((file) => file.name)).toEqual(['malware.exe']);
    });
});

describe('describeAcceptedTypes', () => {
    it('names markdown once rather than listing MD and MARKDOWN', () => {
        expect(describeAcceptedTypes(ACCEPTED_FILE_TYPES)).toBe(
            'images, PDF, DOC, DOCX, TXT, Markdown, XLS, XLSX, PPT, PPTX',
        );
    });
});

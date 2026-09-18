import { describe, expect, it } from 'vitest';

import type { FileType } from '@/types/chat';

import { filesToAttachments, getMessageFileIds, getUploadedFileIds } from './file-attachments';

const makeFile = (overrides: Partial<FileType> = {}): FileType => ({
    name: 'report.pdf',
    url: 'https://files.example.com/report.pdf',
    ...overrides,
});

describe('filesToAttachments', () => {
    it('maps an uploaded file to a complete file attachment', () => {
        const [attachment] = filesToAttachments([makeFile({ _id: 'file-1' })]);

        expect(attachment).toMatchObject({
            id: 'file-1',
            type: 'file',
            name: 'report.pdf',
            contentType: 'application/octet-stream',
            status: { type: 'complete' },
        });
        expect(attachment.content).toEqual([
            {
                type: 'file',
                data: 'https://files.example.com/report.pdf',
                mimeType: 'application/octet-stream',
                filename: 'report.pdf',
            },
        ]);
    });

    it('maps an image file to an image part', () => {
        const [attachment] = filesToAttachments([
            makeFile({ type: 'image', name: 'shot.png', url: 'https://files.example.com/shot.png' }),
        ]);

        expect(attachment.type).toBe('image');
        expect(attachment.content).toEqual([
            {
                type: 'image',
                image: 'https://files.example.com/shot.png',
                filename: 'shot.png',
            },
        ]);
    });

    it('drops a file that failed to upload', () => {
        expect(filesToAttachments([makeFile({ uploadError: true })])).toEqual([]);
    });

    it('drops a file whose url is missing, so the send is not lost with it', () => {
        const files = [makeFile({ _id: 'ok' }), makeFile({ _id: 'broken', url: '' })];

        expect(filesToAttachments(files).map((attachment) => attachment.id)).toEqual(['ok']);
    });
});

describe('getUploadedFileIds', () => {
    it('keeps only ids of files that uploaded successfully', () => {
        const files = [makeFile({ _id: 'a' }), makeFile({ _id: 'b', uploadError: true }), makeFile({ tempId: 'c' })];

        expect(getUploadedFileIds(files)).toEqual(['a']);
    });
});

describe('getMessageFileIds', () => {
    it('reads ids from the top level', () => {
        expect(getMessageFileIds({ fileIds: ['a', 'b'] })).toEqual(['a', 'b']);
    });

    it('reads ids nested under custom', () => {
        expect(getMessageFileIds({ custom: { fileIds: ['a'] } })).toEqual(['a']);
    });

    it('ignores non-string and empty ids', () => {
        expect(getMessageFileIds({ fileIds: ['a', '', 3, null] })).toEqual(['a']);
    });

    it('returns nothing for metadata that is not an object', () => {
        expect(getMessageFileIds(null)).toEqual([]);
        expect(getMessageFileIds('nope')).toEqual([]);
    });
});

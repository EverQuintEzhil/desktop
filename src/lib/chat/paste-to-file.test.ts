import { describe, expect, it } from 'vitest';

import { MAX_FILE_SIZE_BYTES } from './file-upload-utils';
import { createPastedTextAttachment, getPastedTextFileName, PASTE_TO_FILE_MIN_LENGTH } from './paste-to-file';

describe('getPastedTextFileName', () => {
    it('uses the base name when nothing is attached', () => {
        expect(getPastedTextFileName([])).toBe('pasted-text.txt');
    });

    it('uses the base name when no attached file collides', () => {
        expect(getPastedTextFileName(['report.pdf', 'notes.txt'])).toBe('pasted-text.txt');
    });

    it('falls back to -2 when the base name is taken', () => {
        expect(getPastedTextFileName(['pasted-text.txt'])).toBe('pasted-text-2.txt');
    });

    it('falls back to -3 when the base name and -2 are taken', () => {
        expect(getPastedTextFileName(['pasted-text.txt', 'pasted-text-2.txt'])).toBe('pasted-text-3.txt');
    });

    it('takes the first free slot rather than the next number after the highest', () => {
        expect(getPastedTextFileName(['pasted-text.txt', 'pasted-text-3.txt'])).toBe('pasted-text-2.txt');
    });

    it('ignores case differences when detecting a collision', () => {
        expect(getPastedTextFileName(['Pasted-Text.TXT'])).toBe('pasted-text-2.txt');
    });
});

describe('createPastedTextAttachment', () => {
    const longText = 'a'.repeat(PASTE_TO_FILE_MIN_LENGTH);

    const attach = (overrides: Partial<Parameters<typeof createPastedTextAttachment>[0]> = {}) =>
        createPastedTextAttachment({
            text: longText,
            isAttachmentEnabled: true,
            accept: undefined,
            existingNames: [],
            ...overrides,
        });

    it('converts a paste of exactly the threshold length', () => {
        const file = attach();

        expect(file).not.toBeNull();
        expect(file?.name).toBe('pasted-text.txt');
        expect(file?.type).toBe('text/plain');
    });

    it('leaves a paste one character below the threshold inline', () => {
        expect(attach({ text: 'a'.repeat(PASTE_TO_FILE_MIN_LENGTH - 1) })).toBeNull();
    });

    it('returns null when attachments are not enabled for the agent', () => {
        expect(attach({ isAttachmentEnabled: false })).toBeNull();
    });

    it('returns null when the accept list rejects a .txt', () => {
        expect(attach({ accept: 'image/*,.pdf' })).toBeNull();
    });

    it('attaches when accept is an empty string', () => {
        expect(attach({ accept: '' })?.name).toBe('pasted-text.txt');
    });

    it('attaches when accept explicitly includes .txt', () => {
        expect(attach({ accept: 'image/*,.pdf,.txt' })?.name).toBe('pasted-text.txt');
    });

    it('returns null when the pasted text exceeds the 50MB upload cap', () => {
        // A 4-byte-per-character emoji reaches the byte cap with a quarter of the characters,
        // so the intermediate JS string stays half the size of an ASCII equivalent.
        const oversized = '\u{1F600}'.repeat(MAX_FILE_SIZE_BYTES / 4 + 1);

        expect(attach({ text: oversized })).toBeNull();
    });

    it('dedupes the name against the attachments already on the composer', () => {
        expect(attach({ existingNames: ['pasted-text.txt'] })?.name).toBe('pasted-text-2.txt');
    });

    it('carries the pasted text verbatim', async () => {
        const file = attach();

        await expect(file?.text()).resolves.toBe(longText);
    });
});

import { MAX_FILE_SIZE_BYTES } from '@/lib/chat/file-upload-utils';
import { isFileAllowed } from '@/utils/validate-file-type';

/** Pasted plain text at or above this length becomes an attached `.txt` file instead of inline text. */
export const PASTE_TO_FILE_MIN_LENGTH = 2000;

const BASE_NAME = 'pasted-text';
const EXTENSION = '.txt';
const MIME_TYPE = 'text/plain';

/**
 * First free `pasted-text.txt` / `pasted-text-2.txt` / … name given the names already attached.
 * Compared case-insensitively so a differently-cased attachment cannot yield two chips that read
 * as the same file.
 */
export const getPastedTextFileName = (existingNames: string[]): string => {
    const taken = new Set(existingNames.map((name) => name.toLowerCase()));
    const base = `${BASE_NAME}${EXTENSION}`;

    if (!taken.has(base)) return base;

    let index = 2;

    while (taken.has(`${BASE_NAME}-${index}${EXTENSION}`)) {
        index += 1;
    }

    return `${BASE_NAME}-${index}${EXTENSION}`;
};

const createTextFile = (text: string, name: string): File => new File([text], name, { type: MIME_TYPE });

interface PastedTextAttachmentOptions {
    text: string;
    isAttachmentEnabled: boolean;
    accept: string | undefined;
    existingNames: string[];
}

/** The File a long text paste should become, or null when the paste should be inserted inline instead. */
export const createPastedTextAttachment = (options: PastedTextAttachmentOptions): File | null => {
    const { text, isAttachmentEnabled, accept, existingNames } = options;

    if (text.length < PASTE_TO_FILE_MIN_LENGTH) return null;
    if (!isAttachmentEnabled) return null;

    const name = getPastedTextFileName(existingNames);

    // Probed with an empty File so a rejecting `accept` never costs a copy of the pasted text.
    if (!isFileAllowed(createTextFile('', name), accept)) return null;

    const file = createTextFile(text, name);

    // `File.size` is UTF-8 bytes, so the cap is reached well before `text.length` for
    // multi-byte scripts. Over it, `addFiles` would drop the file and the paste would
    // vanish — returning null lets it fall through to inline insertion instead.
    if (file.size > MAX_FILE_SIZE_BYTES) return null;

    return file;
};

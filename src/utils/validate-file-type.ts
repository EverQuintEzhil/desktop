/**
 * Client-side file-type validation shared by every upload surface.
 *
 * The HTML `accept` attribute only *filters* the OS picker — users can switch the picker to
 * "All Files" and select anything. This module re-checks the selected files in JS against the
 * same `accept` whitelist, verifying BOTH the file extension (`File.name`) AND the MIME type
 * (`File.type`) before any upload request is made.
 *
 * Note: `File.type` is inferred by the browser (usually from the extension), so a binary renamed
 * to an allowed extension can still report an allowed MIME. This is the ceiling of any client-side
 * check — the server remains the source of truth. This guard blocks the common bypass (picking an
 * `.exe`/`.sh`/etc. through "All Files") and gives immediate, clear feedback.
 */

import type React from 'react';

import showErrorToast from './show-error-toast';

/** Known MIME type(s) for each supported extension. */
const MIME_BY_EXTENSION: Record<string, string[]> = {
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.svg': ['image/svg+xml'],
    '.bmp': ['image/bmp'],
    '.heic': ['image/heic'],
    '.pdf': ['application/pdf'],
    '.doc': ['application/msword'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.xls': ['application/vnd.ms-excel'],
    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    '.ppt': ['application/vnd.ms-powerpoint'],
    '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    '.txt': ['text/plain'],
    // Markdown MIME reporting differs by OS: Windows/Edge commonly send text/plain
    // or an empty type, macOS sends text/markdown.
    '.md': ['text/markdown', 'text/x-markdown', 'text/plain'],
    '.markdown': ['text/markdown', 'text/x-markdown', 'text/plain'],
    '.csv': ['text/csv', 'application/vnd.ms-excel'],
    '.json': ['application/json'],
    // Zip MIME reporting is notoriously inconsistent across OSes.
    '.zip': ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
};

/** Human-friendly label for a single `accept` token, used in the error toast. */
const describeToken = (token: string): string => {
    const t = token.toLowerCase();

    if (t.endsWith('/*')) return `${t.slice(0, t.indexOf('/'))}s`; // image/* -> images
    if (t === '.md' || t === '.markdown') return 'Markdown';
    if (t.startsWith('.')) return t.slice(1).toUpperCase(); // .pdf -> PDF

    const sub = t.split('/')[1] ?? t;

    if (sub.includes('markdown')) return 'Markdown';
    if (sub.includes('json')) return 'JSON';
    if (sub.includes('zip')) return 'ZIP';
    if (sub.includes('pdf')) return 'PDF';
    if (sub.includes('wordprocessing') || sub === 'msword') return 'DOC';
    if (sub.includes('spreadsheet') || sub === 'vnd.ms-excel') return 'XLS';
    if (sub.includes('presentation') || sub === 'vnd.ms-powerpoint') return 'PPT';
    if (sub.includes('plain')) return 'TXT';

    return sub.toUpperCase();
};

interface AllowedSets {
    exts: Set<string>;
    mimes: Set<string>;
    mimePrefixes: string[];
}

const parseTokens = (accept: string): string[] =>
    accept
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

/** Expands an `accept` string into the extension + MIME sets a file may match. */
const buildAllowed = (accept: string): AllowedSets => {
    const exts = new Set<string>();
    const mimes = new Set<string>();
    const mimePrefixes: string[] = [];

    for (const token of parseTokens(accept)) {
        if (token.startsWith('.')) {
            exts.add(token);
            (MIME_BY_EXTENSION[token] ?? []).forEach((m) => mimes.add(m));
        } else if (token.endsWith('/*')) {
            const prefix = token.slice(0, -1); // 'image/'

            mimePrefixes.push(prefix);
            for (const [ext, typeList] of Object.entries(MIME_BY_EXTENSION)) {
                if (typeList.some((m) => m.startsWith(prefix))) exts.add(ext);
            }
        } else {
            mimes.add(token);
            for (const [ext, typeList] of Object.entries(MIME_BY_EXTENSION)) {
                if (typeList.includes(token)) exts.add(ext);
            }
        }
    }

    return { exts, mimes, mimePrefixes };
};

const getExtension = (fileName: string): string => {
    const name = fileName.toLowerCase();
    const dot = name.lastIndexOf('.');

    return dot >= 0 ? name.slice(dot) : '';
};

/**
 * True if `file` satisfies the `accept` whitelist, checking BOTH extension and MIME type.
 * An empty/whitespace `accept` means "no restriction" and always passes.
 */
export const isFileAllowed = (file: File, accept: string | undefined): boolean => {
    if (!accept?.trim()) return true;

    const { exts, mimes, mimePrefixes } = buildAllowed(accept);
    const ext = getExtension(file.name);
    const type = (file.type || '').toLowerCase();

    const extOk = exts.size === 0 || exts.has(ext);

    let mimeOk: boolean;

    if (mimes.size === 0 && mimePrefixes.length === 0) {
        mimeOk = true;
    } else if (type === '') {
        // Browser could not determine a type — fall back to the extension result.
        mimeOk = extOk;
    } else {
        mimeOk = mimes.has(type) || mimePrefixes.some((p) => type.startsWith(p));
    }

    return extOk && mimeOk;
};

export interface FileValidationResult {
    accepted: File[];
    rejected: File[];
}

/** Splits files into those that satisfy `accept` and those that don't. */
export const partitionFilesByAccept = (files: FileList | File[], accept: string | undefined): FileValidationResult => {
    const accepted: File[] = [];
    const rejected: File[] = [];

    Array.from(files).forEach((file) => {
        (isFileAllowed(file, accept) ? accepted : rejected).push(file);
    });

    return { accepted, rejected };
};

/** Comma-separated list of human-readable allowed formats, e.g. "images, PDF, DOC, TXT". */
export const describeAcceptedTypes = (accept: string | undefined): string => {
    const tokens = accept ? parseTokens(accept) : [];
    const seen = new Set<string>();
    const labels: string[] = [];

    tokens.forEach((token) => {
        const label = describeToken(token);

        if (!seen.has(label)) {
            seen.add(label);
            labels.push(label);
        }
    });

    return labels.join(', ');
};

/**
 * User-facing error message for a rejected file, e.g.
 * `Upload failed: malware.exe is an invalid format. Only images, PDF, DOC, TXT are permitted.`
 */
export const getFileTypeErrorMessage = (file: File, accept: string | undefined): string => {
    const allowed = describeAcceptedTypes(accept);
    const suffix = allowed ? ` Only ${allowed} are permitted.` : '';

    return `Upload failed: ${file.name} is an invalid format.${suffix}`;
};

/**
 * Validates dropped/pasted files against `accept`, toasting an error for each rejected file.
 * Returns only the accepted files. Use for drag-and-drop / clipboard paths where there is no
 * `<input>` element to read the whitelist from.
 */
export const acceptValidFiles = (files: FileList | File[], accept: string | undefined): File[] => {
    const { accepted, rejected } = partitionFilesByAccept(files, accept);

    rejected.forEach((file) => showErrorToast(getFileTypeErrorMessage(file, accept)));

    return accepted;
};

/**
 * Guards a file `<input>` change event: validates each selected file against the input's own
 * `accept` attribute, toasts an error for every invalid file, resets the input so the invalid
 * file doesn't linger, and returns only the accepted files (empty array if none survive).
 */
export const acceptValidFilesFromInput = (event: React.ChangeEvent<HTMLInputElement>): File[] => {
    const input = event.target;

    if (!input.files || input.files.length === 0) return [];

    const { accepted, rejected } = partitionFilesByAccept(input.files, input.accept);

    rejected.forEach((file) => showErrorToast(getFileTypeErrorMessage(file, input.accept)));

    if (rejected.length > 0) input.value = '';

    return accepted;
};

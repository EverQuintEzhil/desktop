import { useEffect, useRef, useState } from 'react';

import type { FileType } from '@/types/chat';
import { showErrorToast, acceptValidFilesFromInput } from '@/utils';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    return ['jpg', 'jpeg', 'png', 'gif'].includes(ext || '') ? 'image' : 'file';
};

export interface UseLocalAttachmentsResult {
    files: FileType[];
    inputRef: React.RefObject<HTMLInputElement | null>;
    openPicker: () => void;
    handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    removeAt: (index: number) => void;
    clear: () => void;
    getRawFiles: () => { tempId: string; file: File }[];
}

export const useLocalAttachments = (): UseLocalAttachmentsResult => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<FileType[]>([]);
    const objectUrlsRef = useRef<string[]>([]);
    const rawFilesRef = useRef<Map<string, File>>(new Map());

    useEffect(
        () => () => {
            objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            objectUrlsRef.current = [];
        },
        [],
    );

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Re-validate file type (extension + MIME); toasts + resets input on rejection.
        const typeValid = acceptValidFilesFromInput(event);

        if (typeValid.length === 0) return;

        const valid = typeValid.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
        const skipped = typeValid.length - valid.length;

        if (skipped > 0) {
            showErrorToast(skipped === 1 ? 'File exceeds 50MB limit.' : `${skipped} file(s) exceed 50MB limit`);
        }

        if (valid.length === 0) {
            event.target.value = '';

            return;
        }

        const mapped: FileType[] = valid.map((file) => {
            const fileType = getFileType(file.name);
            const isImage = fileType === 'image';
            const url = isImage ? URL.createObjectURL(file) : '';

            if (url) {
                objectUrlsRef.current.push(url);
            }

            const tempId = crypto.randomUUID();

            rawFilesRef.current.set(tempId, file);

            return {
                name: file.name,
                type: fileType,
                url,
                tempId,
                size: file.size,
            };
        });

        setFiles((current) => [...current, ...mapped]);
        event.target.value = '';
    };

    const removeAt = (index: number) => {
        setFiles((current) => {
            const target = current[index];

            if (target?.url) {
                URL.revokeObjectURL(target.url);
                objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== target.url);
            }

            if (target?.tempId) {
                rawFilesRef.current.delete(target.tempId);
            }

            return current.filter((_, itemIndex) => itemIndex !== index);
        });
    };

    const clear = () => {
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
        rawFilesRef.current.clear();
        setFiles([]);
    };

    const openPicker = () => {
        inputRef.current?.click();
    };

    const getRawFiles = (): { tempId: string; file: File }[] =>
        Array.from(rawFilesRef.current.entries()).map(([tempId, file]) => ({ tempId, file }));

    return {
        files,
        inputRef,
        openPicker,
        handleInputChange,
        removeAt,
        clear,
        getRawFiles,
    };
};

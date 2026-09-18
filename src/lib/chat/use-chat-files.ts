import { useCallback, useEffect, useRef, useState } from 'react';

import { filesApi, type FileUploadResult } from '@/lib/api';
import { generateTempId, getFileType, getUploadErrorMessage, MAX_FILE_SIZE_BYTES } from '@/lib/chat/file-upload-utils';
import type { ChatFilesState, FileType } from '@/types/chat';
import { showErrorToast, partitionFilesByAccept, getFileTypeErrorMessage } from '@/utils';

interface UseChatFilesOptions {
    agentId?: string;
    isIncognitoMode?: () => boolean;
    getConversationId?: () => string | null | undefined;
    // Upload transport injected by the host so the package can target an external
    // files service (base URL + token fetch). When absent, the app default
    // `filesApi` (cookie + `files.<host>`) is used. Injecting the transport here
    // avoids a `@/lib` -> `@/components` layering inversion.
    filesBaseUrl?: string;
    fetch?: typeof fetch;
    credentials?: RequestCredentials;
}

export function useChatFiles(options?: UseChatFilesOptions): ChatFilesState {
    const [files, setFiles] = useState<FileType[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const localPreviewUrlsRef = useRef<Set<string>>(new Set());
    const filesByIdRef = useRef<Map<string, File>>(new Map());

    const isUploading = files.some((f) => f.isUploading);

    const revokePreviewUrl = useCallback((url?: string) => {
        if (!url || !localPreviewUrlsRef.current.has(url)) return;
        URL.revokeObjectURL(url);
        localPreviewUrlsRef.current.delete(url);
    }, []);

    const setAgentFiles = useCallback(
        (nextFiles: FileType[]) => {
            setFiles((prev) => {
                const nextUrls = new Set(nextFiles.map((file) => file.url));

                prev.forEach((file) => {
                    if (!nextUrls.has(file.url)) {
                        revokePreviewUrl(file.url);
                        if (file.tempId) {
                            filesByIdRef.current.delete(file.tempId);
                        }
                    }
                });

                return nextFiles;
            });
        },
        [revokePreviewUrl],
    );

    useEffect(() => {
        return () => {
            localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            localPreviewUrlsRef.current.clear();
        };
    }, []);

    const updateFileById = (tempId: string, updates: Partial<FileType>) => {
        setFiles((prev) =>
            prev.map((f) => {
                if (f.tempId !== tempId) return f;

                if (updates.url && updates.url !== f.url) {
                    revokePreviewUrl(f.url);
                }

                return { ...f, ...updates };
            }),
        );
    };

    const uploadViaTransport = async (form: FormData): Promise<FileUploadResult | undefined> => {
        const uploadFetch = options?.fetch as typeof fetch;
        // Do NOT set Content-Type: the browser must add the multipart boundary.
        const response = await uploadFetch(`${options?.filesBaseUrl}/upload`, {
            method: 'POST',
            credentials: options?.credentials,
            body: form,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as { value?: { values?: FileUploadResult[] } };

        return data.value?.values?.[0];
    };

    const uploadFile = async (file: File, tempId: string) => {
        try {
            const form = new FormData();

            form.append('files', file);
            if (options?.agentId) {
                form.append('agent_id', options.agentId);
                form.append('origin.type', 'chat');
                form.append('origin.agent_id', options.agentId);
                const conversationId = options.getConversationId?.();

                if (conversationId) {
                    form.append('origin.conversation_id', conversationId);
                }
            }
            if (options?.isIncognitoMode?.()) {
                form.append('incognito', 'true');
            }

            let uploaded: FileUploadResult | undefined;

            if (options?.filesBaseUrl && options?.fetch) {
                uploaded = await uploadViaTransport(form);
            } else {
                const response = await filesApi.upload(form, {
                    onUploadProgress: (e) => {
                        const progress = Math.round((e.loaded / (e.total || 1)) * 100);

                        updateFileById(tempId, { uploadProgress: progress });
                    },
                });

                uploaded = response.data?.value?.values?.[0];
            }

            if (!uploaded) {
                updateFileById(tempId, {
                    isUploading: false,
                    uploadError: true,
                    uploadProgress: 0,
                    uploadErrorMessage: 'Upload failed. Click to retry.',
                });

                return;
            }

            updateFileById(tempId, {
                name: uploaded.name,
                location: uploaded.location,
                url: uploaded.url,
                _id: uploaded._id,
                isUploading: false,
                uploadProgress: 100,
                uploadError: false,
                uploadErrorMessage: undefined,
            });
            filesByIdRef.current.delete(tempId);
        } catch (error) {
            updateFileById(tempId, {
                isUploading: false,
                uploadError: true,
                uploadProgress: 0,
                uploadErrorMessage: getUploadErrorMessage(error),
            });
        }
    };

    const retryUpload = (tempId: string) => {
        const file = filesByIdRef.current.get(tempId);

        if (!file) return;

        updateFileById(tempId, {
            isUploading: true,
            uploadError: false,
            uploadErrorMessage: undefined,
            uploadProgress: 0,
        });
        uploadFile(file, tempId);
    };

    // Callers own `accept` validation; this only applies the size gate and starts the uploads.
    const addFiles = (incoming: File[]): void => {
        const valid = incoming.filter((f) => f.size <= MAX_FILE_SIZE_BYTES);
        const skipped = incoming.length - valid.length;

        if (skipped > 0) {
            showErrorToast(skipped === 1 ? 'File exceeds 50MB limit.' : `${skipped} file(s) exceed 50MB limit`);
        }

        if (valid.length === 0) return;

        const mapped: FileType[] = valid.map((f) => {
            const url = URL.createObjectURL(f);

            localPreviewUrlsRef.current.add(url);

            return {
                tempId: generateTempId(),
                name: f.name,
                type: getFileType(f.name),
                url,
                isUploading: true,
                uploadProgress: 0,
                uploadError: false,
            };
        });

        setFiles((prev) => [...prev, ...mapped]);
        mapped.forEach((mapped_file, i) => {
            filesByIdRef.current.set(mapped_file.tempId!, valid[i]);
            uploadFile(valid[i], mapped_file.tempId!);
        });
    };

    const onChangeFile = (event: React.ChangeEvent<HTMLInputElement> | ClipboardEvent | DragEvent): void => {
        try {
            const rawFiles =
                (event as React.ChangeEvent<HTMLInputElement>).target?.files ||
                (event as ClipboardEvent).clipboardData?.files ||
                (event as DragEvent).dataTransfer?.files;

            if (!rawFiles) return;

            // Re-validate file type (extension + MIME) — the picker's `accept` is bypassable.
            const inputEl = (event as React.ChangeEvent<HTMLInputElement>).target;
            const fileInput = inputEl instanceof HTMLInputElement && inputEl.type === 'file' ? inputEl : null;
            const accept = fileInput?.accept;
            const { accepted: typeValid, rejected } = partitionFilesByAccept(rawFiles, accept);

            rejected.forEach((f) => showErrorToast(getFileTypeErrorMessage(f, accept)));
            if (rejected.length > 0 && fileInput) fileInput.value = '';
            if (typeValid.length === 0) return;

            addFiles(typeValid);
        } catch {
            return;
        }
    };

    const clearFiles = useCallback(() => {
        setFiles((prev) => {
            prev.forEach((file) => revokePreviewUrl(file.url));

            return [];
        });
        filesByIdRef.current.clear();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [revokePreviewUrl]);

    return {
        files,
        isUploading,
        fileInputRef: fileInputRef as React.RefObject<HTMLInputElement | null>,
        setFiles: setAgentFiles,
        updateFileById,
        addFiles,
        onChangeFile,
        clearFiles,
        retryUpload,
    };
}

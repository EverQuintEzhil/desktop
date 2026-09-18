import React from 'react';

import { useUploadFilesContext } from '@/context';
import { filesApi } from '@/lib/api';
import { generateTempId, getFileType, MAX_FILE_SIZE_BYTES, type UploadOriginType } from '@/lib/chat/file-upload-utils';
import type { AgentType } from '@/types/admin';
import type { FileType } from '@/types/chat';
import { showErrorToast, partitionFilesByAccept, getFileTypeErrorMessage } from '@/utils';

const useUploadFiles = (agent?: AgentType, originType?: UploadOriginType) => {
    const { state: uploadFiles, actions } = useUploadFilesContext();

    const onUploadFile = async (
        file: File,
        tempId: string,
        groupName?: string | undefined,
        tagToField?: string,
        tagToId?: string,
    ) => {
        try {
            const bodyFormData = new FormData();

            bodyFormData.append('files', file);

            if (tagToField && tagToId) {
                bodyFormData.append('tagToField', tagToField);
                bodyFormData.append('tagToId', tagToId);
            }
            if (agent) {
                bodyFormData.append('agent_id', agent._id);
                if (originType) {
                    bodyFormData.append('origin.type', originType);
                    bodyFormData.append('origin.agent_id', agent._id);
                }
            }

            const response = await filesApi.upload(bodyFormData, {
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded / (progressEvent.total || 1)) * 100);

                    actions.updateFileById(tempId, { uploadProgress: progress });
                },
            });

            const uploadedFile = response.data?.value?.values?.[0];

            if (!uploadedFile) {
                console.error('No file returned from upload');
                actions.updateFileById(tempId, {
                    isUploading: false,
                    uploadError: true,
                    uploadProgress: 0,
                });

                return;
            }

            actions.updateFileById(tempId, {
                name: uploadedFile.name,
                location: uploadedFile.location,
                url: uploadedFile.url,
                _id: uploadedFile._id,
                groupName: groupName ?? undefined,
                size: uploadedFile.size,
                isUploading: false,
                uploadProgress: 100,
                uploadError: false,
            });
        } catch (error) {
            console.error(`Error uploading file: ${error}`);
            actions.updateFileById(tempId, {
                isUploading: false,
                uploadError: true,
                uploadProgress: 0,
            });
        }
    };

    const onChangeFile = (
        event: React.ChangeEvent<HTMLInputElement> | ClipboardEvent | DragEvent,
        groupName?: string | undefined,
        tagToField?: string,
        tagToId?: string,
    ): void => {
        try {
            const files =
                (event as React.ChangeEvent<HTMLInputElement>).target?.files ||
                (event as ClipboardEvent).clipboardData?.files ||
                (event as DragEvent).dataTransfer?.files;

            if (!files) return;

            // Re-validate file type (extension + MIME) — the picker's `accept` is bypassable.
            const inputEl = (event as React.ChangeEvent<HTMLInputElement>).target;
            const fileInput = inputEl instanceof HTMLInputElement && inputEl.type === 'file' ? inputEl : null;
            const accept = fileInput?.accept;
            const { accepted: typeValidFiles, rejected } = partitionFilesByAccept(files, accept);

            rejected.forEach((file) => showErrorToast(getFileTypeErrorMessage(file, accept)));
            if (rejected.length > 0 && fileInput) fileInput.value = '';
            if (typeValidFiles.length === 0) return;

            const validFiles = typeValidFiles.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
            const skippedCount = typeValidFiles.length - validFiles.length;

            if (skippedCount > 0) {
                showErrorToast(
                    skippedCount === 1 ? 'File exceeds 50MB limit' : `${skippedCount} file(s) exceed 50MB limit`,
                );
            }

            if (validFiles.length === 0) return;

            const isMultipleAllowed = (event as React.ChangeEvent<HTMLInputElement>).target?.multiple ?? true;

            const mappedFiles: FileType[] = validFiles.map((file) => {
                const tempId = generateTempId();

                return {
                    tempId,
                    name: file.name,
                    type: getFileType(file.name),
                    url: URL.createObjectURL(file),
                    groupName: groupName ?? undefined,
                    isUploading: true,
                    uploadProgress: 0,
                    uploadError: false,
                };
            });

            if (!isMultipleAllowed && validFiles.length > 0 && mappedFiles.length > 0) {
                const existingFiles = groupName ? uploadFiles.files.filter((f) => f.groupName !== groupName) : [];
                const firstFile = mappedFiles[0];
                const firstRawFile = validFiles[0];

                if (firstFile && firstRawFile) {
                    actions.setFiles([...existingFiles, firstFile]);
                    onUploadFile(firstRawFile, firstFile.tempId!, groupName, tagToField, tagToId);
                }
            } else {
                actions.setFiles([...uploadFiles.files, ...mappedFiles]);
                validFiles.forEach((file, index) => {
                    onUploadFile(file, mappedFiles[index].tempId!, groupName, tagToField, tagToId);
                });
            }
        } catch (err) {
            console.error('Error processing files:', err);
        }
    };

    return { onChangeFile };
};

export default useUploadFiles;

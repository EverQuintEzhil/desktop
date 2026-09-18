import { PaperclipIcon } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect } from 'react';

import type { useUploadFilesContext } from '@/context';
import type { PlusDropdownOption } from '@/types/chat';
import { showErrorToast, partitionFilesByAccept, getFileTypeErrorMessage } from '@/utils';

import {
    getImageUploadLimitMessage,
    isIncomingImageFile,
    isUploadedImageFile,
    limitUploadedImages,
} from '../../utils/model-image-upload-limit';

type UploadFilesOnChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    groupName?: string,
    tagToField?: string,
    tagToId?: string,
) => void;

interface UseGalleryImageUploadsArgs {
    maxImageUploads: number;
    uploadFiles: ReturnType<typeof useUploadFilesContext>['state'];
    uploadFileActions: ReturnType<typeof useUploadFilesContext>['actions'];
    uploadFilesOnChange: UploadFilesOnChange;
}

export interface UseGalleryImageUploadsResult {
    onChangeFile: (
        event: React.ChangeEvent<HTMLInputElement> | ClipboardEvent | DragEvent,
        groupName?: string,
        tagToField?: string,
        tagToId?: string,
    ) => void;
    getAddPhotoOption: (ref: React.RefObject<HTMLInputElement | null>) => PlusDropdownOption;
}

export const useGalleryImageUploads = (args: UseGalleryImageUploadsArgs): UseGalleryImageUploadsResult => {
    const { maxImageUploads, uploadFiles, uploadFileActions, uploadFilesOnChange } = args;

    const onChangeFile = useCallback(
        (
            event: React.ChangeEvent<HTMLInputElement> | ClipboardEvent | DragEvent,
            groupName?: string,
            tagToField?: string,
            tagToId?: string,
        ) => {
            const inputTarget = (event as React.ChangeEvent<HTMLInputElement>).target;
            const files =
                inputTarget?.files ||
                (event as ClipboardEvent).clipboardData?.files ||
                (event as DragEvent).dataTransfer?.files;

            if (!files) return;

            // Re-validate file type (extension + MIME) — the picker's `accept` is bypassable.
            // Gallery uploads are image-only, so fall back to `image/*` for drag/paste sources.
            const accept = inputTarget?.accept || 'image/*';
            const { accepted: typeValidFiles, rejected } = partitionFilesByAccept(files, accept);

            rejected.forEach((file) => showErrorToast(getFileTypeErrorMessage(file, accept)));
            if (rejected.length > 0 && inputTarget && 'value' in inputTarget) {
                inputTarget.value = '';
            }

            const existingImageCount = uploadFiles.files.filter(isUploadedImageFile).length;
            const remainingImageSlots = maxImageUploads - existingImageCount;
            let acceptedImageCount = 0;
            let skippedImageCount = 0;
            const dataTransfer = new DataTransfer();

            typeValidFiles.forEach((file) => {
                if (!isIncomingImageFile(file)) {
                    dataTransfer.items.add(file);

                    return;
                }

                if (acceptedImageCount < remainingImageSlots) {
                    dataTransfer.items.add(file);
                    acceptedImageCount += 1;
                } else {
                    skippedImageCount += 1;
                }
            });

            if (skippedImageCount > 0) {
                showErrorToast(getImageUploadLimitMessage(maxImageUploads));
            }

            if (dataTransfer.files.length === 0) {
                if (inputTarget && 'value' in inputTarget) {
                    inputTarget.value = '';
                }

                return;
            }

            uploadFilesOnChange(
                {
                    target: {
                        files: dataTransfer.files,
                        multiple: inputTarget?.multiple ?? true,
                    },
                } as React.ChangeEvent<HTMLInputElement>,
                groupName,
                tagToField,
                tagToId,
            );
        },
        [maxImageUploads, uploadFiles.files, uploadFilesOnChange],
    );

    useEffect(() => {
        if (!maxImageUploads) return;

        const nextFiles = limitUploadedImages(uploadFiles.files, maxImageUploads);

        if (nextFiles.length === uploadFiles.files.length) return;

        uploadFileActions.setFiles(nextFiles);
        showErrorToast(getImageUploadLimitMessage(maxImageUploads));
    }, [maxImageUploads, uploadFileActions, uploadFiles.files]);

    const getAddPhotoOption = useCallback(
        (ref: React.RefObject<HTMLInputElement | null>): PlusDropdownOption => ({
            label: 'Add photo',
            value: 'add-photo',
            icon: PaperclipIcon,
            onClick: () => {
                ref.current?.click();
            },
        }),
        [],
    );

    return { onChangeFile, getAddPhotoOption };
};

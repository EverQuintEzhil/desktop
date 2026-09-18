import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useUploadSkillFromZipMutation } from '@/lib/api/common/skills';
import { filesApi } from '@/lib/api/files-client';
import { getDefaultToastOptions, getSuccessToastOptions, getErrorToastOptions } from '@/utils/toast-theme';

interface UseSkillZipUploadOptions {
    onUploaded?: (skillId: string) => void;
}

export const useSkillZipUpload = ({ onUploaded }: UseSkillZipUploadOptions = {}) => {
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const uploadSkillFromZipMutation = useUploadSkillFromZipMutation();

    const isUploading = isUploadingFile || uploadSkillFromZipMutation.isPending;

    const uploadFile = useCallback(
        async (file: File) => {
            const toastId = toast.loading(`Uploading “${file.name}”…`, {
                ...getDefaultToastOptions(),
                duration: Infinity,
            });

            try {
                setIsUploadingFile(true);
                const formData = new FormData();

                formData.append('file', file);

                const uploadResponse = await filesApi.upload(formData);
                const fileId = uploadResponse.data?.value?.values?.[0]?._id;

                if (!fileId) {
                    throw new Error('Failed to get file ID from upload response');
                }

                const response = await uploadSkillFromZipMutation.mutateAsync({ fileId });

                if (response?._id) {
                    onUploaded?.(response._id);
                }

                toast.success('Skill uploaded successfully.', {
                    id: toastId,
                    ...getSuccessToastOptions(),
                });
            } catch (error) {
                const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
                const errorMessage =
                    axiosError.response?.data?.message || axiosError.message || 'Failed to upload skill zip.';

                toast.error(errorMessage, {
                    id: toastId,
                    ...getErrorToastOptions(),
                });
            } finally {
                setIsUploadingFile(false);
            }
        },
        [onUploaded, uploadSkillFromZipMutation],
    );

    return { isUploading, uploadFile };
};

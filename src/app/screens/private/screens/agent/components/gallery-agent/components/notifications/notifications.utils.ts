import { getFilesDownloadUrl } from '@/lib/axios';
import { modelDisplayName, type JobType } from '@/types/admin';

export const getThumbUrl = (job: JobType): string => {
    if (Array.isArray(job.output) && job.output?.[0]?.identifier) {
        return getFilesDownloadUrl(job.output[0].identifier, { thumbnail: 'true' });
    }
    if (typeof job.output === 'object' && job.output && 'identifier' in job.output && job.output?.identifier) {
        return getFilesDownloadUrl(job.output.identifier, { thumbnail: 'true' });
    }

    return getFilesDownloadUrl(job._id, { thumbnail: 'true' });
};

export const getJobModelDisplay = (job: JobType): { model: string; provider: string } => {
    if (typeof job.modelId === 'object' && job.modelId && (job.modelId.model || job.modelId.provider)) {
        return {
            model: modelDisplayName(job.modelId),
            provider: job.modelId.provider ?? '',
        };
    }

    if (job.model) {
        return {
            model: job.model.label?.trim() || job.model.refName || job.model.model || '',
            provider: job.model.provider ?? '',
        };
    }

    return { model: '', provider: '' };
};

export const getFailReasonText = (message?: string | null): string => {
    if (message === 'No image generated.') {
        return 'Resource has been exhausted.';
    }

    return message ?? '';
};

import { modelDisplayName, type JobType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';

import { isPendingStatus } from '../../utils/job-status';

import type { GalleryQueryKey, GalleryTab, StableFileKeys } from './types';

function getJobModelInfo(job: JobType): { id: string; model: string; provider: string } {
    if (typeof job.modelId === 'string') {
        return { id: job.modelId, model: '', provider: '' };
    }

    return {
        id: job.modelId?._id ?? '',
        model: modelDisplayName(job.modelId),
        provider: job.modelId?.provider ?? '',
    };
}

export const runningJobToPlaceholder = (
    job: JobType,
    userId: string,
    extension: 'png' | 'mp4' = 'png',
    creatorName: string,
): GeneratedItem => {
    const modelInfo = getJobModelInfo(job);

    return {
        _id: job._id,
        uniqueId: job._id,
        is_deleted: false,
        created_at: job.createdAt ? new Date(job.createdAt).getTime() : Date.now(),
        updated_at: job.updatedAt ? new Date(job.updatedAt).getTime() : Date.now(),
        title: job.message || '',
        meta: {
            aspect_ratio: 1,
            bitrate: 0,
            created: 0,
            dpi: 0,
            duration: 0,
            height: 0,
            modified: 0,
            size: 0,
            width: 0,
        },
        ai: {
            model_id: modelInfo.id,
            model_name: modelInfo.model,
            model_provider: modelInfo.provider,
            arguments: {
                prompt: '',
            },
        },
        url: '',
        creator_name: creatorName,
        creator_id: userId,
        extension,
        isMyItem: true,
        isRunning: true,
    };
};

export function getFileIdFromJob(job: JobType): string | undefined {
    const out = job.output;

    if (Array.isArray(out) && out[0]?.identifier) return out[0].identifier;
    if (out != null && typeof out === 'object' && 'identifier' in out)
        return (out as { identifier: string }).identifier;

    return undefined;
}

export function getTabFromSearchParams(searchParams: URLSearchParams): GalleryTab {
    const tab = searchParams.get('tab');

    if (tab === 'my' || tab === 'fav' || tab === 'firmwide') return tab;

    return 'my';
}

export const buildGalleryQueryKey = (
    agentId: string,
    creatorId: string | undefined,
    tab: GalleryTab,
    search: string,
): GalleryQueryKey => ['gallery-media', agentId, creatorId ?? null, tab, search.trim()];

export const mapFileToItem = (item: GeneratedItem, userId: string): GeneratedItem => ({
    ...item,
    uniqueId: `file-${item._id}`,
    isMyItem: item.creator_id === userId,
    isLikedByThisUser: (!!userId && item.likes?.includes(userId)) || false,
});

export const buildDisplayHistory = (
    serverItems: GeneratedItem[],
    jobs: JobType[],
    activeTab: GalleryTab,
    insertingJobIds: Set<string>,
    settlingJobIds: Set<string>,
    stableFileKeys: StableFileKeys,
    makePlaceholder: (job: JobType) => GeneratedItem,
): GeneratedItem[] => {
    if (activeTab !== 'my') return serverItems;

    const stableServerItems = serverItems.map((item) => {
        const stableKey = stableFileKeys[item._id];

        return stableKey ? { ...item, uniqueId: stableKey } : item;
    });

    const serverFileIds = new Set(serverItems.map((item) => item._id));
    const overlay: GeneratedItem[] = [];

    for (const job of jobs) {
        const fileId = getFileIdFromJob(job);
        const isAwaitingInsert = insertingJobIds.has(job._id) && !!fileId && !serverFileIds.has(fileId);
        const isSettling = settlingJobIds.has(job._id) && !!fileId && !serverFileIds.has(fileId);

        if (isPendingStatus(job.status) || isAwaitingInsert || isSettling) {
            overlay.unshift(makePlaceholder(job));
        }
    }

    return [...overlay, ...stableServerItems];
};

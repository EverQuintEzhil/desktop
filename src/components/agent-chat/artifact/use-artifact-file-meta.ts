import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';

import { appAgentApi } from '@/lib/api/app/agent';

export interface ArtifactFileMeta {
    isPublic: boolean;
    likesCount: number;
    isLikedByThisUser: boolean;
    creatorId?: string;
    creatorName?: string;
}

interface ArtifactFileDocument {
    isPublic: boolean;
    likesCount: number;
    likes: string[];
    creatorId?: string;
    creatorName?: string;
}

const EMPTY_DOCUMENT = {
    is_public: null,
    likes: null,
    likes_count: null,
    creator_id: null,
    creator_name: null,
};

const rawFileSchema = z
    .object({
        is_public: z.boolean().nullish().catch(null),
        likes: z.array(z.string()).nullish().catch(null),
        likes_count: z.number().nullish().catch(null),
        creator_id: z.string().nullish().catch(null),
        creator_name: z.string().nullish().catch(null),
    })
    .catch(EMPTY_DOCUMENT);

const fileDocumentSchema = rawFileSchema.transform((raw): ArtifactFileDocument => {
    const likes = raw.likes ?? [];

    return {
        isPublic: raw.is_public ?? false,
        likesCount: raw.likes_count ?? likes.length,
        likes,
        creatorId: raw.creator_id ?? undefined,
        creatorName: raw.creator_name ?? undefined,
    };
});

export const artifactFileMetaQueryKey = (artifactId: string) => ['artifact-file-meta', artifactId];

export const useArtifactFileMeta = (artifactId: string, userId?: string): ArtifactFileMeta | undefined => {
    const { data } = useQuery({
        queryKey: artifactFileMetaQueryKey(artifactId),
        queryFn: async ({ signal }) =>
            fileDocumentSchema.parse(await appAgentApi.getFile<unknown>(artifactId, { signal })),
        enabled: Boolean(artifactId),
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        retry: false,
    });

    if (!data) return undefined;

    return {
        isPublic: data.isPublic,
        likesCount: data.likesCount,
        isLikedByThisUser: Boolean(userId) && data.likes.includes(userId ?? ''),
        creatorId: data.creatorId,
        creatorName: data.creatorName,
    };
};

export const useArtifactLikeUpdate = (artifactId: string, userId: string) => {
    const queryClient = useQueryClient();

    return useCallback(
        (likesCount: number, isLikedByThisUser: boolean) => {
            queryClient.setQueryData<ArtifactFileDocument>(artifactFileMetaQueryKey(artifactId), (current) => {
                if (!current) return current;

                const others = current.likes.filter((id) => id !== userId);

                return {
                    ...current,
                    likesCount,
                    likes: isLikedByThisUser ? [...others, userId] : others,
                };
            });
        },
        [queryClient, artifactId, userId],
    );
};

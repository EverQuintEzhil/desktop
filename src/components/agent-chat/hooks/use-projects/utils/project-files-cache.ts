import type { QueryClient } from '@tanstack/react-query';

import type { FileUploadResult } from '@/lib/api/files-client';
import type { ProjectFileType } from '@/types/project';

import { projectsKeys } from '../query-keys';
import type { ProjectFilesData } from '../types';

const extensionFromName = (name: string): string => (name.split('.').pop() ?? '').replace(/^\./, '').toLowerCase();

export const mapUploadResultToProjectFile = (result: FileUploadResult, source: File): ProjectFileType => ({
    _id: result._id,
    name: result.name ?? source.name,
    type: (result.mimeType ?? source.type) || 'File',
    extension: extensionFromName(result.name ?? source.name),
    size: result.size ?? source.size,
    url: result.url,
    // Seed a pollable status so EmbeddingStatusBadge / useEmbeddingStatusPoll pick up progress.
    embedding_status: 'document-converting',
    createdAt: new Date().toISOString(),
});

/** Insert uploaded files at the front of page 0. No-op for ids already present. */
export const prependProjectFiles = (
    queryClient: QueryClient,
    projectId: string,
    filesToAdd: ProjectFileType[],
): void => {
    if (filesToAdd.length === 0) return;

    queryClient.setQueryData<ProjectFilesData>(projectsKeys.files(projectId), (current) => {
        const existingIds = new Set((current?.pages ?? []).flatMap((page) => page.files.map((file) => file._id)));
        const unique = filesToAdd.filter((file) => !existingIds.has(file._id));

        if (unique.length === 0) return current;

        if (!current || current.pages.length === 0) {
            return {
                pages: [{ files: unique, page: 0, totalPages: 1 }],
                pageParams: [0],
            };
        }

        const [first, ...rest] = current.pages;

        return {
            ...current,
            pages: [{ ...first, files: [...unique, ...first.files] }, ...rest],
        };
    });
};

/**
 * Drop a file from every page of the project-files infinite queries — the unfiltered list
 * and any search-filtered one, which the shared key prefix matches.
 */
export const removeProjectFileFromCache = (queryClient: QueryClient, projectId: string, fileId: string): void => {
    queryClient.setQueriesData<ProjectFilesData>({ queryKey: projectsKeys.files(projectId) }, (current) => {
        if (!current) return current;

        return {
            ...current,
            pages: current.pages.map((page) => ({
                ...page,
                files: page.files.filter((file) => file._id !== fileId),
            })),
        };
    });
};

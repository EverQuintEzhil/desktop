import type { LibraryItem, LibrarySort } from '@/components/agent-chat/hooks/use-media-library';
import type { ArtifactHead, ArtifactType } from '@/lib/api/app/artifact';

import type { LibraryEntry } from '../types';

interface BuildLibraryEntriesParams {
    files: LibraryItem[];
    artifacts: ArtifactHead[];
    searchQuery: string;
    sort: LibrarySort;
    artifactType?: ArtifactType;
}

const toTimestamp = (value: string): number => {
    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? 0 : parsed;
};

const matchesSearch = (artifact: ArtifactHead, searchQuery: string): boolean => {
    const term = searchQuery.trim().toLowerCase();

    if (!term) return true;

    return artifact.title.toLowerCase().includes(term);
};

const byUpdatedAt = (sort: LibrarySort) => (left: ArtifactHead, right: ArtifactHead) =>
    sort === 'oldest'
        ? toTimestamp(left.updatedAt) - toTimestamp(right.updatedAt)
        : toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);

export const buildLibraryEntries = (params: BuildLibraryEntriesParams): LibraryEntry[] => {
    const { files, artifacts, searchQuery, sort, artifactType } = params;

    const artifactEntries: LibraryEntry[] = artifacts
        .filter((artifact) => !artifactType || artifact.artifactType === artifactType)
        .filter((artifact) => matchesSearch(artifact, searchQuery))
        .sort(byUpdatedAt(sort))
        .map((artifact) => ({ kind: 'artifact', id: `artifact:${artifact.artifactId}`, artifact }));

    if (artifactType) return artifactEntries;

    const fileEntries: LibraryEntry[] = files.map((file) => ({ kind: 'file', id: `file:${file._id}`, file }));

    return [...artifactEntries, ...fileEntries];
};

export const countFileEntries = (entries: LibraryEntry[]): number =>
    entries.filter((entry) => entry.kind === 'file').length;

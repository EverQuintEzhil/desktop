import { useQuery } from '@tanstack/react-query';

import { appArtifactApi } from '@/lib/api/app/artifact';

const headQueryKey = (agentId: string, artifactId: string) => ['artifact', agentId, artifactId];

const versionsQueryKey = (agentId: string, artifactId: string) => ['artifact-versions', agentId, artifactId];

const versionQueryKey = (agentId: string, artifactId: string, versionNumber: number) => [
    'artifact-version',
    agentId,
    artifactId,
    versionNumber,
];

export const useArtifactHead = (agentId: string, artifactId: string) =>
    useQuery({
        queryKey: headQueryKey(agentId, artifactId),
        queryFn: ({ signal }) => appArtifactApi.getArtifact(artifactId, agentId, { signal }),
        enabled: Boolean(agentId && artifactId),
    });

export const useArtifactVersions = (agentId: string, artifactId: string) =>
    useQuery({
        queryKey: versionsQueryKey(agentId, artifactId),
        queryFn: ({ signal }) => appArtifactApi.listVersions(artifactId, agentId, { signal }),
        enabled: Boolean(agentId && artifactId),
    });

export const useArtifactVersion = (agentId: string, artifactId: string, versionNumber: number) =>
    useQuery({
        queryKey: versionQueryKey(agentId, artifactId, versionNumber),
        queryFn: ({ signal }) => appArtifactApi.getVersion(artifactId, agentId, versionNumber, { signal }),
        enabled: Boolean(agentId && artifactId && versionNumber > 0),
    });

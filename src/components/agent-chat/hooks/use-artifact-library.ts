import { useQuery } from '@tanstack/react-query';

import { appArtifactApi, type ArtifactHead } from '@/lib/api/app/artifact';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';

const ARTIFACT_LIBRARY_PAGE_SIZE = 200;

const ARTIFACT_LIBRARY_ERROR = 'Failed to load artifacts. Please try again.';

const NO_ARTIFACTS: ArtifactHead[] = [];

export const artifactLibraryQueryKey = (agentId?: string) => ['artifact-library', agentId ?? null];

interface UseArtifactLibraryOptions {
    agentId?: string;
    enabled?: boolean;
}

interface UseArtifactLibraryResult {
    artifacts: ArtifactHead[];
    isLoading: boolean;
    error: string | null;
}

const useArtifactLibrary = (options: UseArtifactLibraryOptions): UseArtifactLibraryResult => {
    const { agentId, enabled = true } = options;
    const isEnabled = enabled && Boolean(agentId);

    const query = useQuery({
        queryKey: artifactLibraryQueryKey(agentId),
        queryFn: ({ signal }) => {
            if (!agentId) throw new Error('An agent is required to list artifacts.');

            return appArtifactApi.listArtifacts({ agentId, size: ARTIFACT_LIBRARY_PAGE_SIZE }, { signal });
        },
        enabled: isEnabled,
    });

    if (!isEnabled) {
        return { artifacts: NO_ARTIFACTS, isLoading: false, error: null };
    }

    return {
        artifacts: query.data?.items ?? NO_ARTIFACTS,
        isLoading: query.isLoading,
        error: query.isError ? getApiErrorMessage(query.error, ARTIFACT_LIBRARY_ERROR) : null,
    };
};

export default useArtifactLibrary;

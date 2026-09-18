import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { downloadArtifact } from '@/components/agent-chat/artifact/artifact-download';
import { artifactLibraryQueryKey } from '@/components/agent-chat/hooks/use-artifact-library';
import { appArtifactApi, type ArtifactHead } from '@/lib/api/app/artifact';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { showErrorToast, showSuccessToast } from '@/utils';

const DOWNLOAD_ERROR = 'Failed to download artifact. Please try again later.';

const DELETE_ERROR = 'Failed to delete artifact. Please try again later.';

interface UseLibraryArtifactActionsParams {
    agentId?: string;
}

interface UseLibraryArtifactActionsResult {
    downloadArtifactItem: (artifact: ArtifactHead) => Promise<void>;
    downloadingArtifactId: string | null;
    deleteArtifactItem: (artifact: ArtifactHead) => Promise<boolean>;
    isArtifactDeleteSubmitting: boolean;
}

const useLibraryArtifactActions = (params: UseLibraryArtifactActionsParams): UseLibraryArtifactActionsResult => {
    const { agentId } = params;
    const queryClient = useQueryClient();
    const [downloadingArtifactId, setDownloadingArtifactId] = useState<string | null>(null);
    const [isArtifactDeleteSubmitting, setIsArtifactDeleteSubmitting] = useState(false);

    const downloadArtifactItem = async (artifact: ArtifactHead) => {
        if (!agentId) return;
        setDownloadingArtifactId(artifact.artifactId);
        try {
            const version = await appArtifactApi.getVersion(artifact.artifactId, agentId, artifact.latestVersion);

            downloadArtifact(version);
            showSuccessToast('Artifact downloaded');
        } catch (error) {
            showErrorToast(getApiErrorMessage(error, DOWNLOAD_ERROR));
        } finally {
            setDownloadingArtifactId(null);
        }
    };

    const deleteArtifactItem = async (artifact: ArtifactHead) => {
        if (!agentId) return false;
        setIsArtifactDeleteSubmitting(true);
        try {
            await appArtifactApi.deleteArtifact(artifact.artifactId, agentId);
            await queryClient.invalidateQueries({ queryKey: artifactLibraryQueryKey(agentId) });
            showSuccessToast('Artifact deleted');

            return true;
        } catch (error) {
            showErrorToast(getApiErrorMessage(error, DELETE_ERROR));

            return false;
        } finally {
            setIsArtifactDeleteSubmitting(false);
        }
    };

    return { downloadArtifactItem, downloadingArtifactId, deleteArtifactItem, isArtifactDeleteSubmitting };
};

export default useLibraryArtifactActions;

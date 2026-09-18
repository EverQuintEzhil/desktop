import { useQuery } from '@tanstack/react-query';

import { projectsKeys } from '@/components/agent-chat/hooks/use-projects';
import { appProjectsApi } from '@/lib/api/app/projects';
import { mapProject } from '@/types/project';

/**
 * The active space's local folder path, from the same detail query the rest of
 * the app uses (`projectsKeys.detail`), so an edit in the space dialog is
 * reflected here through the normal invalidation.
 */
export const useProjectFolderPath = (projectId: string | null): string | null => {
    const { data } = useQuery({
        queryKey: projectsKeys.detail(projectId ?? ''),
        enabled: Boolean(projectId),
        queryFn: async ({ signal }) => {
            const raw = await appProjectsApi.getProject<unknown>(projectId!, { signal });

            return mapProject(raw as never);
        },
    });

    return data?.folderPath?.trim() ? data.folderPath : null;
};

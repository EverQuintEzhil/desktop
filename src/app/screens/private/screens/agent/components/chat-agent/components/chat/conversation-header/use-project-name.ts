import { useQuery } from '@tanstack/react-query';

import { projectsKeys } from '@/components/agent-chat/hooks/use-projects';
import { appProjectsApi } from '@/lib/api/app/projects';
import { mapProject } from '@/types/project';

export const useProjectName = (projectId: string | null) => {
    const { data } = useQuery({
        queryKey: projectsKeys.detail(projectId ?? ''),
        enabled: Boolean(projectId),
        queryFn: async ({ signal }) => {
            const raw = await appProjectsApi.getProject<unknown>(projectId!, { signal });

            return mapProject(raw as never);
        },
    });

    return data?.name ?? '';
};

export default useProjectName;

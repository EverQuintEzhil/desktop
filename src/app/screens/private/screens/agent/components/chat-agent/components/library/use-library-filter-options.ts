import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { appAgentsApi } from '@/lib/api/app/agents';
import { appProjectsApi } from '@/lib/api/app/projects';
import type { AgentType } from '@/types/admin';
import type { ProjectType } from '@/types/project';

import type { EntitySelectOption } from './library-entity-select';

const OPTIONS_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

interface UseLibraryFilterOptionsParams {
    agentId?: string;
    agentSearch: string;
    projectSearch: string;
    enabled?: boolean;
}

interface UseLibraryFilterOptionsResult {
    agentOptions: EntitySelectOption[];
    projectOptions: EntitySelectOption[];
    isLoadingAgents: boolean;
    isLoadingProjects: boolean;
}

const useDebouncedValue = (value: string, delay: number): string => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
};

const toOption = (entity: { _id: string; name: string }): EntitySelectOption => ({
    value: entity._id,
    label: entity.name,
});

const useLibraryFilterOptions = (params: UseLibraryFilterOptionsParams): UseLibraryFilterOptionsResult => {
    const { agentId, agentSearch, projectSearch, enabled = true } = params;

    const debouncedAgentSearch = useDebouncedValue(agentSearch, SEARCH_DEBOUNCE_MS);
    const debouncedProjectSearch = useDebouncedValue(projectSearch, SEARCH_DEBOUNCE_MS);

    const agentsQuery = useQuery({
        queryKey: ['library-filter-agents', debouncedAgentSearch],
        queryFn: ({ signal }) =>
            appAgentsApi.listAgents<AgentType>(
                { mineOnly: true, size: OPTIONS_PAGE_SIZE, search: debouncedAgentSearch || undefined },
                { signal },
            ),
        enabled,
    });

    const projectsQuery = useQuery({
        queryKey: ['library-filter-projects', agentId, debouncedProjectSearch],
        queryFn: ({ signal }) =>
            appProjectsApi.listProjects<ProjectType>(
                { agentId, size: OPTIONS_PAGE_SIZE, search: debouncedProjectSearch || undefined },
                { signal },
            ),
        enabled: enabled && Boolean(agentId),
    });

    const agentOptions = (agentsQuery.data?.values ?? []).map(toOption);
    const projectOptions = (projectsQuery.data?.values ?? []).map(toOption);

    return {
        agentOptions,
        projectOptions,
        isLoadingAgents: agentsQuery.isLoading,
        isLoadingProjects: projectsQuery.isLoading,
    };
};

export default useLibraryFilterOptions;

import type { InfiniteData } from '@tanstack/react-query';

import type { ProjectFileType, ProjectScope, ProjectType } from '@/types/project';

export interface ProjectsListPage {
    projects: ProjectType[];
    page: number;
    totalPages: number;
}

export type ProjectFilesPage = {
    files: ProjectFileType[];
    page: number;
    totalPages: number;
};

export type ProjectFilesData = InfiniteData<ProjectFilesPage, number>;

export interface UseProjectsOptions {
    agentId: string;
    searchQuery: string;
    scope: ProjectScope;
    sortBy: string;
}

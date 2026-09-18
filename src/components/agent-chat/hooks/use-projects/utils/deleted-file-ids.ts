// Module-scoped: Knowledge tab mounts useProject in both project-detail (uploads) and
// ProjectFiles (deletes). A per-hook Set would miss the other instance's delayed merge.
const deletedProjectFileIdsByProject = new Map<string, Set<string>>();

export const deletedFileIdsFor = (projectId: string): Set<string> => {
    let ids = deletedProjectFileIdsByProject.get(projectId);

    if (!ids) {
        ids = new Set();
        deletedProjectFileIdsByProject.set(projectId, ids);
    }

    return ids;
};

/** Test-only: clear module-scoped delete suppressions between cases. */
export const resetDeletedProjectFileIdsForTests = (): void => {
    deletedProjectFileIdsByProject.clear();
};

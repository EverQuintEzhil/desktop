import type { DataStoreType } from '@/types/admin';

export type OkfFile = NonNullable<DataStoreType['okf']>['files'][number];

export interface OkfTreeNode {
    /** Segment shown in the explorer row. */
    name: string;
    /** Full file path for files, the folder prefix for folders. */
    path: string;
    isFolder: boolean;
    children: OkfTreeNode[];
}

const sortNodes = (nodes: OkfTreeNode[]): OkfTreeNode[] => {
    nodes.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;

        return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
        if (node.isFolder) sortNodes(node.children);
    });

    return nodes;
};

/** Turns the flat `okf.files` path list into a folders-first explorer tree. */
export const buildOkfTree = (files: OkfFile[]): OkfTreeNode[] => {
    const roots: OkfTreeNode[] = [];
    const folders = new Map<string, OkfTreeNode>();

    files.forEach((file) => {
        const segments = file.path.split('/').filter(Boolean);
        let siblings = roots;
        let prefix = '';

        segments.forEach((segment, index) => {
            prefix = prefix ? `${prefix}/${segment}` : segment;

            if (index === segments.length - 1) {
                siblings.push({
                    name: segment,
                    path: file.path,
                    isFolder: false,
                    children: [],
                });

                return;
            }

            let folder = folders.get(prefix);

            if (!folder) {
                folder = {
                    name: segment,
                    path: prefix,
                    isFolder: true,
                    children: [],
                };
                folders.set(prefix, folder);
                siblings.push(folder);
            }

            siblings = folder.children;
        });
    });

    return sortNodes(roots);
};

/** Every folder prefix in the bundle, used to expand the tree by default. */
export const collectOkfFolderPaths = (files: OkfFile[]): string[] => {
    const paths = new Set<string>();

    files.forEach((file) => {
        const segments = file.path.split('/').filter(Boolean);
        let prefix = '';

        segments.slice(0, -1).forEach((segment) => {
            prefix = prefix ? `${prefix}/${segment}` : segment;
            paths.add(prefix);
        });
    });

    return [...paths];
};

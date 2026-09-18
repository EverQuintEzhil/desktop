import { useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { skillsApi, SKILLS_QUERY_KEY, useSkillFilesQuery } from '@/lib/api/common/skills';
import { cn } from '@/lib/utils';

interface SkillTreeProps {
    skillId: string;
    selectedFile: string | null;
    onSelectFile: (path: string) => void;
}

interface SkillFileListItem {
    path: string;
    isFolder: boolean;
    isProtected?: boolean;
    content?: string;
}

type SkillFileApiEntry = {
    path: string;
    kind?: string;
    isFolder?: boolean;
    content?: string;
    metadata?: { isFolder?: boolean; isProtected?: boolean };
};

export const DEFAULT_SKILL_FILE = 'SKILL.md';

const getDisplayNameFromPath = (path: string) => {
    const parts = path.replace(/\/$/, '').split('/');

    return parts[parts.length - 1];
};

const normalizeSkillFileEntries = (
    entries: SkillFileApiEntry[] | undefined,
    folderPath: string,
    rootPath: string,
): SkillFileListItem[] => {
    return (entries ?? []).map((f) => {
        const path = (f.path.startsWith(rootPath) ? f.path.substring(rootPath.length) : f.path).replace(/\/$/, '');

        return {
            path,
            isFolder: Boolean(f.metadata?.isFolder || f.isFolder || f.kind === 'folder'),
            isProtected: Boolean(
                f.metadata?.isProtected || f.kind === 'skill-md' || (folderPath === '' && path === DEFAULT_SKILL_FILE),
            ),
            content: f.content,
        };
    });
};

const sortTreeItems = (items: SkillFileListItem[]) => {
    return [...items].sort((a, b) => {
        if (a.isFolder !== b.isFolder) {
            return a.isFolder ? -1 : 1;
        }

        return getDisplayNameFromPath(a.path).localeCompare(getDisplayNameFromPath(b.path));
    });
};

const SkillTree = ({ skillId, selectedFile, onSelectFile }: SkillTreeProps) => {
    const queryClient = useQueryClient();
    const rootPath = `skills/${skillId}/`;

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(() => new Set());

    const {
        data: folderFiles,
        isError: isFolderFilesError,
        isFetching: isFetchingRoot,
    } = useSkillFilesQuery(skillId, '');

    const getFolderItems = useCallback(
        (folderPath: string): SkillFileListItem[] => {
            const data =
                folderPath === ''
                    ? folderFiles
                    : queryClient.getQueryData<SkillFileApiEntry[]>([
                          ...SKILLS_QUERY_KEY,
                          'detail',
                          skillId,
                          'files',
                          folderPath,
                      ]);

            return sortTreeItems(normalizeSkillFileEntries(data as SkillFileApiEntry[], folderPath, rootPath));
        },
        [folderFiles, queryClient, rootPath, skillId],
    );

    const rootItems = useMemo(() => getFolderItems(''), [getFolderItems]);

    const ensureFolderLoaded = useCallback(
        async (folderPath: string) => {
            const queryKey = [...SKILLS_QUERY_KEY, 'detail', skillId, 'files', folderPath];

            if (queryClient.getQueryData(queryKey)) {
                return;
            }

            setLoadingFolders((prev) => new Set(prev).add(folderPath));

            try {
                await queryClient.fetchQuery({
                    queryKey,
                    queryFn: () => skillsApi.getFiles(skillId, folderPath),
                });
            } finally {
                setLoadingFolders((prev) => {
                    const next = new Set(prev);

                    next.delete(folderPath);

                    return next;
                });
            }
        },
        [queryClient, skillId],
    );

    const toggleFolderExpanded = useCallback(
        async (folderPath: string) => {
            if (expandedFolders.has(folderPath)) {
                setExpandedFolders((prev) => {
                    const next = new Set(prev);

                    next.delete(folderPath);

                    return next;
                });

                return;
            }

            setExpandedFolders((prev) => new Set(prev).add(folderPath));
            await ensureFolderLoaded(folderPath);
        },
        [ensureFolderLoaded, expandedFolders],
    );

    const handleItemClick = async (f: SkillFileListItem) => {
        if (f.isFolder) {
            await toggleFolderExpanded(f.path);

            return;
        }
        onSelectFile(f.path);
    };

    const renderFolderChevron = (f: SkillFileListItem, isExpanded: boolean, isFolderLoading: boolean) => {
        if (!f.isFolder) return null;
        if (isFolderLoading) return <Loader2Icon size={14} className="animate-spin" />;
        if (isExpanded) return <ChevronDownIcon size={14} />;

        return <ChevronRightIcon size={14} />;
    };

    const renderTreeRow = (f: SkillFileListItem, depth: number) => {
        const ItemIcon = f.isFolder ? FolderIcon : FileIcon;
        const isExpanded = expandedFolders.has(f.path);
        const isFolderLoading = loadingFolders.has(f.path);
        const indentStyle = { paddingLeft: `${depth * 16}px` };

        return (
            <div key={f.path} className="flex flex-col">
                <button
                    className={cn(
                        'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        selectedFile === f.path
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground',
                    )}
                    style={indentStyle}
                    onClick={() => handleItemClick(f)}
                >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {renderFolderChevron(f, isExpanded, isFolderLoading)}
                    </div>

                    <ItemIcon
                        size={14}
                        className={cn('shrink-0', f.isFolder ? 'text-primary/70' : 'text-muted-foreground')}
                    />
                    <span className="flex-1 truncate">{getDisplayNameFromPath(f.path)}</span>
                </button>
                {f.isFolder && isExpanded && (
                    <div className="flex flex-col">
                        {getFolderItems(f.path).map((child) => renderTreeRow(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (isFetchingRoot && rootItems.length === 0) {
        return (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                <Loader2Icon size={14} className="animate-spin" />
                <span>Loading files...</span>
            </div>
        );
    }

    if (isFolderFilesError) {
        return (
            <div className="px-2 py-1.5">
                <span className="text-xs font-medium text-destructive">Failed to load files</span>
            </div>
        );
    }

    return <div className="flex flex-col">{rootItems.map((f) => renderTreeRow(f, 0))}</div>;
};

export default SkillTree;

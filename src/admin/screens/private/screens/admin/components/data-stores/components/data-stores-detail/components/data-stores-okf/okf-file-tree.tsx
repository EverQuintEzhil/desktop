import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon } from 'lucide-react';
import { Fragment } from 'react';

import { cn } from '@/lib/utils';

import type { OkfTreeNode } from './okf-tree';

interface Props {
    nodes: OkfTreeNode[];
    depth: number;
    selectedPath?: string;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    onSelectFile: (path: string) => void;
}

/** Read-only explorer tree for the files inside an OKF bundle. */
const OkfFileTree = ({ nodes, depth, selectedPath, expandedFolders, onToggleFolder, onSelectFile }: Props) => (
    <>
        {nodes.map((node) => {
            const isExpanded = expandedFolders.has(node.path);
            const isSelected = !node.isFolder && node.path === selectedPath;
            const ItemIcon = node.isFolder ? FolderIcon : FileIcon;

            return (
                // A malformed bundle could hold both a file `a/b` and a file `a/b/c`, which
                // yields a file and a folder node sharing the path `a/b`. Type-prefix the
                // key so that stays a display quirk instead of a duplicate-key render bug.
                <Fragment key={`${node.isFolder ? 'dir' : 'file'}:${node.path}`}>
                    <button
                        type="button"
                        aria-expanded={node.isFolder ? isExpanded : undefined}
                        onClick={() => (node.isFolder ? onToggleFolder(node.path) : onSelectFile(node.path))}
                        style={{ paddingLeft: `${8 + depth * 16}px` }}
                        className={cn(
                            'flex w-full items-center gap-1 py-1.5 pr-2 text-left text-[13px] transition-colors',
                            isSelected ? 'bg-primary/6 text-primary' : 'text-text-primary hover:bg-primary/5',
                        )}
                    >
                        <span className="flex w-4 shrink-0 justify-center text-text-secondary">
                            {node.isFolder &&
                                (isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />)}
                        </span>
                        <ItemIcon
                            size={14}
                            className={cn('shrink-0', node.isFolder ? 'text-primary/70' : 'text-text-secondary')}
                        />
                        <span className="truncate">{node.name}</span>
                    </button>
                    {node.isFolder && isExpanded && (
                        <OkfFileTree
                            nodes={node.children}
                            depth={depth + 1}
                            selectedPath={selectedPath}
                            expandedFolders={expandedFolders}
                            onToggleFolder={onToggleFolder}
                            onSelectFile={onSelectFile}
                        />
                    )}
                </Fragment>
            );
        })}
    </>
);

export default OkfFileTree;

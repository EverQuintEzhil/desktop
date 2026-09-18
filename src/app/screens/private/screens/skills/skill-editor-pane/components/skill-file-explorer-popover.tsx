import { ChevronDownIcon, FileIcon } from 'lucide-react';

import { MarkdownViewToggle, type MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import SkillTree from '../../skill-tree';
import { isMarkdownFile } from '../utils/is-file-type';

export interface Props {
    skillId: string;
    selectedFile: string | null;
    onSelectFile: (path: string) => void;
    isExplorerOpen: boolean;
    onExplorerOpenChange: (open: boolean) => void;
    mdViewMode: MarkdownViewMode;
    onMdViewModeChange: (mode: MarkdownViewMode) => void;
}

const SkillFileExplorerPopover = ({
    skillId,
    selectedFile,
    onSelectFile,
    isExplorerOpen,
    onExplorerOpenChange,
    mdViewMode,
    onMdViewModeChange,
}: Props) => (
    <div className="flex shrink-0 items-center gap-2">
        <Popover open={isExplorerOpen} onOpenChange={onExplorerOpenChange} modal={true}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground transition-colors',
                        'cursor-pointer outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                >
                    <FileIcon size={14} className="shrink-0 text-muted-foreground" />
                    <span className="max-w-[200px] truncate">
                        {selectedFile ? selectedFile.split('/').pop() : 'Select a file...'}
                    </span>
                    <ChevronDownIcon size={14} className="ml-0.5 shrink-0 text-muted-foreground opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="flex h-[400px] w-xs flex-col overflow-hidden rounded-xl border border-border-secondary p-0 shadow-lg"
            >
                <div className="flex min-h-[41px] shrink-0 items-center border-b border-border-secondary bg-muted/20 px-3 py-2">
                    <span className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                        Explorer
                    </span>
                </div>
                <div className="scrollbar-controller scrollbar-vertical flex-1 py-2">
                    {skillId && (
                        <SkillTree
                            skillId={skillId}
                            selectedFile={selectedFile}
                            onSelectFile={(path) => {
                                onSelectFile(path);
                                onExplorerOpenChange(false);
                            }}
                        />
                    )}
                </div>
            </PopoverContent>
        </Popover>
        {selectedFile && isMarkdownFile(selectedFile) && (
            <MarkdownViewToggle mode={mdViewMode} onModeChange={onMdViewModeChange} className="ml-auto" />
        )}
    </div>
);

export default SkillFileExplorerPopover;

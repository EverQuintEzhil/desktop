import { BrainCircuitIcon, SettingsIcon } from 'lucide-react';

import MemoryPreferenceRow from '@/components/agent-memories/memory-preference-row';
import {
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useAgentMemories } from '@/hooks/use-agent-memories';
import type { AgentType, LauncherType } from '@/types/admin';

export interface MemoriesSubmenuProps {
    agent: AgentType | LauncherType | null;
    onManage?: () => void;
    align?: 'start' | 'end';
}

const MemoriesSubmenu = ({ agent, onManage, align = 'start' }: MemoriesSubmenuProps) => {
    const { memories, isLoading } = useAgentMemories(agent, true);

    const renderMemories = () => {
        if (isLoading) {
            return <DropdownMenuItem disabled>Loading memories...</DropdownMenuItem>;
        }

        if (memories.length === 0) {
            return <DropdownMenuItem disabled>No memories available</DropdownMenuItem>;
        }

        return (
            <div className="flex flex-col gap-3 p-2">
                {memories.map((memory) => (
                    <MemoryPreferenceRow key={memory._id} memoryId={memory._id} memoryName={memory.name} />
                ))}
            </div>
        );
    };

    const renderManageRow = () => {
        if (!onManage) {
            return null;
        }

        return (
            <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onManage} className="cursor-pointer">
                    <SettingsIcon className="h-4 w-4" />
                    <span>Manage memories</span>
                </DropdownMenuItem>
            </>
        );
    };

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <BrainCircuitIcon className="h-4 w-4" />
                <span>Memories</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent align={align} className="max-w-[300px] min-w-56 p-0">
                <div className="scrollbar-vertical scrollbar-controller max-h-[300px]">{renderMemories()}</div>
                {renderManageRow()}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
};

export default MemoriesSubmenu;

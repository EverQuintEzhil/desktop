import { FolderIcon } from 'lucide-react';

import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';

import SpacePickerList from './space-picker-list';

interface Props {
    agentId: string;
    selectedProjectId?: string;
    label?: string;
    onSelect: (projectId: string | null) => void;
}

const AddToProjectMenu = ({ agentId, selectedProjectId, label = 'Add to space', onSelect }: Props) => {
    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <FolderIcon className="size-3.5" />
                {label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[240px] p-0">
                <SpacePickerList agentId={agentId} selectedProjectId={selectedProjectId} onSelect={onSelect} />
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
};

export default AddToProjectMenu;

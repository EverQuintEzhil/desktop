import { ChevronLeftIcon } from 'lucide-react';

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

import SpacePickerList from './space-picker-list';

interface Props {
    agentId: string;
    selectedProjectId?: string;
    label: string;
    onBack: () => void;
    onSelect: (projectId: string | null) => void;
}

const SpacePickerDrillDown = (props: Props) => {
    const { agentId, selectedProjectId, label, onBack, onSelect } = props;

    return (
        <>
            <DropdownMenuItem
                className="space-picker-drill-down-back cursor-pointer font-medium"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onBack();
                }}
            >
                <ChevronLeftIcon className="size-3.5" />
                {label}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-0" />
            <SpacePickerList agentId={agentId} selectedProjectId={selectedProjectId} onSelect={onSelect} />
        </>
    );
};

export default SpacePickerDrillDown;

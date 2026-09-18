import { ChevronDownIcon, FolderIcon, XIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import SpacePickerList from '@/app/screens/private/screens/agent/components/chat-agent/components/chat/chat-side-bar/space-picker-list';
import { useProjectName } from '@/app/screens/private/screens/agent/components/chat-agent/components/chat/conversation-header/use-project-name';
import { Button } from '@/components/ui/button';
import { DropdownMenuContent, DropdownMenuRoot, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface Props {
    agentId: string;
    value: string;
    /** Shown until `GET /projects/:id` resolves, so an edited routine never flashes a nameless chip. */
    fallbackName?: string;
    onChange: (projectId: string) => void;
}

const SpaceField = ({ agentId, value, fallbackName, onChange }: Props) => {
    const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
    const initialValue = useRef(value).current;
    const fetchedName = useProjectName(value || null);

    const resolveName = (): string => {
        if (picked?.id === value) return picked.name;
        if (fetchedName) return fetchedName;
        if (value === initialValue && fallbackName) return fallbackName;

        return 'Space';
    };

    return (
        <DropdownMenuRoot>
            <div className="space-field flex min-w-0 items-center rounded-full bg-muted transition-colors hover:bg-border">
                <DropdownMenuTrigger asChild disabled={!agentId}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'h-7 min-w-0 gap-1.5 rounded-full bg-transparent px-2.5 text-xs font-normal text-(--text-secondary)',
                            'hover:bg-transparent hover:text-(--text-primary)',
                            value ? 'pr-1' : '',
                        )}
                    >
                        <span className="sr-only">Space</span>
                        <FolderIcon aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="max-w-[160px] truncate">{value ? resolveName() : 'Work in a space'}</span>
                        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[280px] p-0">
                    <SpacePickerList
                        agentId={agentId}
                        selectedProjectId={value || undefined}
                        onSelect={(projectId, project) => {
                            setPicked(projectId && project ? { id: projectId, name: project.name } : null);
                            onChange(projectId ?? '');
                        }}
                    />
                    <p className="border-t border-border px-3 py-2 text-xs text-(--text-secondary)">
                        Everyone in this space can see the routine and its reports.
                    </p>
                </DropdownMenuContent>
                {value ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Clear space"
                        className="mr-1 size-5 shrink-0 rounded-full bg-transparent text-(--text-secondary) hover:bg-border-secondary hover:text-(--text-primary)"
                        onClick={() => onChange('')}
                    >
                        <XIcon aria-hidden="true" className="size-3" />
                    </Button>
                ) : null}
            </div>
        </DropdownMenuRoot>
    );
};

export default SpaceField;

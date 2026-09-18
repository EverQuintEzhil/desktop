import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import Select, { type ComboboxOption } from '@/components/ui/select';

import { agentsPageQuery, loadChatAgentOptions } from '../utils/chat-agent-options';

export const ALL_AGENTS = '__all__';

/** An agent name has no length bound, so the trigger reserves fixed room and truncates to keep the header from reflowing. */
const TRIGGER_WIDTH_CLASS_NAME = 'w-[190px]';

interface Props {
    value: string | null;
    onChange: (agentId: string | null) => void;
    /** Names the current selection before the option list has been opened. */
    selectedName?: string;
}

const RoutineAgentFilter = ({ value, onChange, selectedName }: Props) => {
    const queryClient = useQueryClient();

    // Warms the unsearched page while the header renders, so opening the menu never waits on the network.
    useQuery(agentsPageQuery(''));

    const loadAgentOptions = useCallback(
        async (query: string): Promise<ComboboxOption<string>[]> => {
            const agents = await loadChatAgentOptions(queryClient, query.trim());

            // Offered whatever the search says: otherwise typing hides the only way back to the full list.
            return [
                { value: ALL_AGENTS, label: 'All agents' },
                ...agents.map((agent) => ({ value: agent._id, label: agent.name })),
            ];
        },
        [queryClient],
    );

    return (
        <Select<string>
            options={loadAgentOptions}
            value={value}
            allowSearch
            variant="outline"
            ariaLabel="Filter routines by agent"
            placeholder="All agents"
            searchPlaceholder="Search agents"
            emptyText="No agent found."
            defaultOption={value && selectedName ? { value, label: selectedName } : undefined}
            className={`h-8 shrink-0 rounded-full border-secondary bg-secondary text-secondary-foreground hover:bg-accent/80 ${TRIGGER_WIDTH_CLASS_NAME}`}
            popoverClassName="w-72 max-w-72"
            onChange={(next) => onChange(next && next !== ALL_AGENTS ? next : null)}
        />
    );
};

export default RoutineAgentFilter;

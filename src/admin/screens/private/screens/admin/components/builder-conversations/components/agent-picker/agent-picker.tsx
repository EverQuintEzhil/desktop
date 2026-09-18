import { useCallback, useRef } from 'react';

import Select, { type PaginatedSelectData } from '@/components/ui/select';
import { adminAgentsApi } from '@/lib/api/admin/agents';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';

const AGENTS_PAGE_SIZE = 20;

interface Props {
    selectedSlug: string | null;
    /** Supplies the trigger label for a deep link, before the option list has been fetched. */
    selectedAgent: AgentType | null;
    /** Name carried from wherever the agent was picked, so the trigger never shows a raw slug. */
    fallbackLabel?: string;
    /** The chooser wants a full-width control, the header bar a compact one. */
    className?: string;
    onChange: (slug: string | null, name?: string) => void;
}

const AgentPicker = (props: Props) => {
    const { selectedSlug, selectedAgent, fallbackLabel, className, onChange } = props;

    // `Select` hands back only the value it was given, so the names it just rendered are kept
    // here to pass along on selection — the next screen shows the name without waiting for
    // the agent request to land.
    const namesBySlugRef = useRef(new Map<string, string>());

    const fetchAgents = useCallback(async (query: string, page: number = 0): Promise<PaginatedSelectData<string>> => {
        const result = await adminAgentsApi.list({
            page,
            size: AGENTS_PAGE_SIZE,
            search: query,
            sortBy: ['name:asc'],
        });

        for (const agent of result.values) {
            namesBySlugRef.current.set(agent.slug, agent.name);
        }

        return {
            list: result.values.map((agent) => ({
                value: agent.slug,
                label: agent.name,
            })),
            pageInfo: {
                page: result.pageInfo.page,
                total_pages: result.pageInfo.totalPages,
            },
        };
    }, []);

    const handleChange = useCallback(
        (slug: string | null) => {
            onChange(slug, slug ? namesBySlugRef.current.get(slug) : undefined);
        },
        [onChange],
    );

    // On a cold deep link neither the agent request nor the option list has resolved. The slug
    // is the last resort — an honest stand-in, where the placeholder would claim nothing is
    // selected.
    const resolveTriggerOption = () => {
        if (selectedAgent) return { value: selectedAgent.slug, label: selectedAgent.name };
        if (!selectedSlug) return undefined;

        return { value: selectedSlug, label: fallbackLabel ?? selectedSlug };
    };

    return (
        <Select<string>
            allowSearch
            variant="ghost"
            className={cn('w-full', className)}
            triggerLabelClassName="flex-1 text-left"
            placeholder="Select an agent"
            searchPlaceholder="Search agents..."
            emptyText="No agents found."
            options={fetchAgents}
            value={selectedSlug}
            defaultOption={resolveTriggerOption()}
            onChange={handleChange}
        />
    );
};

export default AgentPicker;

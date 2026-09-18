import Select from '@/components/ui/select';

/**
 * The endpoint's own `sortBy` vocabulary, stored verbatim so the URL, the query key and the request all
 * read the same. One direction each: the reverse of any of these answers a question nobody asks here.
 */
const OPTIONS = [
    { label: 'Name (A-Z)', value: 'name:asc' },
    { label: 'Last used date', value: 'lastInteractedAt:desc' },
    { label: 'Created date', value: 'createdAt:desc' },
] as const;

export type AgentSortValue = (typeof OPTIONS)[number]['value'];

export const AGENT_SORTS = OPTIONS.map((option) => option.value);

export const DEFAULT_AGENT_SORT: AgentSortValue = 'name:asc';

interface Props {
    value: AgentSortValue;
    onChange: (value: AgentSortValue) => void;
}

const AgentSort = ({ value, onChange }: Props) => (
    <Select
        value={value}
        onChange={(next) => {
            if (next != null) onChange(next);
        }}
        options={[...OPTIONS]}
        ariaLabel="Sort agents"
        variant="ghost"
        triggerAlign="end"
        popoverClassName="w-auto max-w-none min-w-[170px] rounded-2xl"
        className="agent-sort h-auto shrink-0 border-0 bg-transparent px-0 shadow-none hover:bg-transparent"
        triggerLabelClassName="text-xs font-medium text-text-secondary"
        triggerChevronIconClassName="size-3.5 text-text-secondary"
    />
);

export default AgentSort;

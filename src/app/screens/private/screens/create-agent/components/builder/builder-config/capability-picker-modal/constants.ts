import type { PickerItemKind } from '@/app/components/picker/picker-shared';

export const KIND_GROUP_LABEL: Record<PickerItemKind, string> = {
    mcp: 'Connector',
    agent: 'Agents',
    tool: 'Tools',
    memory: 'Memories',
};

export const KIND_PLURAL_LOWER: Record<PickerItemKind, string> = {
    mcp: 'connectors',
    agent: 'agents',
    tool: 'tools',
    memory: 'memories',
};

export const KIND_NOUN: Record<PickerItemKind, string> = {
    mcp: 'Connector',
    agent: 'agent',
    tool: 'tool',
    memory: 'memory',
};

export const rowBase =
    'flex items-center gap-3 min-h-[54px] px-3 py-[10px] rounded-2xl' +
    ' bg-transparent border border-transparent cursor-pointer text-h6' +
    ' text-left w-full text-(--text-primary) transition-[background,border-color,color] duration-140' +
    ' hover:bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]' +
    ' hover:border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]' +
    ' disabled:opacity-50 disabled:cursor-not-allowed';
export const rowActive =
    'bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]' +
    ' border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] text-primary';

export const btnCls =
    'rounded-xl text-text-secondary hover:text-primary hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]';

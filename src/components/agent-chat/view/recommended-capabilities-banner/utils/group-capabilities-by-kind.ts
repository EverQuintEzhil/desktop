import type { NoAccessKind } from '../types';

/** Connectors then skills, matching the order the chip rows already use. */
const SECTION_ORDER: NoAccessKind[] = ['connector', 'skill', 'data-store', 'tool', 'agent'];

const SECTION_LABELS: Record<NoAccessKind, string> = {
    connector: 'Connectors',
    skill: 'Skills',
    'data-store': 'Data stores',
    tool: 'Tools',
    agent: 'Agents',
};

export interface CapabilitySection<T> {
    kind: NoAccessKind;
    label: string;
    items: T[];
}

export const groupCapabilitiesByKind = <T extends { kind: NoAccessKind }>(
    items: readonly T[],
): CapabilitySection<T>[] =>
    SECTION_ORDER.map((kind) => ({
        kind,
        label: SECTION_LABELS[kind],
        items: items.filter((item) => item.kind === kind),
    })).filter((section) => section.items.length > 0);

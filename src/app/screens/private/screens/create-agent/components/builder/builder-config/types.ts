import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Primary rows stay visible; Tools / DB+API stores / Agents / Memories sit under Advanced.
// `technical` doubles as the CAPABILITY_INFO key for the detail dialog.
export interface CapabilityRow {
    technical: string;
    title: string;
    help: string;
    Icon: LucideIcon;
    chips: ReactNode;
    onAdd: () => void;
    addLabel: string;
}

export type NamedItem = { _id: string; name: string; provider?: string };

export type RemovableItemType = 'skill' | 'data store' | 'connector' | 'agent' | 'tool' | 'memory' | 'model';

export interface ItemPendingRemoval extends NamedItem {
    type: RemovableItemType;
}

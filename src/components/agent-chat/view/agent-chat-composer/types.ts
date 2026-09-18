import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';

export type ComposerTriggerType = 'mention' | 'command';

export interface ComposerTriggerState {
    type: ComposerTriggerType;
    query: string;
    start: number;
    end: number;
    position?: CSSProperties;
}

export interface ComposerSuggestion {
    id: string;
    label: string;
    description?: string;
    section?: string;
    icon: LucideIcon;
    serverUrl?: string;
    onSelect: () => void;
}

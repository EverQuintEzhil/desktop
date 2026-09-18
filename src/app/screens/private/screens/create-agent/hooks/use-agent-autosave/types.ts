import type { ChatAgentUiType } from '@/types/ui';

import type { AgentConfigDraft, AgentConfigItem } from '../../types';

export interface PersistedSnapshot {
    name: string;
    instructions: string;
    models: AgentConfigItem[];
    mcpServers: AgentConfigItem[];
    agentIds: string[];
    toolIds: string[];
    dataStoreIds: string[];
    skills: AgentConfigItem[];
    memoryIds: string[];
}

export interface AgentAutosaveState {
    saving: boolean;
    saved: boolean;
    hasPendingChanges: boolean;
    isPublishing: boolean;
    originalInstructions: string;
    synchronizePersistedState: (config: AgentConfigDraft, seed: AgentAutosaveSeed) => void;
    getIsDirty: () => boolean;
    hasUnsavedLocalEdits: () => boolean;
    publishAll: () => Promise<void>;
    discardPending: () => Promise<string>;
    getUiConfig: () => ChatAgentUiType | undefined;
    getPublishedUiConfig: () => ChatAgentUiType | undefined;
    getDescription: () => string;
    saveChannelUiConfig: (next: ChatAgentUiType) => Promise<void>;
    saveChannelDescription: (description: string) => Promise<void>;
    hasPendingUiConfig: boolean;
    discardModelPending: () => Promise<{ ok: boolean; models?: AgentConfigItem[] }>;
    discardAppearancePending: () => Promise<boolean>;
}

export interface AgentAutosaveSeed {
    systemPromptCodeId?: string;
    systemPromptVersion?: string;
    uiConfigCodeId?: string;
    uiConfigVersion?: string;
    uiConfig?: ChatAgentUiType;
    description?: string;
    defaultInstructions?: string;
    pendingCodeId?: string;
    pendingVersion?: string;
    pendingUiConfigCodeId?: string;
    pendingUiConfigVersion?: string;
    pendingUiConfig?: ChatAgentUiType;
}

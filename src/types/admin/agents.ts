import type { SelectSuggestionItem } from '@/components';
import type { AgentUiType, ApiAgentUiType, AppAgentUiType, ChatAgentUiType, GalleryAgentUiType } from '@/types/ui';

import type { AppType } from './apps';
import type { DataStoreType } from './data-stores';
import type { LauncherType } from './launchers';
import type { McpType } from './mcp';
import type { MemoryType } from './memory';
import type { ModelType } from './models';
import type { SkillType } from './skills';
import type { ToolType } from './tools';
import type { SecurityGroupType, UserType } from './users';

export type AgentTypeEnum = 'chat' | 'api';

export type AgentSettingsType = {
    allowCustomSkills?: boolean;
    allowSharedSkills?: boolean;
    allowCustomConnectors?: boolean;
    allowSharedConnectors?: boolean;
};

export type AgentType = {
    readonly _id: string;
    name: string;
    description: string;
    detailedDescription: string;
    identifier: string;
    slug: string;
    mcpExposable: boolean;
    version: 'v1' | 'v2';
    systemPromptCodeId: string;
    uiConfigCodeId: string;
    modelConfigCodeId: string;
    tools: ToolType[];
    defaultModelId?: string;
    parameters: object;
    dataStores: DataStoreType[];
    mcpServers: McpType[];
    models?: ModelType[];
    agents?: AgentType[];
    admins: UserType[] | string[];
    skills?: SkillType[];
    memories?: MemoryType[];
    apps?: AppType[];
    includeUsers: UserType[];
    includeSecurityGroups: SecurityGroupType[];
    excludeUsers: UserType[];
    excludeSecurityGroups: SecurityGroupType[];
    tags: string[];
    dynamicFields: [];
    isPublished: boolean;
    historyEnabled: boolean;
    historySpec: object;
    conversationsEnabled: boolean;
    type: AgentTypeEnum;
    launcher?: LauncherType;
    uiConfig: AgentUiType | null;
    settings?: AgentSettingsType | null;
    dev: boolean;
    isDeleted: boolean;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
    /** When the signed-in user last opened or messaged this agent. List responses only; `null` until they do. */
    lastInteractedAt?: string | null;
    noAccess?: boolean;
};

export type ChatAgentType = Omit<AgentType, 'uiConfig'> & { uiConfig: ChatAgentUiType };
export type ApiAgentType = Omit<AgentType, 'uiConfig'> & { uiConfig: ApiAgentUiType };
export type GalleryAgentType = Omit<AgentType, 'uiConfig'> & { uiConfig: GalleryAgentUiType };
export type AppAgentType = Omit<AgentType, 'uiConfig'> & { uiConfig: AppAgentUiType };

export interface DynamicFormType {
    [key: string]: string | string[] | SelectSuggestionItem<string> | SelectSuggestionItem<string>[] | object;
}

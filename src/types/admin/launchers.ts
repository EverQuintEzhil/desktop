import type { AgentType } from './agents';
import type { SecurityGroupType, UserType } from './users';

export type LauncherTypeEnum = 'agent' | 'link';

export type LauncherType = {
    readonly _id: string;
    name: string;
    urlOrSlug: string;
    description: string;
    detailedDescription: string;
    sortOrder: number;
    agent: AgentType;
    includeUsers: UserType[];
    includeSecurityGroups: SecurityGroupType[];
    excludeUsers: UserType[];
    excludeSecurityGroups: SecurityGroupType[];
    tags: string[];
    agentId?: LauncherAgentType;
    isPublished: boolean;
    type: LauncherTypeEnum;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
    lastInteractedAt?: string | null;
};
export interface LauncherAgentType {
    readonly _id: string;
    name: string;
    slug?: string;
}

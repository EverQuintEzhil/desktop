import type { AgentType } from './agents';
import type { ModelType } from './models';
import type { UserType } from './users';

export type PromptType = {
    readonly _id: string;
    name: string;
    description: string;
    prompt: string;
    agentIds: string[] | AgentType[];
    aimodelIds: string[] | ModelType[];
    relatedPrompts: string[] | PromptType[];
    isPublished: boolean;
    isPrivate: boolean;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
};

import type { AgentType } from './agents';
import type { ModelType } from './models';
import type { UserType } from './users';

export interface JobOutputItem {
    type: string;
    identifier: string;
    isDeleted?: boolean;
}

export type JobStatusEnum = 'queued' | 'running' | 'completed' | 'failed' | 'retry-queued' | 'killed' | 'cancelled';

export interface JobType {
    _id: string;
    type: 'text' | 'image' | 'video' | 'audio';
    agentId: string | { _id: string; name?: string; slug?: string };
    modelId: string | { _id: string; provider?: string; model?: string; label?: string | null };
    agent: AgentType;
    model: ModelType | null;
    status: JobStatusEnum;
    arguments?: unknown;
    output?: JobOutputItem[] | JobOutputItem;
    fileIds?: string[];
    link?: string;
    message?: string;
    failReason?: { message?: string } | null;
    isRead?: boolean;
    isDeleted?: boolean;
    creator: UserType;
    createdAt?: string;
    updatedAt?: string;
}

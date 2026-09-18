import type { UserType } from './users';

export type CodeTypeEnum = 'tool' | 'agent_system_prompt' | 'agent_ui_config' | 'agent_model_config' | 'memory_code';

export type CodeLangEnum = 'lua' | 'markdown' | 'plain_text' | 'json';

export type CodeType = {
    _id: string;
    toolId: string;
    version: string;
    type: CodeTypeEnum;
    lang: CodeLangEnum;
    code: string;
    updatedById: string;
    creatorId: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    creator: UserType;
    updatedBy: UserType;
};

import type { SkillPreference } from '@/lib/api';

import type { SkillFileType } from './files';
import type { SecurityGroupType, UserType } from './users';

export type SkillType = {
    readonly _id: string;
    name: string;
    description: string;
    skillMarkdown: string;
    body: string;
    frontmatter: object;
    metadata: object;
    files: SkillFileType[];
    admins?: UserType[];
    adminIds: string[];
    includeUsers?: UserType[];
    includeUserIds: string[];
    excludeUsers?: UserType[];
    excludeUserIds: string[];
    includeSecurityGroups?: SecurityGroupType[];
    includeSecurityGroupIds: string[];
    excludeSecurityGroups?: SecurityGroupType[];
    excludeSecurityGroupIds: string[];
    creator?: UserType;
    updatedBy?: UserType;
    createdAt?: string;
    updatedAt?: string;
    preference?: SkillPreference | null;
    category?: 'personal' | 'enterprise';
    globalEnabled?: boolean;
    isRecommended?: boolean;
    agentEnabled?: boolean | null;
    effectiveEnabled?: boolean;
    noAccess?: boolean;
};

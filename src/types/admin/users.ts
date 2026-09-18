type Role = 'user' | 'admin' | 'owner';

export type UserType = {
    readonly _id: string;
    name: {
        first: string;
        middle?: string;
        last: string;
    };
    role: Role;
    avatar: string;
    email: string;
    otherEmails: string[];
    mobile: string;
    defaultLanguage: string;
    timezone: string;
    timezoneOffset: string;
    tags: string[];
    portalAccessEnabled: boolean;
    customFields?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
};

export type SecurityGroupType = {
    readonly _id: string;
    name: string;
    adminIds: UserType[];
    memberIds: UserType[];
    securityGroupIds: SecurityGroupType[];
    creatorId?: string;
    userIds: [];
};

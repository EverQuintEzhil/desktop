import type { McpServerPreference } from '@/lib/api';

import type { SecurityGroupType, UserType } from './users';

export const AUTH_TYPE_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'oauth', label: 'OAuth' },
    { value: 'api-key', label: 'API Key' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'basic', label: 'Basic Authentication' },
];

export const CREDENTIAL_AUTH_TYPES = ['api-key', 'bearer', 'basic', 'oauth'];

export const DCR_HINT =
    'Dynamic Client Registration: the server issues the client itself. Turn this off to enter a client ID and secret yourself.';

export type AuthType = 'none' | 'api-key' | 'oauth' | 'basic' | 'bearer';

export type McpType = {
    readonly _id: string;
    name: string;
    description: string;
    serverUrl: string;
    resourceMetadataUrl: string;
    isRecommended?: boolean;
    authType: string;
    authCredentials: object;
    isDcr?: boolean;
    isDev: boolean;
    requireApproval: boolean;
    timeout: number;
    retryAttempts: number;
    sslVerify: boolean;
    headers: object | null;
    transport: string;
    command: string | null;
    args: object | null;
    env: object | null;
    version: string;
    capabilities: object | null;
    status: 'active' | 'inactive';
    includeUsers: UserType[];
    includeSecurityGroups: SecurityGroupType[];
    excludeUsers: UserType[];
    excludeSecurityGroups: SecurityGroupType[];
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
    preference?: McpServerPreference | null;
    globalEnabled?: boolean;
    agentEnabled?: boolean | null;
    effectiveEnabled?: boolean;
    connection?: { status: string; tokenExpiry: string | null } | null;
    noAccess?: boolean;
};

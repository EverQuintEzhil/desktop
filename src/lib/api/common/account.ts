import { useQuery } from '@tanstack/react-query';
import qs from 'qs';

import type { KeyboardPreferences } from '@/hooks/keyboard-shortcuts/types';
import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

export interface UserPreferences {
    keyboard?: KeyboardPreferences;
    [key: string]: unknown;
}

export interface MeProfile {
    _id: string;
    name: { first: string; middle?: string; last: string };
    role: 'admin' | 'owner' | 'developer' | 'user';
    avatar: string;
    email: string;
    otherEmails: string[];
    mobile: string | null;
    defaultLanguage: string;
    timezone: string | null;
    timezoneOffset: string | null;
    tags: string[];
    portalAccessEnabled: boolean;
    preferences: UserPreferences | null;
    customFields?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateMeInput {
    preferences?: UserPreferences | null;
    customFields?: Record<string, unknown> | null;
}

export interface McpConnection {
    _id: string;
    mcpServerId: string;
    userId: string;
    status: string;
    tokenExpiry: string | null;
    mcpServerName: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LoginActivity {
    _id: string;
    type: string;
    provider: string;
    email: string | null;
    requestId: string;
    ipAddr: string;
    userAgent: string;
    status: string;
    reason: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LoginActivityGroup {
    requestId: string;
    activities: LoginActivity[];
}

export const accountApi = {
    getMe(config?: ApiRequestConfig): Promise<MeProfile> {
        return apiClient.get<MeProfile>('/users/me', config);
    },

    updateMe(patch: UpdateMeInput, config?: ApiRequestConfig): Promise<MeProfile> {
        return apiClient.put<MeProfile, UpdateMeInput>('/users/me', patch, config);
    },

    async listMcpConnections(
        params: { page?: number; size?: number } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<McpConnection>> {
        const raw = await apiClient.get<RawPagedList<McpConnection>>('/users/me/mcpconnections', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },

    async listLoginActivities(
        params: { page?: number; size?: number } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<LoginActivityGroup>> {
        const raw = await apiClient.get<RawPagedList<LoginActivityGroup>>('/users/me/loginactivities', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },
};

export const ACCOUNT_QUERY_KEY = ['account'] as const;
export const ME_QUERY_KEY = [...ACCOUNT_QUERY_KEY, 'me'] as const;
export const MCP_CONNECTIONS_QUERY_KEY = [...ACCOUNT_QUERY_KEY, 'mcp-connections'] as const;

const PENDING_POLL_INTERVAL_MS = 4_000;

export const useMcpConnectionsQuery = (enabled = true, pollForServerId?: string) =>
    useQuery({
        queryKey: MCP_CONNECTIONS_QUERY_KEY,
        queryFn: () => accountApi.listMcpConnections({ size: 50 }),
        enabled,
        refetchInterval: (query) => {
            if (!pollForServerId) {
                return false;
            }

            const connection = query.state.data?.values.find((item) => item.mcpServerId === pollForServerId);

            return connection?.status === 'pending' ? PENDING_POLL_INTERVAL_MS : false;
        },
    });

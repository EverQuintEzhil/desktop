import type { QueryClient } from '@tanstack/react-query';
import qs from 'qs';

import type { PagedList, RawPagedList } from '@/types/api-types';

import { apiClient, type ApiRequestConfig } from '../client';
import { mapPagedList } from '../mappers';

import { patchAgentCaches, setEnabledById } from './agent-cache';

export interface McpServerEntitlementRef {
    _id: string;
}

export interface McpServerCreatorRef {
    _id: string;
    name?: { first?: string; middle?: string; last?: string };
    avatar?: string;
}

export interface McpServerConnection {
    status: string;
    tokenExpiry: string | null;
}

export interface McpServer {
    _id: string;
    name: string;
    description: string | null;
    serverUrl: string;
    authType: string;
    isDcr?: boolean;
    status: string;
    transport?: string;
    version?: string | null;
    requireApproval?: boolean;
    createdAt?: string;
    updatedAt?: string;
    includeUsers?: McpServerEntitlementRef[];
    excludeUsers?: McpServerEntitlementRef[];
    includeSecurityGroups?: McpServerEntitlementRef[];
    excludeSecurityGroups?: McpServerEntitlementRef[];
    creator?: McpServerCreatorRef | null;
    preference?: McpServerPreference | null;
    globalEnabled?: boolean;
    agentEnabled?: boolean | null;
    effectiveEnabled?: boolean;
    connection?: McpServerConnection | null;
}

export interface McpConnectResponse {
    authorizationUrl: string;
}

export interface McpToolParameter {
    type?: string;
    description?: string;
}

export interface McpToolInputSchema {
    type?: string;
    properties?: Record<string, McpToolParameter>;
    required?: string[];
}

export interface McpToolAnnotations {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}

export interface McpTool {
    name: string;
    title?: string;
    description?: string;
    inputSchema?: McpToolInputSchema;
    annotations?: McpToolAnnotations;
}

export type McpToolPreferenceLevel = 'global' | 'user';

export interface McpToolPreferenceInput {
    name: string;
    needsApproval?: boolean;
    disabled?: boolean;
    hasUserPreferences?: boolean;
    preferenceLevel: McpToolPreferenceLevel;
}

export interface McpToolPreference {
    _id?: string;
    mcpServerId?: string;
    userId?: string;
    toolName: string;
    needsApproval?: boolean;
    disabled?: boolean;
    hasUserPreferences?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface McpServerPreference {
    mcpServerId: string;
    userId: string;
    disabled: boolean;
    agentId?: string;
}

export const mcpServersApi = {
    async list(
        params: {
            page?: number;
            size?: number;
            search?: string;
            createdByMe?: boolean;
            agentId?: string;
            enabled?: 'true' | 'false';
            connected?: 'true' | 'false';
        } = {},
        config?: ApiRequestConfig,
    ): Promise<PagedList<McpServer>> {
        const raw = await apiClient.get<RawPagedList<McpServer>>('/mcpservers', {
            ...config,
            params,
            paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
        });

        return mapPagedList(raw);
    },

    getById(id: string, config?: ApiRequestConfig): Promise<McpServer> {
        return apiClient.get<McpServer>(`/mcpservers/${id}`, config);
    },

    connect(id: string, redirectUrl?: string, config?: ApiRequestConfig): Promise<McpConnectResponse> {
        return apiClient.get<McpConnectResponse>(`/mcpservers/${id}/connect`, {
            ...config,
            params: { redirectUrl },
        });
    },

    disconnect(id: string, config?: ApiRequestConfig): Promise<void> {
        return apiClient.post<void>(`/mcpservers/${id}/disconnect`, undefined, config);
    },

    getTools(id: string, config?: ApiRequestConfig): Promise<McpTool[]> {
        return apiClient.get<McpTool[]>(`/mcpservers/${id}/tools`, config);
    },

    getToolPreferences(
        id: string,
        preferenceLevel: McpToolPreferenceLevel = 'user',
        config?: ApiRequestConfig,
    ): Promise<McpToolPreference[]> {
        return apiClient.get<McpToolPreference[]>(`/mcpservers/${id}/tools-preferences`, {
            ...config,
            params: { preferenceLevel },
        });
    },

    putToolsPreferences(
        id: string,
        preference: McpToolPreferenceInput,
        config?: ApiRequestConfig,
    ): Promise<McpToolPreference> {
        return apiClient.put<McpToolPreference>(`/mcpservers/${id}/tools-preferences`, preference, config);
    },

    getServerPreference(id: string, config?: ApiRequestConfig): Promise<McpServerPreference | null> {
        return apiClient.get<McpServerPreference | null>(`/mcpservers/${id}/preferences`, config);
    },

    putServerPreference(
        id: string,
        disabled: boolean,
        agentId?: string,
        config?: ApiRequestConfig,
    ): Promise<McpServerPreference> {
        return apiClient.put<McpServerPreference>(
            `/mcpservers/${id}/preferences`,
            agentId ? { disabled, agentId } : { disabled },
            config,
        );
    },
};

// Broad prefixes on purpose: connector state is read from four unrelated roots — the settings
// catalog/detail queries, the chat composer's ['connectors', 'custom'|'shared', agentId], the
// ['mcp-servers'] lists, and the agent payload (['agent', agentId]) that carries the agent's
// attached connectors. Anything narrower leaves one of those surfaces serving pre-change state.
export const invalidateConnectorSurfaces = (queryClient: QueryClient): void => {
    void queryClient.invalidateQueries({ queryKey: ['connectors'] });
    void queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
    void queryClient.invalidateQueries({ queryKey: ['agent'] });
    // A fifth root: the routine form's connector-health read is cached, so a disconnect made here
    // would otherwise leave the create dialog promising a connector that has just gone.
    void queryClient.invalidateQueries({ queryKey: ['routines', 'connector-health'] });
};

export const CONNECTED_CONNECTORS_QUERY_KEY = ['connectors', 'connected'] as const;
export const NOT_CONNECTED_CONNECTORS_QUERY_KEY = ['connectors', 'not-connected'] as const;

export const customConnectorsKey = (agentId: string) => ['connectors', 'custom', agentId] as const;
export const sharedConnectorsKey = (agentId: string) => ['connectors', 'shared', agentId] as const;

export const patchConnectorEnabledInCaches = (
    queryClient: QueryClient,
    agentId: string,
    mcpServerId: string,
    enabled: boolean,
): void => {
    const patchList = (prev: PagedList<McpServer> | undefined) =>
        prev ? { ...prev, values: setEnabledById(prev.values, mcpServerId, enabled) } : prev;

    queryClient.setQueryData<PagedList<McpServer>>(customConnectorsKey(agentId), patchList);
    queryClient.setQueryData<PagedList<McpServer>>(sharedConnectorsKey(agentId), patchList);
    patchAgentCaches(queryClient, agentId, (agent) =>
        agent.mcpServers ? { ...agent, mcpServers: setEnabledById(agent.mcpServers, mcpServerId, enabled) } : agent,
    );
};

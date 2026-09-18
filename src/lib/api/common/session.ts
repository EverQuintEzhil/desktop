import { apiClient, type ApiRequestConfig } from '../client';

const sessionRequest: ApiRequestConfig = {
    skipAuthRedirect: true,
};

/** Tenant details from GET `/public`. */
export interface TenantPublicDetails {
    name?: string;
    description?: string;
    [key: string]: unknown;
}

/** OpenID-style claims from GET `/authentication/userinfo`. */
export interface SessionUserinfo {
    sub: string;
    avatar?: string;
    name?: string;
    email?: string;
    role?: string;
    security_groups?: unknown;
}

export const sessionApi = {
    getPublic(): Promise<TenantPublicDetails> {
        return apiClient.get<TenantPublicDetails>('/public', sessionRequest);
    },

    getUserinfo(): Promise<SessionUserinfo> {
        return apiClient.get<SessionUserinfo>('/authentication/userinfo', sessionRequest);
    },
};

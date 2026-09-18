import { isAxiosError } from 'axios';

import { clearSessionToken } from '@/lib/auth/session-token';

import { apiClient, type ApiRequestConfig } from '../client';

const authRequest: ApiRequestConfig = {
    skipAuthRedirect: true,
};

interface RawOtpRequestResponse {
    requestId: string;
}

/** `type: 'jwt'` verifies return the bearer session; `type: 'cookie'` verifies return nothing. */
export interface RawOtpVerifyResponse {
    token?: string;
    expiresAt?: number | string;
}

interface RawIdpInitiateResponse {
    redirect_url: string;
}

export interface OtpLoginPayload {
    email: string;
    type?: 'jwt' | 'cookie' | string;
}

export interface OtpVerifyPayload {
    email: string;
    otp: string;
}

export const authApi = {
    requestOtp(payload: OtpLoginPayload): Promise<RawOtpRequestResponse> {
        // Desktop default is 'jwt': the webview has no cookie for the API origin,
        // so the verify step must hand the session back in the response body.
        return apiClient.post<RawOtpRequestResponse, OtpLoginPayload>(
            '/authentication',
            { type: payload.type ?? 'jwt', email: payload.email },
            authRequest,
        );
    },

    verifyOtp(requestId: string, payload: OtpVerifyPayload): Promise<RawOtpVerifyResponse | undefined> {
        return apiClient.post<RawOtpVerifyResponse | undefined, OtpVerifyPayload>(
            `/authentication/${requestId}`,
            payload,
            authRequest,
        );
    },

    initiateIdp(idpId: string): Promise<RawIdpInitiateResponse> {
        return apiClient.post<RawIdpInitiateResponse>(`/authentication/idp/${idpId}`, undefined, authRequest);
    },

    completeIdp(idpId: string, state: string, payload: Record<string, unknown>): Promise<unknown> {
        return apiClient.post<unknown, Record<string, unknown>>(
            `/authentication/idp/${idpId}/${state}`,
            payload,
            authRequest,
        );
    },

    async logout(): Promise<void> {
        try {
            await apiClient.post<unknown>('/authentication/logout', {}, { withCredentials: true });
        } catch (error) {
            // A 401 means the session is already gone server-side — that IS a
            // completed logout, not a failure to surface.
            if (!(isAxiosError(error) && error.response?.status === 401)) {
                throw error;
            }
        } finally {
            // Whatever the server said, this device must stop sending the token.
            clearSessionToken();
        }
    },
};

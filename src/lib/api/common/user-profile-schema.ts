import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { uiAxios } from '../../axios';

const userProfileSchemaShape = z.object({
    type: z.string().optional(),
    properties: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    required: z.array(z.string()).optional(),
});

/** `profileSchema` is a sibling of `value`, so the unwrapping `apiClient` cannot carry it. */
const meEnvelopeShape = z.object({
    success: z.literal(true),
    profileSchema: z.unknown().optional(),
});

export type UserProfileSchema = Record<string, unknown>;

export const USER_PROFILE_SCHEMA_QUERY_KEY = ['account', 'profile-schema'] as const;

const toSchema = (value: unknown): UserProfileSchema | null => {
    const parsed = userProfileSchemaShape.safeParse(value);

    if (!parsed.success) return null;
    if (!parsed.data.properties || Object.keys(parsed.data.properties).length === 0) return null;

    return value as UserProfileSchema;
};

async function fetchUserProfileSchema(): Promise<UserProfileSchema | null> {
    const response = await uiAxios.get<unknown>('/users/me', { skipAuthRedirect: true });
    const envelope = meEnvelopeShape.safeParse(response.data);

    if (!envelope.success) return null;

    return toSchema(envelope.data.profileSchema);
}

/** Resolves to `null` for every failure so a tenant with no schema configured stays invisible to the page. */
export const useUserProfileSchemaQuery = () =>
    useQuery({
        queryKey: USER_PROFILE_SCHEMA_QUERY_KEY,
        queryFn: () => fetchUserProfileSchema().catch(() => null),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

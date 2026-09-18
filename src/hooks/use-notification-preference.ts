import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { accountApi, ME_QUERY_KEY, type MeProfile, type UserPreferences } from '@/lib/api';

const DEFAULT_RESPONSE_COMPLETION = true;

// legacy dev enum ('off'|'background'|'always') coerced to boolean; absent/unreadable → default true, so an already-granted user is never silently switched off
const responseCompletionSchema = z
    .preprocess((value) => {
        if (value === 'off') {
            return false;
        }

        if (value === 'background' || value === 'always') {
            return true;
        }

        return value;
    }, z.boolean())
    .catch(DEFAULT_RESPONSE_COMPLETION);

const notificationPreferencesSchema = z
    .looseObject({ responseCompletion: responseCompletionSchema })
    .catch({ responseCompletion: DEFAULT_RESPONSE_COMPLETION });

const readNotifications = (preferences?: UserPreferences | null) =>
    notificationPreferencesSchema.parse(preferences?.notifications);

const withResponseCompletion = (
    preferences: UserPreferences | null | undefined,
    enabled: boolean,
): UserPreferences => ({
    ...(preferences ?? {}),
    notifications: { ...readNotifications(preferences), responseCompletion: enabled },
});

export interface UseNotificationPreferenceResult {
    enabled: boolean;
    isLoaded: boolean;
    isSaving: boolean;
    setEnabled: (enabled: boolean) => void;
}

export const useNotificationPreference = (): UseNotificationPreferenceResult => {
    const queryClient = useQueryClient();
    const { data: me, isSuccess } = useQuery({ queryKey: ME_QUERY_KEY, queryFn: () => accountApi.getMe() });

    const { mutate, isPending } = useMutation({
        mutationFn: (nextEnabled: boolean) => {
            const current = queryClient.getQueryData<MeProfile>(ME_QUERY_KEY);

            return accountApi.updateMe({ preferences: withResponseCompletion(current?.preferences, nextEnabled) });
        },
        onMutate: async (nextEnabled) => {
            await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });

            const previous = queryClient.getQueryData<MeProfile>(ME_QUERY_KEY);

            queryClient.setQueryData<MeProfile>(ME_QUERY_KEY, (old) =>
                old ? { ...old, preferences: withResponseCompletion(old.preferences, nextEnabled) } : old,
            );

            return { previous };
        },
        onError: (_error, _next, context) => {
            if (context?.previous) {
                queryClient.setQueryData(ME_QUERY_KEY, context.previous);
            }

            toast.error("Couldn't update notification settings. Please try again.");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
    });

    const setEnabled = useCallback(
        (enabled: boolean) => {
            // writing before the profile is cached would PUT a notifications bag with no siblings, wiping preferences.keyboard and the rest
            if (queryClient.getQueryData<MeProfile>(ME_QUERY_KEY) === undefined) {
                return;
            }

            mutate(enabled);
        },
        [mutate, queryClient],
    );

    return {
        enabled: readNotifications(me?.preferences).responseCompletion,
        isLoaded: isSuccess,
        isSaving: isPending,
        setEnabled,
    };
};

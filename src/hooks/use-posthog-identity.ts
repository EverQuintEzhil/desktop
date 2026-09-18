import { posthog } from 'posthog-js';
import { useEffect, useMemo, useRef } from 'react';

import { setAnalyticsTracker } from '@/lib/analytics';

interface UsePostHogIdentityProps {
    isAuthenticated: boolean;
    token: string;
    userId: string;
    email: string;
    name: string;
}

export const usePostHogIdentity = ({ isAuthenticated, token, userId, email, name }: UsePostHogIdentityProps) => {
    const initializedToken = useRef<string | null>(null);
    const identifiedSignature = useRef<string | null>(null);

    const identitySignature = useMemo(
        () =>
            JSON.stringify({
                token,
                userId,
                email,
                name,
            }),
        [token, userId, email, name],
    );

    useEffect(() => {
        if (!isAuthenticated || !token || !userId) {
            if (initializedToken.current) {
                posthog.reset();
            }

            setAnalyticsTracker(null);
            initializedToken.current = null;
            identifiedSignature.current = null;

            return;
        }

        try {
            if (initializedToken.current && initializedToken.current !== token) {
                posthog.reset();
            }

            if (initializedToken.current !== token) {
                posthog.init(token, { api_host: 'https://us.i.posthog.com' });
                initializedToken.current = token;
                identifiedSignature.current = null;

                // Registered on init, not after `identify`, so the identity early-return below
                // cannot leave the client live with nothing wired to it.
                setAnalyticsTracker((event, properties) => posthog.capture(event, properties));
            }

            if (identifiedSignature.current === identitySignature) return;

            posthog.identify(userId, { email, name });
            identifiedSignature.current = identitySignature;
        } catch (error) {
            setAnalyticsTracker(null);
            initializedToken.current = null;
            identifiedSignature.current = null;
            console.error('Failed to initialize posthog', error);
        }
    }, [email, identitySignature, isAuthenticated, name, token, userId]);
};

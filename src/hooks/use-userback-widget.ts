import Userback, { getUserback, type UserbackOptions, type UserbackWidget } from '@userback/widget';
import { useEffect, useMemo, useRef } from 'react';

interface UseUserbackWidgetProps {
    isAuthenticated: boolean;
    token: string;
    userId: string;
    email: string;
    name: string;
}

export const useUserbackWidget = ({ isAuthenticated, token, userId, email, name }: UseUserbackWidgetProps) => {
    const initializedToken = useRef<string | null>(null);
    const identifiedSignature = useRef<string | null>(null);
    const initializationVersion = useRef(0);

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

    const userbackOptions = useMemo<UserbackOptions>(
        () => ({
            user_data: {
                id: userId,
                info: {
                    name,
                    email,
                },
            },
        }),
        [email, name, userId],
    );

    useEffect(() => {
        const currentVersion = initializationVersion.current + 1;

        initializationVersion.current = currentVersion;

        let isCancelled = false;

        const destroyUserback = () => {
            getUserback()?.destroy();
            initializedToken.current = null;
            identifiedSignature.current = null;
        };

        const shouldIgnoreResult = () => isCancelled || currentVersion !== initializationVersion.current;

        const loadUserbackWidget = async (): Promise<UserbackWidget | null> => {
            let userbackWidget = getUserback();
            const widgetToken = initializedToken.current;

            if (userbackWidget && widgetToken && widgetToken !== token) {
                userbackWidget.destroy();
                userbackWidget = undefined;
                initializedToken.current = null;
                identifiedSignature.current = null;
            }

            if (userbackWidget) {
                initializedToken.current = userbackWidget.access_token;

                return userbackWidget;
            }

            userbackWidget = await Userback(token, userbackOptions);

            if (shouldIgnoreResult()) {
                return null;
            }

            initializedToken.current = token;
            identifiedSignature.current = null;

            return userbackWidget;
        };

        if (!isAuthenticated || !token || !userId) {
            destroyUserback();

            return () => {
                isCancelled = true;
            };
        }

        const syncUserback = async () => {
            try {
                const userbackWidget = await loadUserbackWidget();

                if (!userbackWidget || shouldIgnoreResult()) return;

                if (identifiedSignature.current === identitySignature) return;

                userbackWidget.identify(userId, { name, email });
                userbackWidget.setName(name);
                userbackWidget.setEmail(email);

                identifiedSignature.current = identitySignature;
            } catch (error) {
                if (shouldIgnoreResult()) return;

                destroyUserback();
                console.error('Failed to initialize userback', error);
            }
        };

        void syncUserback();

        return () => {
            isCancelled = true;
        };
    }, [email, identitySignature, isAuthenticated, name, token, userId, userbackOptions]);
};

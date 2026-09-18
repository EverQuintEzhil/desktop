import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAppSelector } from '@/hooks';
import { usePostHogIdentity } from '@/hooks/use-posthog-identity';
import { useTenantFontFamily } from '@/hooks/use-tenant-font-family';
import { useUserbackWidget } from '@/hooks/use-userback-widget';
import { selectTenant, selectUser } from '@/store/selectors';
import observeScrollbarOverflow from '@/utils/observe-scrollbar-overflow';

const AppIntegrations = () => {
    const user = useAppSelector(selectUser);
    const tenant = useAppSelector(selectTenant);
    const queryClient = useQueryClient();

    const userId = typeof user._id === 'string' ? user._id : '';
    const userEmail = user.email || '';
    const userName = useMemo(() => `${user.name.first} ${user.name.last}`.trim(), [user.name.first, user.name.last]);

    useEffect(() => {
        observeScrollbarOverflow();
    }, []);

    useEffect(() => {
        if (!user.isAuthenticated) {
            queryClient.clear();
        }
    }, [queryClient, user.isAuthenticated]);

    usePostHogIdentity({
        isAuthenticated: user.isAuthenticated,
        token: tenant.postHogToken,
        userId,
        email: userEmail,
        name: userName,
    });

    useUserbackWidget({
        isAuthenticated: user.isAuthenticated,
        token: tenant.userbackAccessToken,
        userId,
        email: userEmail,
        name: userName,
    });

    useTenantFontFamily(tenant.fontFamily);

    return null;
};

export default AppIntegrations;

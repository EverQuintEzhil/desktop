import React, { Fragment, useEffect, useState } from 'react';

import Spinner from '@/components/ui/spinner';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { sessionApi } from '@/lib/api';
import { captureDeepLink } from '@/lib/auth/handle-session-expired';
import { useSessionKeepalive } from '@/lib/auth/use-session-keepalive';
import {
    createAnonymousUserState,
    createStoredUserState,
    mapSessionUserinfoToUserState,
    parseStoredUserState,
} from '@/lib/auth/user-state';
import { mapTenantPublicToTenant } from '@/lib/tenant/tenant-state';
import { setTenant } from '@/store/reducers/tenant';
import { setUser } from '@/store/reducers/user';
import { selectUser } from '@/store/selectors';
import { safeJsonParse, safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/utils';

interface Props {
    children: React.ReactNode;
}

export const APPLICATION_VERSION = '2.2.0';

const AuthWrapper = (props: Props) => {
    const { children } = props;
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectUser);
    const [applicationVersion, setApplicationVersion] = useState('');
    const [loading, setLoading] = useState(true);

    useSessionKeepalive(!loading && Boolean(user?.isAuthenticated));

    const getStoredUser = () => {
        const dataString = safeLocalStorageGetItem('user');

        return parseStoredUserState(safeJsonParse<unknown>(dataString, null));
    };

    const getLocalStorageDataNoTime = (key: string): Record<string, unknown> | null => {
        const dataString = safeLocalStorageGetItem(key);

        if (dataString) {
            return safeJsonParse<Record<string, unknown> | null>(dataString, null);
        }

        return null;
    };

    const onError = () => {
        setLoading(false);
        dispatch(setUser(createAnonymousUserState()));
        captureDeepLink();
    };

    const fetchTenant = async () => {
        try {
            setLoading(true);
            const details = await sessionApi.getPublic();

            dispatch(setTenant(mapTenantPublicToTenant(details)));
            document.title = `${details?.name} \u00B7  ${details?.description}`;
            safeLocalStorageSetItem('tenant', JSON.stringify(details));
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    };

    /** Tenant settings are changed outside the app, so a cached tenant is refreshed on every load rather than trusted until the next version bump. */
    const refreshTenantInBackground = async () => {
        try {
            const details = await sessionApi.getPublic();

            dispatch(setTenant(mapTenantPublicToTenant(details)));
            document.title = `${details?.name} \u00B7  ${details?.description}`;
            safeLocalStorageSetItem('tenant', JSON.stringify(details));
        } catch (error) {
            console.error(error);
        }
    };

    const fetchUser = async () => {
        try {
            setLoading(true);
            const userinfo = await sessionApi.getUserinfo();
            const user = mapSessionUserinfoToUserState(userinfo);

            dispatch(setUser(user));
            safeLocalStorageSetItem('user', JSON.stringify(createStoredUserState(user)));
            setLoading(false);
        } catch (error) {
            console.error(error);
            onError();
        }
    };

    const fetchTenantAndUser = async () => {
        setLoading(true);
        try {
            const [tenantResult, userResult] = await Promise.allSettled([
                sessionApi.getPublic(),
                sessionApi.getUserinfo(),
            ]);

            if (tenantResult.status === 'fulfilled') {
                const tenantDetails = tenantResult.value;

                dispatch(setTenant(mapTenantPublicToTenant(tenantDetails)));
                document.title = `${tenantDetails?.name} \u00B7 ${tenantDetails?.description}`;
                safeLocalStorageSetItem('tenant', JSON.stringify(tenantDetails));
            } else {
                console.error('Tenant fetch error:', tenantResult.reason);
                onError();
            }

            if (userResult.status === 'fulfilled') {
                const user = mapSessionUserinfoToUserState(userResult.value);

                dispatch(setUser(user));
                safeLocalStorageSetItem('user', JSON.stringify(createStoredUserState(user)));
            } else {
                console.error('User fetch error:', userResult.reason);
                onError();
            }
        } catch (e) {
            console.error('Unexpected error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const applicationVersion = localStorage.getItem('application-version');

        if (applicationVersion !== APPLICATION_VERSION) {
            localStorage.removeItem('user');
            localStorage.removeItem('tenant');
            localStorage.removeItem('fluentmind:design-tokens');
            setApplicationVersion(APPLICATION_VERSION);
        } else {
            setApplicationVersion(APPLICATION_VERSION);
        }
    }, []);

    useEffect(() => {
        if (applicationVersion === APPLICATION_VERSION) {
            localStorage.setItem('application-version', applicationVersion);
            const data = getStoredUser();
            const tenantData = getLocalStorageDataNoTime('tenant');

            if (data && tenantData) {
                setLoading(false);
                document.title = `${tenantData?.name} \u00B7  ${tenantData?.description}`;
                dispatch(setUser(data));
                dispatch(setTenant(mapTenantPublicToTenant(tenantData)));
                void refreshTenantInBackground();
            } else if (data && !tenantData) {
                dispatch(setUser(data));
                fetchTenant();
            } else if (!data && tenantData) {
                document.title = `${tenantData?.name} \u00B7  ${tenantData?.description}`;
                dispatch(setTenant(mapTenantPublicToTenant(tenantData)));
                fetchUser();
            } else {
                fetchTenantAndUser();
            }
        }
    }, [applicationVersion]);

    if (loading) {
        return (
            <div className="flex h-svh min-h-svh w-full items-center justify-center bg-background px-4 py-6">
                <Spinner className="size-6" />
            </div>
        );
    }

    return <Fragment>{children}</Fragment>;
};

export default AuthWrapper;

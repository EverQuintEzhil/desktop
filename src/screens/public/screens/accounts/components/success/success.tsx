import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Spinner from '@/components/ui/spinner';
import { useAppDispatch } from '@/hooks';
import { sessionApi } from '@/lib/api';
import { getRedirectTarget } from '@/lib/auth/redirect';
import { createAnonymousUserState, createStoredUserState, mapSessionUserinfoToUserState } from '@/lib/auth/user-state';
import { mapTenantPublicToTenant } from '@/lib/tenant/tenant-state';
import { setTenant } from '@/store/reducers/tenant';
import { setUser } from '@/store/reducers/user';
import {
    safeLocalStorageRemoveItem,
    safeLocalStorageSetItem,
    safeSessionStorageClear,
    safeSessionStorageGetItem,
    safeSessionStorageSetItem,
} from '@/utils';

const Success = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const fetchUser = async () => {
        try {
            const [userinfo, details] = await Promise.all([sessionApi.getUserinfo(), sessionApi.getPublic()]);
            const user = mapSessionUserinfoToUserState(userinfo);

            dispatch(setUser(user));
            safeLocalStorageSetItem('user', JSON.stringify(createStoredUserState(user)));

            dispatch(setTenant(mapTenantPublicToTenant(details)));
            document.title = `${details?.name} \u00B7  ${details?.description}`;
            safeLocalStorageSetItem('tenant', JSON.stringify(details));
        } catch (error) {
            console.error(error);
            navigate('/accounts');
            dispatch(setUser(createAnonymousUserState()));
        }
    };

    useEffect(() => {
        const uri = safeSessionStorageGetItem('deep_link');

        safeSessionStorageClear();
        // The destination bundle boots from these, so a previous account's cached copy must
        // not survive into it.
        safeLocalStorageRemoveItem('user');
        safeLocalStorageRemoveItem('tenant');

        const target = uri ? getRedirectTarget(uri) : null;

        if (target?.fullPageLoad) {
            window.location.href = target.value;

            return;
        }

        if (uri) {
            safeSessionStorageSetItem('deep_link', uri);
        }
        fetchUser();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center gap-6">
            <Spinner className="scale-[1.5]" role="status" aria-label="Signing you in" />
            <h2 className="text-center font-medium">Success. Please Wait.</h2>
        </div>
    );
};

export default Success;

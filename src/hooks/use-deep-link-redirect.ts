import QueryString from 'qs';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getRedirectTarget } from '@/lib/auth/redirect';
import { safeSessionStorageGetItem, safeSessionStorageRemoveItem } from '@/utils';

const DEEP_LINK_KEY = 'deep_link';

interface Options {
    /** Where a user who finished signing in with nothing to restore is sent. */
    fallbackPath: string;
}

/**
 * Restores the route the user was on before re-authenticating. `deep_link` is
 * written by the auth wrapper and the session-expiry handler; `redirect_uri`
 * covers a link that arrives with the target already in the query string.
 */
export const useDeepLinkRedirect = (options: Options) => {
    const { fallbackPath } = options;
    const navigate = useNavigate();
    const location = useLocation();
    const redirectHandledRef = useRef(false);

    const { redirect_uri: parsedRedirectURI } = QueryString.parse(location.search.replace('?', ''));
    const redirectURI = typeof parsedRedirectURI === 'string' ? parsedRedirectURI : '';

    useEffect(() => {
        if (redirectHandledRef.current) return;

        const handleRedirect = (redirectValue: string) => {
            const target = getRedirectTarget(redirectValue);

            if (!target) return;

            if (target.fullPageLoad) {
                window.location.href = target.value;

                return;
            }

            navigate(target.value);
        };

        const deepLink = safeSessionStorageGetItem(DEEP_LINK_KEY);

        if (deepLink) {
            redirectHandledRef.current = true;
            safeSessionStorageRemoveItem(DEEP_LINK_KEY);
            handleRedirect(deepLink);
        } else if (redirectURI) {
            redirectHandledRef.current = true;
            handleRedirect(redirectURI);
        } else if (location.pathname.includes('accounts')) {
            redirectHandledRef.current = true;
            navigate(fallbackPath, { replace: true });
        }
    }, [location.pathname, navigate, redirectURI, fallbackPath]);
};

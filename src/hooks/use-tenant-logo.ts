import { useAppSelector } from '@/hooks/use-typed-redux';
import { selectTenant } from '@/store/selectors';

import { useIsDarkMode } from './use-is-dark-mode';

/**
 * The tenant's wordmark for a page background. `logoWhite` is the light-on-dark artwork, so
 * dark mode prefers it; branded chrome (the violet sidebar) wants `logoWhite` in both themes
 * and reads the tenant fields directly instead.
 */
export const useTenantLogo = (): string => {
    const tenant = useAppSelector(selectTenant);
    const isDarkMode = useIsDarkMode();

    if (isDarkMode && tenant.logoWhite) return tenant.logoWhite;

    return tenant.logoHorizontal || tenant.logoWhite;
};

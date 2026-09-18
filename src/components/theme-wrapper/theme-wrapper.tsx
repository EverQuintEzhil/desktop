import React, { useEffect } from 'react';

import { useAppearance, useAppSelector } from '@/hooks';
import { applyBranding } from '@/lib/design-tokens';
import { selectTenant } from '@/store/selectors';
import { syncTenantFavicons } from '@/utils/tenant-favicon';

interface Props {
    children: React.ReactNode;
}

const ThemeWrapper: React.FC<Props> = ({ children }) => {
    const tenant = useAppSelector(selectTenant);

    useAppearance();

    useEffect(() => {
        applyBranding(tenant.branding);
    }, [tenant.branding]);

    useEffect(() => {
        syncTenantFavicons(tenant.logoBrand || tenant.logoHorizontal, tenant.logoWhite || tenant.logoHorizontal);
    }, [tenant.logoBrand, tenant.logoWhite, tenant.logoHorizontal]);

    return <>{children}</>;
};

export default ThemeWrapper;

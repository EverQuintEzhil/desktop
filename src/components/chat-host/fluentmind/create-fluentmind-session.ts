import type { TenantType, UserState } from '@/types/store';

import type { ChatSession } from '../types';

export const createFluentMindSession = (user: UserState | null, tenant: TenantType | null): ChatSession => ({
    user: user?._id
        ? {
              id: user._id,
              email: user.email ?? undefined,
              name: {
                  first: user.name?.first ?? undefined,
                  last: user.name?.last ?? undefined,
              },
          }
        : null,
    tenant: tenant
        ? // Mirror the pre-SDK avatar source (logoBrand || logoHorizontal) so the
          // assistant avatar logo doesn't vanish for tenants without companyLogo.
          {
              name: tenant.name,
              logoSrc: tenant.logoBrand || tenant.logoHorizontal || tenant.companyLogo || undefined,
              // Light-on-dark artwork for dark mode; the brand logo can be too dark to read there.
              logoSrcDark: tenant.logoWhite || undefined,
          }
        : null,
});

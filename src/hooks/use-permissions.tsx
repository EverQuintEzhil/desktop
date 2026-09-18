import React, { useCallback, useMemo } from 'react';

import { useAppSelector } from '@/hooks';
import { selectUser } from '@/store/selectors';
import type { Role } from '@/types/store';
import { sideNavPermissions, canAccess, isAdminPermittedUser, sideNavItems } from '@/utils';
import type { Action, Module, PermissionContext } from '@/utils/permissions';

interface ResourceContext {
    ownerId?: string;
    creatorId?: string;
    adminIds?: string[];
    isPublic?: boolean;
}

const usePermissions = () => {
    const user = useAppSelector(selectUser);
    const userRole = user.role;
    const userId = user._id;

    const hasAdminPrivileges = useMemo(() => isAdminPermittedUser(userRole), [userRole]);
    const sideNavRolePermissions = useMemo(() => sideNavPermissions[userRole as NonNullable<Role>] ?? [], [userRole]);
    const defaultNavItem = useMemo(
        () => sideNavItems.find((item) => sideNavRolePermissions.includes(item)),
        [sideNavRolePermissions],
    );

    const canAccessible = useCallback(
        (
            module: Module,
            action: Action,
            resourceContext?: ResourceContext,
            noConditionCheck: boolean = false,
        ): boolean => {
            if (!userId || !userRole) return false;

            const context: PermissionContext = {
                userId,
                userRole,
                ...resourceContext,
            };

            return canAccess(context, module, action, noConditionCheck);
        },
        [userId, userRole],
    );

    const checkMultiplePermissions = useCallback(
        (
            checks: Array<{
                module: Module;
                action: Action;
                resourceContext?: ResourceContext;
                noConditionCheck?: boolean;
            }>,
        ): boolean[] => {
            const results: boolean[] = checks.map(({ module, action, resourceContext, noConditionCheck }) =>
                canAccessible(module, action, resourceContext, noConditionCheck),
            );

            return results;
        },
        [canAccessible],
    );

    return {
        canAccessible,
        checkMultiplePermissions,
        sideNavRolePermissions,
        userRole,
        userId,
        defaultNavItem,
        hasAdminPrivileges,
    };
};

// Higher-order component for permission-based rendering
export const withPermissions = <P extends object>(
    WrappedComponent: React.ComponentType<P>,
    module: Module,
    action: Action,
    fallback?: React.ComponentType,
) => {
    return function EnhancedComponent(props: P) {
        const { canAccessible } = usePermissions();

        if (!canAccessible(module, action)) {
            return fallback ? React.createElement(fallback) : null;
        }

        return React.createElement(WrappedComponent, props);
    };
};

// Permission guard component
export const PermissionGuard: React.FC<{
    module: Module;
    action: Action;
    resourceContext?: ResourceContext;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}> = ({ module, action, resourceContext, fallback, children }) => {
    const { canAccessible } = usePermissions();

    if (!canAccessible(module, action, resourceContext)) {
        return <>{fallback ?? null}</>;
    }

    return <>{children}</>;
};

export default usePermissions;

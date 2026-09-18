import type { Role } from '@/types/store';
export type Action = 'get' | 'post' | 'delete' | 'hardDelete' | 'put' | 'clone' | 'revert';
export type Module =
    | 'abouts'
    | 'apps'
    | 'assets'
    | 'users'
    | 'securityGroups'
    | 'models'
    | 'dataStores'
    | 'agents'
    | 'idps'
    | 'authTokens'
    | 'tags'
    | 'jobs'
    | 'launchers'
    | 'blogPosts'
    | 'prompts'
    | 'projects'
    | 'agentConfigs'
    | 'agentHistories'
    | 'mcps'
    | 'tools'
    | 'skills'
    | 'memories'
    | 'designSystem'
    | 'auditLogs'
    | 'usageReport';
export type PermissionCondition =
    | 'role-based'
    | 'creator-match'
    | 'user-id-match'
    | 'admin-or-creator'
    | 'public'
    | 'admin-ids-match'
    | 'always-allow';
export interface PermissionRule {
    condition: PermissionCondition;
    roles?: Role[];
    allowPublic?: boolean;
}
export interface PermissionContext {
    userId: string;
    userRole: Role;
    ownerId?: string;
    creatorId?: string;
    adminIds?: string[];
    isPublic?: boolean;
}

export const adminPanelPermittedRoles: Role[] = ['owner', 'admin', 'developer'];

const permissions: Record<Module, Partial<Record<Action, PermissionRule>>> = {
    abouts: {
        get: { condition: 'role-based', roles: ['admin', 'owner'] },
        post: { condition: 'role-based', roles: ['admin', 'owner'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner'] },
        put: { condition: 'role-based', roles: ['admin', 'owner'] },
    },
    apps: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    assets: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
    },
    users: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer', 'user'] },
        post: { condition: 'role-based', roles: ['admin', 'owner'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner'] },
        put: { condition: 'role-based', roles: ['admin', 'owner'] },
    },
    securityGroups: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
    },
    models: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
    },
    dataStores: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
    },
    agents: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        hardDelete: { condition: 'role-based', roles: ['admin', 'owner'] },
        revert: { condition: 'role-based', roles: ['admin', 'owner'] },
        clone: { condition: 'admin-ids-match', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'admin-ids-match', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'admin-ids-match', roles: ['admin', 'owner', 'developer'] },
    },
    idps: {
        get: { condition: 'role-based', roles: ['admin', 'owner'] },
        post: { condition: 'role-based', roles: ['admin', 'owner'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner'] },
        put: { condition: 'role-based', roles: ['admin', 'owner'] },
    },
    authTokens: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'creator-match', roles: ['admin', 'owner', 'developer'] },
    },
    tags: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    jobs: {
        get: { condition: 'role-based', roles: ['admin'] },
        post: { condition: 'role-based', roles: ['admin'] },
        delete: { condition: 'role-based', roles: ['admin'] },
        put: { condition: 'role-based', roles: ['admin'] },
    },
    // Writes are `RestrictToMiddleware(['admin', 'owner'])` in the API; listing them for developers
    // only offered buttons that 403.
    launchers: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner'] },
        put: { condition: 'role-based', roles: ['admin', 'owner'] },
    },
    blogPosts: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    prompts: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer', 'user'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer', 'user'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'creator-match', roles: ['admin', 'owner', 'developer', 'user'] },
        clone: { condition: 'role-based', roles: ['admin', 'owner', 'developer', 'user'] },
    },
    projects: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    mcps: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    tools: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    memories: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    skills: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    agentConfigs: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'admin-ids-match', roles: ['admin', 'owner', 'developer'] },
    },
    agentHistories: {
        get: { condition: 'admin-ids-match', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'admin-ids-match', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'admin-ids-match', roles: ['admin', 'owner', 'developer'] },
    },
    designSystem: {
        get: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        post: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        delete: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
        put: { condition: 'role-based', roles: ['admin', 'owner', 'developer'] },
    },
    // the audit trail exposes every actor's email and IP — admins and owners only
    auditLogs: {
        get: { condition: 'role-based', roles: ['admin', 'owner'] },
    },
    // matches the reports service's restrictTo(['admin', 'owner']) — no developer
    usageReport: {
        get: { condition: 'role-based', roles: ['admin', 'owner'] },
    },
};

export const sideNavPermissions: Record<NonNullable<Role>, Module[]> = {
    admin: [
        'abouts',
        'apps',
        'assets',
        'users',
        'securityGroups',
        'mcps',
        'tools',
        'skills',
        'memories',
        'models',
        'dataStores',
        'agents',
        'idps',
        'authTokens',
        'tags',
        'jobs',
        'launchers',
        'blogPosts',
        'prompts',
        'projects',
        'designSystem',
        'auditLogs',
        'usageReport',
    ],
    owner: [
        'abouts',
        'apps',
        'assets',
        'users',
        'securityGroups',
        'mcps',
        'tools',
        'skills',
        'memories',
        'models',
        'dataStores',
        'agents',
        'idps',
        'authTokens',
        'tags',
        'jobs',
        'launchers',
        'blogPosts',
        'prompts',
        'projects',
        'designSystem',
        'auditLogs',
        'usageReport',
    ],
    developer: [
        'users',
        'apps',
        'assets',
        'securityGroups',
        'mcps',
        'tools',
        'skills',
        'memories',
        'models',
        'dataStores',
        'agents',
        'authTokens',
        'tags',
        'launchers',
        'blogPosts',
        'prompts',
        'projects',
        'designSystem',
    ],
    user: [],
};

export const sideNavItems: Module[] = [
    'abouts',
    'apps',
    'assets',
    'users',
    'securityGroups',
    'models',
    'dataStores',
    'agents',
    'idps',
    'authTokens',
    'tags',
    'jobs',
    'launchers',
    'blogPosts',
    'prompts',
    'projects',
    'skills',
    'memories',
    'auditLogs',
    'usageReport',
];
export const canAccess = (
    context: PermissionContext,
    module: Module,
    action: Action,
    noConditionCheck: boolean,
): boolean => {
    try {
        const permissionRule = permissions[module]?.[action];

        if (!permissionRule) return false;
        const { condition, roles, allowPublic } = permissionRule;
        const { userId, userRole, ownerId, creatorId, adminIds, isPublic } = context;

        if (!userRole) return false;

        if (noConditionCheck) {
            return roles?.includes(userRole) ?? false;
        }

        switch (condition) {
            case 'always-allow':
                return true;
            case 'public':
                return allowPublic || isPublic || false;
            case 'role-based':
                return roles?.includes(userRole) ?? false;
            case 'user-id-match':
                if (roles?.includes(userRole)) return true;

                return userId === ownerId;
            case 'creator-match':
                if (['admin', 'owner'].includes(userRole)) return true;
                if (!roles?.includes(userRole)) return false;

                return userId === creatorId;
            case 'admin-or-creator':
                if (['admin', 'owner'].includes(userRole)) return true;
                if (userId === ownerId || userId === creatorId) return true;
                if (adminIds?.includes(userId)) return true;

                return false;
            case 'admin-ids-match':
                if (['admin', 'owner'].includes(userRole)) return true;

                return adminIds?.includes(userId) ?? false;
            default:
                return false;
        }
    } catch (error) {
        console.error('Error checking permissions:', error);

        return false;
    }
};

export const isAdminPermittedUser = (userRole: Role): boolean => {
    return adminPanelPermittedRoles.includes(userRole);
};

export default permissions;

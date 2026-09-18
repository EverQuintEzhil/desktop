import { describe, expect, it } from 'vitest';

import type { LauncherVisibility } from '@/types/store';
import type { AgentUiType, UiUsageConfigType } from '@/types/ui';

import { isUsageVisibleTo, readAgentUsageConfig } from './usage-visibility';

const ROLES = ['admin', 'owner', 'developer', 'user'] as const;

describe('isUsageVisibleTo', () => {
    it('shows usage to every role when the agent has no usage config', () => {
        ROLES.forEach((role) => expect(isUsageVisibleTo(undefined, role)).toBe(true));
    });

    it('shows usage to every role when the config is empty', () => {
        ROLES.forEach((role) => expect(isUsageVisibleTo({}, role)).toBe(true));
    });

    it('hides usage from every role when hidden is set', () => {
        ROLES.forEach((role) => expect(isUsageVisibleTo({ hidden: true }, role)).toBe(false));
    });

    it('hides usage when hidden is set even for a listed role', () => {
        expect(isUsageVisibleTo({ hidden: true, visibleToRoles: ['admin'] }, 'admin')).toBe(false);
    });

    it('shows usage only to listed roles', () => {
        const usage: UiUsageConfigType = { visibleToRoles: ['admin', 'owner'] };

        expect(isUsageVisibleTo(usage, 'admin')).toBe(true);
        expect(isUsageVisibleTo(usage, 'owner')).toBe(true);
        expect(isUsageVisibleTo(usage, 'developer')).toBe(false);
        expect(isUsageVisibleTo(usage, 'user')).toBe(false);
    });

    it('hides usage from an unknown role when the agent lists roles', () => {
        expect(isUsageVisibleTo({ visibleToRoles: ['admin'] }, null)).toBe(false);
    });

    it('shows usage to an unknown role when the agent lists no roles', () => {
        expect(isUsageVisibleTo(undefined, null)).toBe(true);
    });

    it('hides usage when the role list is empty', () => {
        ROLES.forEach((role) => expect(isUsageVisibleTo({ visibleToRoles: [] }, role)).toBe(false));
    });
});

describe('isUsageVisibleTo — tenant-wide hide-ai-usage', () => {
    it('shows usage when the tenant setting is absent or false', () => {
        ROLES.forEach((role) => {
            expect(isUsageVisibleTo(undefined, role, undefined)).toBe(true);
            expect(isUsageVisibleTo(undefined, role, false)).toBe(true);
        });
    });

    it('hides usage from every role when the tenant hides it outright', () => {
        ROLES.forEach((role) => expect(isUsageVisibleTo(undefined, role, true)).toBe(false));
        ROLES.forEach((role) => expect(isUsageVisibleTo(undefined, role, { hidden: true })).toBe(false));
    });

    it('shows usage only to the roles the tenant lists', () => {
        const tenant: LauncherVisibility = { visibleToRoles: ['admin', 'owner'] };

        expect(isUsageVisibleTo(undefined, 'admin', tenant)).toBe(true);
        expect(isUsageVisibleTo(undefined, 'owner', tenant)).toBe(true);
        expect(isUsageVisibleTo(undefined, 'developer', tenant)).toBe(false);
        expect(isUsageVisibleTo(undefined, 'user', tenant)).toBe(false);
    });

    it('hides usage when the tenant lists no roles', () => {
        ROLES.forEach((role) => expect(isUsageVisibleTo(undefined, role, { visibleToRoles: [] })).toBe(false));
    });

    it('hides usage from an unknown role when the tenant lists roles', () => {
        expect(isUsageVisibleTo(undefined, null, { visibleToRoles: ['admin'] })).toBe(false);
    });

    it('hides usage when the tenant allows it but the agent hides it', () => {
        expect(isUsageVisibleTo({ hidden: true }, 'admin', false)).toBe(false);
    });

    it('hides usage when the agent allows it but the tenant hides it', () => {
        expect(isUsageVisibleTo(undefined, 'admin', true)).toBe(false);
    });

    it('shows usage only where the tenant and the agent both allow the role', () => {
        const tenant: LauncherVisibility = { visibleToRoles: ['admin', 'owner'] };
        const agent: UiUsageConfigType = { visibleToRoles: ['owner', 'user'] };

        expect(isUsageVisibleTo(agent, 'owner', tenant)).toBe(true);
        expect(isUsageVisibleTo(agent, 'admin', tenant)).toBe(false);
        expect(isUsageVisibleTo(agent, 'user', tenant)).toBe(false);
    });
});

describe('readAgentUsageConfig', () => {
    it('returns undefined for a missing ui config', () => {
        expect(readAgentUsageConfig(undefined)).toBeUndefined();
        expect(readAgentUsageConfig(null)).toBeUndefined();
    });

    it('reads the usage block off a chat config', () => {
        const uiConfig = {
            componentType: 'chat',
            type: 'chat',
            home: {},
            usage: { hidden: true },
        } as unknown as AgentUiType;

        expect(readAgentUsageConfig(uiConfig)).toEqual({ hidden: true });
    });

    it('reads the usage block off a gallery config', () => {
        const uiConfig = {
            componentType: 'gallery',
            type: 'image',
            usage: { visibleToRoles: ['admin'] },
        } as unknown as AgentUiType;

        expect(readAgentUsageConfig(uiConfig)).toEqual({ visibleToRoles: ['admin'] });
    });

    it('returns undefined for an api config, which has no usage block', () => {
        const uiConfig = { componentType: 'api', type: 'jsonviewer' } as unknown as AgentUiType;

        expect(readAgentUsageConfig(uiConfig)).toBeUndefined();
    });
});

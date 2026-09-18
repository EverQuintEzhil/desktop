import { describe, expect, it } from 'vitest';

import { authenticatedUser, testTenant } from '@/test/fixtures/auth';
import { renderHookWithProviders } from '@/test/test-utils';
import type { AgentUiType } from '@/types/ui';

import { areRoutinesVisibleTo, useCanSeeRoutines } from './routines-visibility';

const uiConfig = (enabled?: boolean, componentType = 'chat') =>
    ({ componentType, routines: enabled === undefined ? undefined : { enabled } }) as unknown as AgentUiType;

describe('areRoutinesVisibleTo', () => {
    it('hides when the tenant hides, even though the agent allows', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), 'admin', true)).toBe(false);
    });

    it('hides when the agent disables, even though the tenant allows', () => {
        expect(areRoutinesVisibleTo(uiConfig(false), 'admin', false)).toBe(false);
    });

    it('shows when neither hides', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), 'admin', false)).toBe(true);
    });

    it('treats an agent with no routines block as allowing', () => {
        expect(areRoutinesVisibleTo(uiConfig(), 'user', false)).toBe(true);
    });

    it('hides on every surface but chat, whatever the routines block says', () => {
        // A gallery, api or app agent has no schedule to attach work to; app agents carry the chat
        // fields, so the routines block alone cannot tell them apart.
        expect(areRoutinesVisibleTo(uiConfig(true, 'app'), 'admin', false)).toBe(false);
        expect(areRoutinesVisibleTo(uiConfig(true, 'gallery'), 'admin', false)).toBe(false);
        expect(areRoutinesVisibleTo(uiConfig(true, 'api'), 'admin', false)).toBe(false);
        expect(areRoutinesVisibleTo(undefined, 'admin', false)).toBe(false);
    });

    it('hides from a role the tenant did not list', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), 'user', { visibleToRoles: ['admin'] })).toBe(false);
    });

    it('shows to a role the tenant listed', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), 'admin', { visibleToRoles: ['admin'] })).toBe(true);
    });

    it('hides from an unresolved role when the tenant narrowed the setting by role', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), null, { visibleToRoles: ['admin'] })).toBe(false);
    });

    it('hides from every role when the tenant value is plain true', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), 'admin', true)).toBe(false);
        expect(areRoutinesVisibleTo(uiConfig(true), 'user', true)).toBe(false);
        expect(areRoutinesVisibleTo(uiConfig(true), null, true)).toBe(false);
    });

    it('shows to every role when the tenant value is plain false', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), 'admin', false)).toBe(true);
        expect(areRoutinesVisibleTo(uiConfig(true), 'user', false)).toBe(true);
        expect(areRoutinesVisibleTo(uiConfig(true), null, false)).toBe(true);
    });

    it('hides when the tenant value is an explicit hidden object', () => {
        expect(areRoutinesVisibleTo(uiConfig(true), 'admin', { hidden: true })).toBe(false);
    });
});

describe('useCanSeeRoutines', () => {
    it('reads the tenant setting off the store', () => {
        const { result } = renderHookWithProviders(() => useCanSeeRoutines(uiConfig(true)), {
            preloadedState: { tenant: { ...testTenant, hideRoutines: false } },
        });

        expect(result.current).toBe(true);
    });

    it('hides for the default tenant, which has never set the key', () => {
        const { result } = renderHookWithProviders(() => useCanSeeRoutines(uiConfig(true)));

        expect(result.current).toBe(false);
    });

    it('hides when the user role has not resolved and the tenant narrowed by role', () => {
        const { result } = renderHookWithProviders(() => useCanSeeRoutines(uiConfig(true)), {
            preloadedState: {
                tenant: { ...testTenant, hideRoutines: { visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: null },
            },
        });

        expect(result.current).toBe(false);
    });

    it('hides for a role outside the tenant role list', () => {
        const { result } = renderHookWithProviders(() => useCanSeeRoutines(uiConfig(true)), {
            preloadedState: {
                tenant: { ...testTenant, hideRoutines: { visibleToRoles: ['admin'] } },
                user: { ...authenticatedUser, role: 'user' },
            },
        });

        expect(result.current).toBe(false);
    });
});

import { describe, expect, it } from 'vitest';

import tenantReducer from '@/store/reducers/tenant';

import { mapTenantPublicToTenant, ROUTINES_HIDDEN_WHEN_UNSET } from './tenant-state';

describe('mapTenantPublicToTenant — hide-whats-new', () => {
    it('maps a true flag to hideWhatsNew', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme', 'hide-whats-new': true });

        expect(tenant.hideWhatsNew).toBe(true);
    });

    it('maps a false flag to hideWhatsNew', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme', 'hide-whats-new': false });

        expect(tenant.hideWhatsNew).toBe(false);
    });

    it('defaults to false when the key is absent', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme' });

        expect(tenant.hideWhatsNew).toBe(false);
    });
});

describe('mapTenantPublicToTenant — per-role hide settings', () => {
    it('keeps the object form of a launcher setting', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'hide-create-agent': { visibleToRoles: ['admin', 'owner'] },
        });

        expect(tenant.hideCreateAgent).toEqual({ visibleToRoles: ['admin', 'owner'] });
    });

    it('keeps the master hide alongside the role list', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'hide-search-input': { hidden: true, visibleToRoles: ['admin'] },
        });

        expect(tenant.hideSearchInput).toEqual({ hidden: true, visibleToRoles: ['admin'] });
    });

    it('maps the documentation links hide setting', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'hide-documentation-links': { visibleToRoles: ['admin', 'owner'] },
        });

        expect(tenant.hideDocumentationLinks).toEqual({ visibleToRoles: ['admin', 'owner'] });
    });

    it('defaults the documentation links hide setting to false when the key is absent', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme' });

        expect(tenant.hideDocumentationLinks).toBe(false);
    });

    it('collapses an all-roles list back to a plain false', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'hide-category-filter': { visibleToRoles: ['admin', 'owner', 'developer', 'user'] },
        });

        expect(tenant.hideCategoryFilter).toBe(false);
    });

    it('keeps a tenant that still stores plain booleans working', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'hide-search-bar': false,
            'hide-scope-switch': true,
        });

        expect(tenant.hideSearchBar).toBe(false);
        expect(tenant.hideScopeSwitch).toBe(true);
    });

    it('falls back to not hidden when the stored value is junk', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme', 'hide-search-bar': 'sometimes' });

        expect(tenant.hideSearchBar).toBe(false);
    });
});

describe('mapTenantPublicToTenant — documentation-links', () => {
    it('maps a well-formed list through in its stored order', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'documentation-links': [
                { id: 'a', label: 'Policies', url: 'https://example.com/policies' },
                { id: 'b', label: 'Field Guide', url: 'https://example.com/guide' },
            ],
        });

        expect(tenant.documentationLinks).toEqual([
            { id: 'a', label: 'Policies', url: 'https://example.com/policies' },
            { id: 'b', label: 'Field Guide', url: 'https://example.com/guide' },
        ]);
    });

    it('drops a malformed entry and keeps the rest', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'documentation-links': [
                { id: 'a', label: 'Policies', url: 'https://example.com/policies' },
                { id: 'b', label: '', url: 'https://example.com/blank' },
                'nonsense',
                { id: 'c', label: 'FAQs', url: 'https://example.com/faqs' },
            ],
        });

        expect(tenant.documentationLinks).toEqual([
            { id: 'a', label: 'Policies', url: 'https://example.com/policies' },
            { id: 'c', label: 'FAQs', url: 'https://example.com/faqs' },
        ]);
    });

    it('defaults to an empty list when the key is absent', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme' });

        expect(tenant.documentationLinks).toEqual([]);
    });
});

describe('mapTenantPublicToTenant — hide-routines', () => {
    it('hides Routines when the key is absent', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme' });

        expect(tenant.hideRoutines).toBe(true);
    });

    it('hides Routines when the whole payload is unparseable', () => {
        const tenant = mapTenantPublicToTenant('nonsense');

        expect(tenant.hideRoutines).toBe(true);
    });

    it('shows Routines once the key is explicitly set to visible', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme', 'hide-routines': false });

        expect(tenant.hideRoutines).toBe(false);
    });

    it('keeps a role-scoped value', () => {
        const tenant = mapTenantPublicToTenant({
            name: 'Acme',
            'hide-routines': { visibleToRoles: ['admin', 'owner'] },
        });

        expect(tenant.hideRoutines).toEqual({ visibleToRoles: ['admin', 'owner'] });
    });

    it('leaves the other hide keys visible by default', () => {
        const tenant = mapTenantPublicToTenant({ name: 'Acme' });

        expect(tenant.hideWhatsNew).toBe(false);
        expect(tenant.hideAiUsage).toBe(false);
    });
});

describe('ROUTINES_HIDDEN_WHEN_UNSET', () => {
    it('is the value the redux initial state starts from', () => {
        const state = tenantReducer(undefined, { type: '@@INIT' });

        expect(state.hideRoutines).toBe(ROUTINES_HIDDEN_WHEN_UNSET);
    });

    it('is the value an unset tenant payload maps to', () => {
        expect(mapTenantPublicToTenant({ name: 'Acme' }).hideRoutines).toBe(ROUTINES_HIDDEN_WHEN_UNSET);
    });

    it('does not apply to a present but unreadable value, which the About form shows as visible', () => {
        expect(mapTenantPublicToTenant({ 'hide-routines': 'nonsense' }).hideRoutines).toBe(false);
        expect(mapTenantPublicToTenant({ 'hide-routines': 7 }).hideRoutines).toBe(false);
    });
});

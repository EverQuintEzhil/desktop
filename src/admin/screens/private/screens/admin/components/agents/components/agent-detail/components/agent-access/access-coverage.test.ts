import { describe, expect, it } from 'vitest';

import type { PlannedAcl, PrincipalAcl } from '@/lib/api/admin/agent-access-check';

import {
    accessPathLabel,
    coverageFor,
    itemDisplayState,
    gapItems,
    canExclude,
    isAdmin,
    isPlatformAdminOnly,
    isReady,
    matchesSearch,
    coverageRatio,
    coverageReason,
    predictState,
    unchangedReason,
    summarise,
} from './access-coverage';
import type { AccessItem, AccessUser } from './access-types';
import { ignoreKey } from './access-types';

const item = (over: Partial<AccessItem> = {}): AccessItem => ({
    id: 'i1',
    name: 'contract_clause_parser',
    kind: 'tool',
    state: 'covered',
    canGrant: true,
    ...over,
});

const user = (over: Partial<AccessUser> = {}): AccessUser => ({
    id: 'u1',
    name: 'Maya Patterson',
    email: 'maya@x.com',
    avatar: '',
    path: 'direct',
    viaGroups: [],
    items: [],
    ...over,
});

describe('coverage derivations', () => {
    it('counts covered against total per kind', () => {
        const subject = user({
            items: [
                item({ id: 'a', kind: 'tool', state: 'covered' }),
                item({ id: 'b', kind: 'tool', state: 'not-included' }),
                item({ id: 'c', kind: 'skill', state: 'covered' }),
            ],
        });

        expect(coverageFor(subject, 'tool')).toEqual({
            kind: 'tool',
            covered: 1,
            ignored: 0,
            excluded: 0,
            total: 2,
            outstanding: 2,
        });
        expect(coverageFor(subject, 'skill')).toEqual({
            kind: 'skill',
            covered: 1,
            ignored: 0,
            excluded: 0,
            total: 1,
            outstanding: 1,
        });
    });

    it('treats an excluded item as settled, not as a gap — the exclusion is the decision', () => {
        const subject = user({ items: [item({ state: 'excluded' })] });

        expect(isReady(subject)).toBe(true);
        expect(gapItems(subject)).toHaveLength(0);
        expect(coverageFor(subject, 'tool')).toMatchObject({ covered: 0, excluded: 1, outstanding: 0 });
    });

    it('reports a user with no items as ready', () => {
        expect(isReady(user())).toBe(true);
    });

    it('reports zero of zero for a kind the agent does not use', () => {
        const subject = user({ items: [item({ kind: 'tool' })] });

        expect(coverageFor(subject, 'dataStore')).toEqual({
            kind: 'dataStore',
            covered: 0,
            ignored: 0,
            excluded: 0,
            total: 0,
            outstanding: 0,
        });
    });
});

describe('summarise', () => {
    it('splits ready from gapped and counts group-granted users', () => {
        const users = [
            user({ id: 'a', items: [item()] }),
            user({ id: 'b', path: 'group', items: [item({ state: 'not-included' })] }),
            user({ id: 'c', path: 'group', items: [item()] }),
        ];

        expect(summarise(users)).toEqual({ total: 3, ready: 2, withGaps: 1, viaGroup: 2, viaAdmin: 0 });
    });

    it('counts every roster row', () => {
        expect(summarise([user({ id: 'a', items: [item()] })]).total).toBe(1);
    });
});

describe('isPlatformAdminOnly', () => {
    it('is true only for the admin path, not for a directly added admin', () => {
        expect(isPlatformAdminOnly(user({ path: 'admin', isPlatformAdmin: true }))).toBe(true);
        expect(isPlatformAdminOnly(user({ path: 'direct', isPlatformAdmin: true }))).toBe(false);
    });

    it('counts admin-path users separately in the summary', () => {
        const users = [user({ id: 'a', path: 'admin' }), user({ id: 'b', path: 'direct' })];

        expect(summarise(users).viaAdmin).toBe(1);
    });
});

describe('isAdmin', () => {
    it('is true for either kind of admin and false for anyone else', () => {
        expect(isAdmin(user({ isPlatformAdmin: true }))).toBe(true);
        expect(isAdmin(user({ isAgentAdmin: true }))).toBe(true);
        expect(isAdmin(user())).toBe(false);
    });
});

describe('canExclude', () => {
    it('follows the item when the api answers', () => {
        expect(canExclude(user(), item({ excludable: false }))).toBe(false);
        expect(canExclude(user(), item({ excludable: true }))).toBe(true);
    });

    it('lets an agent admin be excluded from an item that says so', () => {
        expect(canExclude(user({ isAgentAdmin: true }), item({ excludable: true }))).toBe(true);
    });

    it('rules out a platform admin when the api leaves the item unanswered', () => {
        expect(canExclude(user({ isPlatformAdmin: true }), item())).toBe(false);
        expect(canExclude(user({ isAgentAdmin: true }), item())).toBe(true);
        expect(canExclude(user(), item())).toBe(true);
    });
});

describe('accessPathLabel', () => {
    it('names the group a person came in through', () => {
        expect(accessPathLabel(user({ path: 'group', viaGroups: [{ id: 'g', name: 'Legal-Team' }] }))).toBe(
            'Via group: Legal-Team',
        );
    });

    it('keeps both halves for a directly added admin', () => {
        expect(accessPathLabel(user({ path: 'direct', isPlatformAdmin: true }))).toBe('Added directly · Admin');
    });

    it('does not label an open-to-everyone user as an admin', () => {
        expect(accessPathLabel(user({ path: 'everyone' }))).toBe('Open to everyone');
    });
});

describe('matchesSearch', () => {
    it('matches on name or email and ignores an empty term', () => {
        expect(matchesSearch(user(), '')).toBe(true);
        expect(matchesSearch(user(), 'patterson')).toBe(true);
        expect(matchesSearch(user(), 'MAYA@X')).toBe(true);
        expect(matchesSearch(user(), 'daniel')).toBe(false);
    });
});

describe('ignored gaps', () => {
    const ignored = new Set([ignoreKey('i1', 'u1')]);

    it('masks a not-included item and settles the user', () => {
        const subject = user({ items: [item({ state: 'not-included' })] });

        expect(itemDisplayState(subject.items[0], subject.id, ignored)).toBe('ignored');
        expect(gapItems(subject, ignored)).toHaveLength(0);
        expect(isReady(subject, ignored)).toBe(true);
        expect(coverageFor(subject, 'tool', ignored)).toEqual({
            kind: 'tool',
            covered: 0,
            ignored: 1,
            excluded: 0,
            total: 1,
            outstanding: 0,
        });
    });

    it('never masks an exclusion — the roster verdict wins', () => {
        const subject = user({ items: [item({ state: 'excluded' })] });

        expect(itemDisplayState(subject.items[0], subject.id, ignored)).toBe('excluded');
    });

    it('only masks the pair it names, not the same item for another user', () => {
        const other = user({ id: 'u2', items: [item({ state: 'not-included' })] });

        expect(itemDisplayState(other.items[0], other.id, ignored)).toBe('not-included');
    });

    it('keeps a dismissed user out of the missing-something count', () => {
        const users = [user({ items: [item({ state: 'not-included' })] })];

        expect(summarise(users, ignored).withGaps).toBe(0);
        expect(summarise(users).withGaps).toBe(1);
    });
});

describe('outstanding', () => {
    it('drops an ignored item from the denominator so 4/6 with one ignored reads 4/5', () => {
        const items = [
            ...['a', 'b', 'c', 'd'].map((id) => item({ id, kind: 'connector', state: 'covered' })),
            item({ id: 'e', kind: 'connector', state: 'not-included' }),
            item({ id: 'f', kind: 'connector', state: 'not-included' }),
        ];
        const subject = user({ items });
        const ignored = new Set([ignoreKey('e', 'u1')]);

        expect(coverageFor(subject, 'connector').outstanding).toBe(6);
        expect(coverageFor(subject, 'connector', ignored)).toMatchObject({ covered: 4, ignored: 1, outstanding: 5 });
    });
});

describe('predictState', () => {
    const withGroups = (groups: string[]) => user({ viaGroups: groups.map((id) => ({ id, name: id })) });
    const plan = (over: Partial<PlannedAcl> = {}): PlannedAcl => ({
        includeIds: [],
        excludeIds: [],
        adminIds: [],
        otherIncludeIds: [],
        otherExcludeIds: [],
        ...over,
    });

    it('covers a user named on the include list', () => {
        expect(predictState(user(), plan({ includeIds: ['u1'], otherIncludeIds: ['g9'] }))).toBe('covered');
    });

    it('covers everyone when no list restricts the capability', () => {
        expect(predictState(user(), plan())).toBe('covered');
    });

    it('covers a user reached through an included group', () => {
        expect(predictState(withGroups(['g1']), plan({ otherIncludeIds: ['g1'] }))).toBe('covered');
    });

    it('leaves a user out when the include list names someone else', () => {
        expect(predictState(user(), plan({ includeIds: ['u9'] }))).toBe('not-included');
    });

    it('reports a per-user exclusion as excluded', () => {
        expect(predictState(user(), plan({ excludeIds: ['u1'], includeIds: ['u1'] }))).toBe('excluded');
    });

    it('covers a capability admin whatever the lists say', () => {
        expect(predictState(user(), plan({ adminIds: ['u1'], includeIds: ['u9'] }))).toBe('covered');
    });

    it('covers a platform admin whatever the lists say', () => {
        expect(predictState(user({ isPlatformAdmin: true }), plan({ includeIds: ['u9'] }))).toBe('covered');
    });

    it('refuses to guess when a group exclusion could reach the user', () => {
        expect(predictState(user(), plan({ otherExcludeIds: ['g1'] }))).toBeNull();
    });

    it('refuses to guess when an unseen group could still cover the user', () => {
        expect(predictState(user(), plan({ includeIds: ['u9'], otherIncludeIds: ['g1'] }))).toBeNull();
    });

    it('refuses to guess when the payload carries no admin list', () => {
        expect(predictState(user(), plan({ adminIds: null }))).toBeNull();
    });

    it('refuses to guess when the payload carries no group lists', () => {
        expect(predictState(user(), plan({ otherIncludeIds: null, otherExcludeIds: null }))).toBeNull();
    });
});

describe('unchangedReason', () => {
    const plan = (over: Partial<PlannedAcl> = {}): PlannedAcl => ({
        includeIds: [],
        excludeIds: [],
        adminIds: [],
        otherIncludeIds: [],
        otherExcludeIds: [],
        ...over,
    });

    it('names an open item', () => {
        expect(unchangedReason(user(), plan())).toBe('open-to-everyone');
    });

    it('names the group that still allows it', () => {
        const inGroup = user({ viaGroups: [{ id: 'g1', name: 'Design' }] });

        expect(unchangedReason(inGroup, plan({ otherIncludeIds: ['g1'] }))).toBe('group-allows');
    });

    it('stays silent when the write really removed the access', () => {
        expect(unchangedReason(user(), plan({ includeIds: ['u9'] }))).toBeNull();
    });

    it('stays silent when the group lists were not readable', () => {
        expect(unchangedReason(user(), plan({ otherIncludeIds: null }))).toBeNull();
    });
});

describe('coverageReason', () => {
    const acl = (over: Partial<PrincipalAcl> = {}): PrincipalAcl => ({
        includeIds: [],
        excludeIds: [],
        adminIds: [],
        otherIncludeIds: [],
        otherExcludeIds: [],
        ...over,
    });

    it('names a user on the item’s own include list', () => {
        expect(coverageReason(user(), acl({ includeIds: ['u1'] }))).toBe('they are named on this item');
    });

    it('names the group that reaches the item', () => {
        const inGroup = user({ viaGroups: [{ id: 'g1', name: 'Design' }] });

        expect(coverageReason(inGroup, acl({ otherIncludeIds: ['g1'] }))).toBe(
            'a group they belong to is on this item',
        );
    });

    it('names an item that carries no lists at all', () => {
        expect(coverageReason(user(), acl())).toBe('this item is open to everyone');
    });

    it('names an admin of the item ahead of its lists', () => {
        expect(coverageReason(user(), acl({ adminIds: ['u1'], includeIds: ['u9'] }))).toBe('they administer this item');
    });

    it('names the platform role ahead of everything', () => {
        expect(coverageReason(user({ isPlatformAdmin: true }), acl({ includeIds: ['u9'] }))).toBe(
            'their role reaches every item',
        );
    });

    it('refuses to guess when the payload carries no admin list', () => {
        expect(coverageReason(user(), acl({ adminIds: null }))).toBeNull();
    });

    it('refuses to guess when an unseen group must be what covers them', () => {
        expect(coverageReason(user(), acl({ includeIds: ['u9'], otherIncludeIds: ['g1'] }))).toBeNull();
    });
});

describe('coverageRatio', () => {
    const kindCoverage = (over: Partial<ReturnType<typeof coverageFor>> = {}) => ({
        kind: 'connector' as const,
        covered: 0,
        ignored: 0,
        excluded: 0,
        total: 0,
        outstanding: 0,
        ...over,
    });

    it('counts against the work still to decide', () => {
        expect(coverageRatio(kindCoverage({ covered: 4, outstanding: 13, total: 15, excluded: 1, ignored: 1 }))).toBe(
            '4/13',
        );
    });

    it('falls back to the total once nothing is outstanding', () => {
        expect(coverageRatio(kindCoverage({ covered: 0, outstanding: 0, total: 6, excluded: 6 }))).toBe('0/6');
    });

    it('has no ratio to show when the agent uses none of the kind', () => {
        expect(coverageRatio(kindCoverage())).toBeNull();
    });
});

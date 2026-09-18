import type { QueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AGENT_ACCESS_CHECK_QUERY_KEY } from '@/lib/api/admin/agent-access-check';
import type { AccessPrincipalKind } from '@/lib/api/admin/agent-access-check';
import { authenticatedUser } from '@/test/fixtures/auth';
import { apiUrl, envelope, httpError, server } from '@/test/msw';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import type { AgentType } from '@/types/admin';
import type { Role, UserState } from '@/types/store';

import AgentAccessWarning from './agent-access-warning';

const AGENT_ID = 'agent-1';
const ACCESS_CHECK_PATH = `/agents/${AGENT_ID}/access-check`;
const ROSTER_PATH = `/agents/${AGENT_ID}/access`;

const ADA = { _id: 'user-a', name: { first: 'Ada', last: 'Lovelace' } };
const ENGINEERING = { _id: 'group-a', name: 'Engineering' };

const buildAgent = (includeUsers: object[], includeSecurityGroups: object[]) =>
    ({
        _id: AGENT_ID,
        name: 'Support agent',
        includeUsers,
        includeSecurityGroups,
        skills: [{ _id: 'skill-1' }],
        mcpServers: [],
        dataStores: [],
        tools: [],
    }) as unknown as AgentType;

const agentWithBoth = buildAgent([ADA], [ENGINEERING]);
const agentUsersOnly = buildAgent([ADA], []);
const agentGroupsOnly = buildAgent([], [ENGINEERING]);
const agentOpenAccess = buildAgent([], []);

// ── The roster: both sheets draw their people from it, so it carries every capability the agent
// uses with the verdict the runtime itself reaches, not only the shortfalls.

const rosterItem = (overrides: object = {}) => ({
    id: 'skill-1',
    name: 'Proposal writer',
    kind: 'skill',
    state: 'not-included',
    ...overrides,
});

const missingSkill = rosterItem();
const coveredSkill = rosterItem({ state: 'covered' });
const missingTool = rosterItem({ id: 'tool-1', name: 'Ticket lookup', kind: 'tool' });
const coveredTool = rosterItem({ id: 'tool-1', name: 'Ticket lookup', kind: 'tool', state: 'covered' });

const rosterUser = (overrides: object = {}) => ({
    id: 'user-a',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    path: 'included-user',
    isPlatformAdmin: false,
    isAgentAdmin: false,
    viaGroups: [],
    items: [missingSkill],
    ...overrides,
});

/** Named on the agent's own include list, so she belongs to the users sheet. */
const ada = (items: object[]) => rosterUser({ items });

/** Reached only through an included group, so she belongs to the groups sheet. */
const grace = (items: object[]) =>
    rosterUser({
        id: 'user-b',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        path: 'security-group',
        viaGroups: [{ id: 'group-a', name: 'Engineering' }],
        items,
    });

/** Reaches the agent by platform role alone: nothing here can be granted, revoked or warned about. */
const platformAdmin = (items: object[], overrides: object = {}) =>
    rosterUser({
        id: 'user-admin',
        name: 'Root Admin',
        email: 'root@example.com',
        path: 'admin',
        isPlatformAdmin: true,
        items,
        ...overrides,
    });

/** A platform admin by the flag alone, reached the way any included user is. */
const flaggedAdmin = (items: object[]) =>
    rosterUser({ id: 'user-admin', name: 'Root Admin', path: 'included-user', isPlatformAdmin: true, items });

/** An administrator by their access path alone, with the flag absent from the payload. */
const pathAdmin = (items: object[]) => rosterUser({ id: 'user-admin', name: 'Root Admin', path: 'admin', items });

/** Named on the agent itself: still governed by every capability ACL, so their gaps are real. */
const agentAdmin = (items: object[]) =>
    rosterUser({ id: 'user-admin', name: 'Root Admin', path: 'included-user', isAgentAdmin: true, items });

/** The same platform admin, but a genuine member of the included group. */
const platformAdminInGroup = (items: object[]) =>
    platformAdmin(items, { viaGroups: [{ id: 'group-a', name: 'Engineering' }] });

// ── The gap check: the item-first list behind the security groups sheet, and the ignored set.

const groupPrincipal = { id: 'group-a', kind: 'securityGroup', name: 'Engineering', status: 'not-included' };

const noGaps = { items: [], ignoredItems: [] };

const groupMissesSkill = {
    items: [{ id: 'skill-1', name: 'Proposal writer', kind: 'skill', principals: [groupPrincipal] }],
    ignoredItems: [],
};

const groupMissesTwo = {
    items: [
        { id: 'skill-1', name: 'Proposal writer', kind: 'skill', principals: [groupPrincipal] },
        { id: 'tool-1', name: 'Ticket lookup', kind: 'tool', principals: [groupPrincipal] },
    ],
    ignoredItems: [],
};

/** One dismissed pair, keyed by capability and principal exactly as the ignore route is. */
const adaIgnoresSkill = {
    items: [],
    ignoredItems: [
        {
            id: 'skill-1',
            name: 'Proposal writer',
            kind: 'skill',
            principals: [{ id: 'user-a', kind: 'user', name: 'Ada Lovelace' }],
        },
    ],
};

/** An unrecognised capability kind: one element we cannot read, and nothing else. */
const unreadableItem = {
    items: [{ id: 'app-1', name: 'Mystery app', kind: 'app', principals: [groupPrincipal] }],
    ignoredItems: [],
};

const useCheck = (value: object) => server.use(http.post(apiUrl(ACCESS_CHECK_PATH), () => envelope(value)));

const useRoster = (users: object[]) => server.use(http.get(apiUrl(ROSTER_PATH), () => envelope({ users })));

const failCheck = () => server.use(http.post(apiUrl(ACCESS_CHECK_PATH), () => httpError(500)));

const failRoster = () => server.use(http.get(apiUrl(ROSTER_PATH), () => httpError(500)));

const stateForRole = (role: Role): { user: UserState } => ({ user: { ...authenticatedUser, role } });

interface RenderOptions {
    agent?: AgentType;
    principalKind?: AccessPrincipalKind;
    preloadedState?: { user: UserState };
    canUserEdit?: boolean;
}

const renderWarning = (options: RenderOptions = {}) => {
    const {
        agent = agentWithBoth,
        principalKind = 'user',
        preloadedState = stateForRole('admin'),
        canUserEdit = true,
    } = options;

    return renderWithProviders(
        <AgentAccessWarning agent={agent} principalKind={principalKind} canUserEdit={canUserEdit} />,
        { preloadedState },
    );
};

const USERS_BUTTON = /review access for users/i;
const GROUPS_BUTTON = /review access for security groups/i;

const warningButton = (name = USERS_BUTTON) => screen.findByRole('button', { name });

/**
 * A positive signal to await before asserting the button is absent. `waitFor` accepts an absence
 * assertion on its first tick, which is before the request has even been issued, so without this
 * such a test passes with the behaviour it guards reverted.
 */
const accessCheckSettled = async (queryClient: QueryClient) => {
    await waitFor(() => {
        const [query] = queryClient.getQueryCache().findAll({ queryKey: AGENT_ACCESS_CHECK_QUERY_KEY });

        expect(query?.state.status ?? 'pending').not.toBe('pending');
    });
};

/** The whole count sentence lives in the button's tooltip, so it is only reachable on hover. */
const warningTooltip = async (user: ReturnType<typeof userEvent.setup>, name = USERS_BUTTON) => {
    await user.hover(await warningButton(name));

    return screen.findByRole('tooltip');
};

const FULL_COVERAGE = 'Everyone listed has access to everything this agent uses.';
const UNREADABLE = 'Some of this agent’s access information could not be read.';
const UNKNOWN = 'Could not load who has access to this agent.';

describe('AgentAccessWarning — the entry-point button', () => {
    it('offers Review access for the users row', async () => {
        useCheck(noGaps);
        useRoster([ada([missingSkill])]);

        renderWarning();

        const review = await warningButton();

        expect(review).toHaveTextContent('Review access');
        expect(review).toHaveClass('agent-access-warning');
    });

    it('labels the security groups row for its own principal kind', async () => {
        useCheck(groupMissesSkill);
        useRoster([grace([missingSkill])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningButton(GROUPS_BUTTON)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: USERS_BUTTON })).not.toBeInTheDocument();
    });

    it('keeps its shield even when nothing falls short, because the button is not a warning', async () => {
        useCheck(noGaps);
        useRoster([ada([coveredSkill])]);

        renderWarning();

        const review = await warningButton();

        expect(review.querySelector('.lucide-shield-check')).toBeInTheDocument();
    });

    it('stays silent when there is nothing at all to show', async () => {
        useCheck(noGaps);
        useRoster([]);

        const { queryClient } = renderWarning({ agent: agentUsersOnly });

        await accessCheckSettled(queryClient);

        expect(screen.queryByRole('button', { name: /review access/i })).not.toBeInTheDocument();
    });
});

describe('AgentAccessWarning — what the tooltip says', () => {
    it('says everyone listed has access when nobody falls short', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([ada([coveredSkill])]);

        renderWarning();

        expect(await warningTooltip(user)).toHaveTextContent(FULL_COVERAGE);
    });

    it('names the affected principals and how many items they lack', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([ada([missingSkill, missingTool])]);

        renderWarning();

        expect(await warningTooltip(user)).toHaveTextContent('1 user lacks access to 2 items this agent uses.');
    });

    it('admits the information could not be read when a roster element was unreadable', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([{ id: 'user-a' }]);

        renderWarning();

        expect(await warningTooltip(user)).toHaveTextContent(UNREADABLE);
    });

    it('appends the partial read to a real shortfall rather than reading as exhaustive', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([ada([missingSkill]), { id: 'user-x' }]);

        renderWarning();

        expect(await warningTooltip(user)).toHaveTextContent(
            '1 user lacks access to 1 item this agent uses. 1 entry could not be read.',
        );
    });

    it('counts an unreadable element of the gap check on the security groups sheet', async () => {
        const user = userEvent.setup();

        useCheck(unreadableItem);
        useRoster([]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(UNREADABLE);
    });
});

describe('AgentAccessWarning — who each sheet reviews', () => {
    it('keeps a platform admin off the users sheet, whose role bypasses every ACL', async () => {
        useCheck(noGaps);
        useRoster([platformAdmin([missingSkill])]);

        const { queryClient, unmount } = renderWarning({ agent: agentOpenAccess });

        await accessCheckSettled(queryClient);

        expect(screen.queryByRole('button', { name: /review access/i })).not.toBeInTheDocument();
        unmount();

        // The ordinary user is the control: the same open agent and the same shortfall do warn, so
        // the silence above can only come from the platform role.
        useRoster([grace([missingSkill])]);
        renderWarning({ agent: agentOpenAccess });

        expect(await warningButton()).toBeInTheDocument();
    });

    it('lists a platform admin on the groups sheet without counting them as short', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([platformAdminInGroup([missingSkill])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        // Listed, because they really are a member — but their role reaches every capability, so
        // an ACL that omits them is not a shortfall anyone can act on.
        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(FULL_COVERAGE);
    });

    it('does not flag a group whose only short member is an administrator', async () => {
        const user = userEvent.setup();

        // The check reports the group as off the skill's list, which is true — but its one member
        // reaches the skill by role, so there is no shortfall to act on.
        useCheck(groupMissesSkill);
        useRoster([platformAdminInGroup([missingSkill])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(FULL_COVERAGE);
    });

    it('counts an ordinary member of the same group as short', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([grace([missingSkill])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(
            '1 user lacks access to 1 item this agent uses.',
        );
    });

    it('recognises an administrator by the flag alone, not only by the access path', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([flaggedAdmin([missingSkill]), grace([coveredSkill])]);

        renderWarning({ agent: agentOpenAccess });

        expect(await warningTooltip(user)).toHaveTextContent(FULL_COVERAGE);
    });

    it('counts an agent admin as short, whose capability ACLs are still enforced', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([agentAdmin([missingSkill]), grace([coveredSkill])]);

        renderWarning({ agent: agentOpenAccess });

        expect(await warningTooltip(user)).toHaveTextContent('1 user lacks access to 1 item this agent uses.');
    });

    it('recognises an administrator by the access path alone, with the flag absent', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([pathAdmin([missingSkill]), grace([coveredSkill])]);

        renderWarning({ agent: agentOpenAccess });

        expect(await warningTooltip(user)).toHaveTextContent(FULL_COVERAGE);
    });

    it('does not treat an agent with only groups included as open to everyone', async () => {
        useCheck(noGaps);
        useRoster([grace([missingSkill])]);

        const { queryClient } = renderWarning({ agent: agentGroupsOnly });

        await accessCheckSettled(queryClient);

        expect(screen.queryByRole('button', { name: /review access/i })).not.toBeInTheDocument();
    });

    it('reviews the whole roster on the users sheet when both include lists are empty', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([grace([missingSkill])]);

        renderWarning({ agent: agentOpenAccess });

        expect(await warningTooltip(user)).toHaveTextContent('1 user lacks access to 1 item this agent uses.');
    });
});

describe('AgentAccessWarning — included groups', () => {
    it('lists an included group that falls short of nothing, since the sheet is where its members are read', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        useRoster([]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(FULL_COVERAGE);
    });

    it('raises no warning when every current member reaches the item another way', async () => {
        const user = userEvent.setup();

        useCheck(groupMissesSkill);
        useRoster([grace([coveredSkill])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(FULL_COVERAGE);
    });

    it('counts only what a member actually lacks, not every item the group is off', async () => {
        const user = userEvent.setup();

        useCheck(groupMissesTwo);
        useRoster([grace([missingSkill, coveredTool])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(
            '1 security group and 1 user lack access to 1 item this agent uses.',
        );
    });

    it('warns for the group and the member when a member really lacks the item', async () => {
        const user = userEvent.setup();

        useCheck(groupMissesSkill);
        useRoster([grace([missingSkill])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(
            '1 security group and 1 user lack access to 1 item this agent uses.',
        );
    });
});

describe('AgentAccessWarning — what it reads', () => {
    it('reads both the gap check and the roster for the security groups sheet', async () => {
        let checkRequests = 0;
        let rosterRequests = 0;

        server.use(
            http.post(apiUrl(ACCESS_CHECK_PATH), () => {
                checkRequests += 1;

                return envelope(groupMissesSkill);
            }),
            http.get(apiUrl(ROSTER_PATH), () => {
                rosterRequests += 1;

                return envelope({ users: [grace([missingSkill])] });
            }),
        );

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningButton(GROUPS_BUTTON)).toBeInTheDocument();
        await waitFor(() => expect(rosterRequests).toBe(1));
        expect(checkRequests).toBe(1);
    });

    it('re-reads the roster when the agent include list changes', async () => {
        let rosterRequests = 0;

        useCheck(noGaps);
        server.use(
            http.get(apiUrl(ROSTER_PATH), () => {
                rosterRequests += 1;

                return envelope({ users: [ada([missingSkill])] });
            }),
        );

        const { rerender } = renderWarning({ agent: agentUsersOnly });

        expect(await warningButton()).toBeInTheDocument();
        await waitFor(() => expect(rosterRequests).toBe(1));

        rerender(
            <AgentAccessWarning
                agent={buildAgent([ADA, { _id: 'user-b', name: { first: 'Grace', last: 'Hopper' } }], [])}
                principalKind="user"
                canUserEdit
            />,
        );

        await waitFor(() => expect(rosterRequests).toBe(2));
    });

    it('does not read access at all for a non-admin', async () => {
        let checkRequests = 0;
        let rosterRequests = 0;

        server.use(
            http.post(apiUrl(ACCESS_CHECK_PATH), () => {
                checkRequests += 1;

                return envelope(noGaps);
            }),
            http.get(apiUrl(ROSTER_PATH), () => {
                rosterRequests += 1;

                return envelope({ users: [ada([missingSkill])] });
            }),
        );

        const { unmount } = renderWarning({ preloadedState: stateForRole('user') });

        expect(screen.queryByRole('button', { name: /review access/i })).not.toBeInTheDocument();
        unmount();

        // The admin render is the control: it proves the handlers and the timing are sound, so the
        // single request each can only have come from it and the non-admin render issued none.
        renderWarning({ preloadedState: stateForRole('admin') });

        expect(await warningButton()).toBeInTheDocument();
        expect(checkRequests).toBe(1);
        expect(rosterRequests).toBe(1);
    });
});

describe('AgentAccessWarning — a read that failed', () => {
    it('says the access could not be loaded when the roster could not be read', async () => {
        const user = userEvent.setup();

        useCheck(noGaps);
        failRoster();

        renderWarning({ agent: agentUsersOnly });

        expect(await warningTooltip(user)).toHaveTextContent(UNKNOWN);
    });

    it('says the access could not be loaded on the groups sheet when the gap check could not be read', async () => {
        const user = userEvent.setup();

        failCheck();
        useRoster([grace([missingSkill])]);

        renderWarning({ agent: agentGroupsOnly, principalKind: 'securityGroup' });

        expect(await warningTooltip(user, GROUPS_BUTTON)).toHaveTextContent(UNKNOWN);
    });
});

describe('AgentAccessWarning — dismissed pairs', () => {
    it('keeps an ignore on an agent open to everyone, whose include list is empty by definition', async () => {
        const user = userEvent.setup();

        useCheck(adaIgnoresSkill);
        useRoster([ada([missingSkill])]);

        renderWarning({ agent: agentOpenAccess });

        expect(await warningTooltip(user)).toHaveTextContent(FULL_COVERAGE);
    });

    it('asks the check about the roster users when the agent has no include lists', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        // The backend short-circuits to an empty answer for empty id lists, so an open agent's
        // ignores only exist in the response when the request names the roster's own users.
        server.use(
            http.post(apiUrl(ACCESS_CHECK_PATH), async ({ request }) => {
                bodies.push(await request.json());

                return envelope(adaIgnoresSkill);
            }),
        );
        useRoster([ada([missingSkill])]);

        renderWarning({ agent: agentOpenAccess });

        expect(await warningTooltip(user)).toHaveTextContent(FULL_COVERAGE);
        expect(bodies).toContainEqual(expect.objectContaining({ userIds: ['user-a'] }));
    });

    it('lets the roster overrule an ignore that no longer describes a gap', async () => {
        const user = userEvent.setup();

        useCheck(adaIgnoresSkill);
        useRoster([ada([coveredSkill])]);

        renderWarning({ agent: agentUsersOnly });

        await user.click(await warningButton());
        await user.click(screen.getByRole('tab', { name: 'All' }));
        await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }));
        // Capability groups start closed, and a closed group unmounts the rows this asserts on.
        await user.click(screen.getByRole('button', { name: 'Skills, 1 item' }));

        expect(screen.getByText('Has access')).toBeInTheDocument();
        expect(screen.queryByText('Ignored')).not.toBeInTheDocument();
    });
});

import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import type { AccessPrincipalKind, CapabilityKind } from '@/lib/api/admin/agent-access-check';
import { authenticatedUser } from '@/test/fixtures/auth';
import { apiUrl, envelope, httpError, server } from '@/test/msw';
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
import type { Role } from '@/types/store';

import type {
    GroupGap,
    GroupGapItem,
    ItemAccessState,
    PrincipalGap,
    PrincipalGapItem,
} from '../../use-agent-access-gaps';

import AccessGapSheet from './access-gap-sheet';

const AGENT_ID = 'agent-1';

const LONG_NAME = 'get_matching_innovation_lib_and_research_resources';

const item = (overrides: Partial<PrincipalGapItem> = {}): PrincipalGapItem => ({
    itemId: 'tool-1',
    itemName: 'Ticket lookup',
    itemKind: 'tool',
    state: 'missing',
    ...overrides,
});

const stateItem = (itemId: string, itemName: string, state: ItemAccessState): PrincipalGapItem =>
    item({ itemId, itemName, state });

/** `needsActionCount` is derived so a fixture can never disagree with the items it lists. */
const person = (overrides: Partial<PrincipalGap> = {}): PrincipalGap => {
    const items = overrides.items ?? [item()];

    return {
        id: 'user-a',
        name: 'Ada Lovelace',
        viaGroups: [],
        needsActionCount: items.filter((entry) => entry.state === 'missing').length,
        ...overrides,
        items,
    };
};

/** Their role reads through every capability ACL, so no write on their rows could land. */
const platformAdmin = (overrides: Partial<PrincipalGap> = {}): PrincipalGap =>
    person({ isAdmin: true, bypassesAccessLists: true, ...overrides });

/** Named on the agent, but still governed by every capability ACL, so their item rows do act. */
const agentAdmin = (overrides: Partial<PrincipalGap> = {}): PrincipalGap =>
    person({ id: 'user-b', name: 'Grace Hopper', isAdmin: true, ...overrides });

const groupItem = (overrides: Partial<GroupGapItem> = {}): GroupGapItem => ({
    itemId: 'tool-1',
    itemName: 'Ticket lookup',
    itemKind: 'tool',
    state: 'missing',
    ...overrides,
});

const group = (overrides: Partial<GroupGap> = {}): GroupGap => {
    const items = overrides.items ?? [groupItem()];

    return {
        id: 'group-a',
        name: 'Engineering',
        memberIds: ['user-a'],
        needsActionCount: items.filter((entry) => entry.state === 'missing').length,
        ...overrides,
        items,
    };
};

interface RenderOptions {
    people?: PrincipalGap[];
    groups?: GroupGap[];
    principalKind?: AccessPrincipalKind;
    droppedCount?: number;
    hasFailedRead?: boolean;
    canGrant?: boolean;
    role?: Role;
    onClose?: () => void;
    onRetry?: () => void;
}

const sheetElement = (options: RenderOptions = {}) => {
    const {
        people = [],
        groups = [],
        principalKind = 'user',
        droppedCount = 0,
        hasFailedRead = false,
        canGrant = true,
        onClose,
        onRetry,
    } = options;

    return (
        <AccessGapSheet
            isOpen
            onClose={onClose ?? (() => {})}
            agentId={AGENT_ID}
            title={principalKind === 'securityGroup' ? 'Security groups' : 'Included users'}
            principalKind={principalKind}
            groups={groups}
            people={people}
            droppedCount={droppedCount}
            hasFailedRead={hasFailedRead}
            onRetry={onRetry ?? (() => {})}
            canGrant={canGrant}
        />
    );
};

const renderSheet = (options: RenderOptions = {}) =>
    renderWithProviders(sheetElement(options), {
        preloadedState: { user: { ...authenticatedUser, role: options.role ?? 'admin' } },
    });

/** The real app mounts the `sonner` outlet at its root, so a toast is only assertable with it present. */
const renderWithToasts = (options: RenderOptions = {}) =>
    renderWithProviders(
        <>
            {sheetElement(options)}
            <Toaster />
        </>,
        { preloadedState: { user: { ...authenticatedUser, role: options.role ?? 'admin' } } },
    );

const rowButton = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

const openRow = async (name: string) => {
    const user = userEvent.setup();

    await user.click(rowButton(name));
};

/**
 * A closed group unmounts its rows, so anything inside one has to be opened first. A group that
 * still owes work opens itself, so this only clicks when it is actually shut — clicking an open one
 * would close it. The name is the trigger's own label, e.g. `Tools, 1 item`.
 */
const openGroup = async (name: string) => {
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name });

    if (trigger.getAttribute('aria-expanded') === 'true') return;

    await user.click(trigger);
};

const goBack = async () => {
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Back' }));
};

const tab = (name: 'Needs action' | 'All') => screen.getByRole('tab', { name });

const switchTo = async (name: 'Needs action' | 'All') => {
    const user = userEvent.setup();

    await user.click(tab(name));
};

const search = async (text: string) => {
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Search'), text);
};

/** Every row carries a name and its own controls, so a query has to say which row it means. */
const rowFor = (name: string) => {
    const row = screen.getByText(name).closest('li');

    if (!(row instanceof HTMLElement)) throw new Error(`No row for ${name}`);

    return within(row);
};

type StateLabel = 'Has access' | 'No access' | 'Excluded' | 'Ignored';

const openStateMenu = async (itemName: string, label: StateLabel) => {
    const user = userEvent.setup();

    await user.click(rowFor(itemName).getByRole('button', { name: label }));

    return within(await screen.findByRole('menu'));
};

const chooseAction = async (itemName: string, from: StateLabel, action: string) => {
    const user = userEvent.setup();
    const menu = await openStateMenu(itemName, from);

    await user.click(menu.getByRole('menuitem', { name: new RegExp(`^${action}`) }));
};

interface CapturedWrite {
    itemId: string;
    body: unknown;
}

const captureToolWrites = (writes: CapturedWrite[], acl: Record<string, string[]>) => {
    server.use(
        http.get(apiUrl('/tools/:itemId'), () => envelope(acl)),
        http.put(apiUrl('/tools/:itemId'), async ({ request, params }) => {
            writes.push({ itemId: String(params.itemId), body: await request.json() });

            return envelope({});
        }),
    );
};

/** Same read as a successful grant, so only the write itself is what fails. */
const failToolWrites = (writes: CapturedWrite[]) => {
    server.use(
        http.get(apiUrl('/tools/:itemId'), () => envelope(EXCLUDED_ACL)),
        http.put(apiUrl('/tools/:itemId'), async ({ request, params }) => {
            writes.push({ itemId: String(params.itemId), body: await request.json() });

            return httpError(500);
        }),
    );
};

const captureIgnoreWrites = (writes: { agentId: string; body: unknown }[]) => {
    server.use(
        http.put(apiUrl('/agents/:agentId/access-ignores'), async ({ request, params }) => {
            writes.push({ agentId: String(params.agentId), body: await request.json() });

            return envelope({ ignored: true });
        }),
    );
};

/** Answers the read a menu makes to decide whether a removal would change anything. */
const stubAclRead = (acl: Record<string, string[]>) => {
    server.use(http.get(apiUrl('/tools/:itemId'), () => envelope(acl)));
};

/** Nobody named on either list, so every removal is a no-op and everyone is covered by default. */
const OPEN_TO_EVERYONE_ACL = {
    adminIds: [],
    includeUserIds: [],
    excludeUserIds: [],
    includeSecurityGroupIds: [],
    excludeSecurityGroupIds: [],
};

const EXCLUDED_ACL = { includeUserIds: ['user-z'], excludeUserIds: ['user-a'] };
const INCLUDED_ACL = { includeUserIds: ['user-a', 'user-z'], excludeUserIds: [] };

/** A write held open on purpose, released before the test ends: the per-capability write queue is
 *  module-scoped, so a request left hanging would block every later write on the same item. */
const heldToolWrite = () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });

    server.use(
        http.get(apiUrl('/tools/:itemId'), () => envelope(EXCLUDED_ACL)),
        http.put(apiUrl('/tools/:itemId'), async () => {
            await held;

            return envelope({});
        }),
    );

    return release;
};

describe('AccessGapSheet — the users list', () => {
    it('lists each person by name and nothing else about their standing', () => {
        renderSheet({
            people: [
                person({ items: [item({ itemId: 'tool-1' }), item({ itemId: 'tool-2', itemName: 'Ticket writer' })] }),
                person({ id: 'user-c', name: 'Cleo Ward' }),
            ],
        });

        expect(rowFor('Ada Lovelace').queryByText('2 missing')).not.toBeInTheDocument();
        expect(rowFor('Cleo Ward').queryByText('1 missing')).not.toBeInTheDocument();
    });

    it('says nothing at all about a person with nothing missing', async () => {
        renderSheet({ people: [person({ items: [stateItem('tool-1', 'Ticket lookup', 'granted')] })] });

        await switchTo('All');

        expect(rowFor('Ada Lovelace').queryByText('Ready')).not.toBeInTheDocument();
    });

    it('marks a platform admin, whose rows can be acted on nowhere in this sheet', async () => {
        renderSheet({ people: [platformAdmin()] });

        await switchTo('All');

        expect(rowFor('Ada Lovelace').getByText('Admin')).toBeInTheDocument();
    });

    it('admits how many records could not be read alongside the rows that survived', () => {
        renderSheet({ people: [person()], droppedCount: 2 });

        expect(screen.getByText('2 entries could not be read and are not shown here.')).toBeInTheDocument();
    });

    it('says everyone listed has access when there is nobody to list and nothing was dropped', () => {
        renderSheet();

        expect(screen.getByText('Everyone listed has access to everything this agent uses.')).toBeInTheDocument();
    });

    it('says the access could not be loaded rather than listing nobody when either read failed', () => {
        renderSheet({ hasFailedRead: true });

        expect(screen.getByText('Could not load who has access to this agent.')).toBeInTheDocument();
        expect(screen.queryByText('Everyone listed has access to everything this agent uses.')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
    });

    // The Access tab offers a Retry on the same failure, and a sheet that only says "reload" makes
    // the two screens look like different features.
    it('retries both reads from the failed-read state', async () => {
        const onRetry = vi.fn();
        const user = userEvent.setup();

        renderSheet({ hasFailedRead: true, onRetry });

        await user.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('keeps a long person name reachable through the truncation primitive', () => {
        renderSheet({ people: [person({ name: LONG_NAME })] });

        const label = screen.getByText(LONG_NAME);

        expect(label.tagName).toBe('ABBR');
        expect(label).toHaveClass('truncate');
    });
});

describe('AccessGapSheet — the Needs action / All switcher', () => {
    const settledAndOpen = () => [
        person({ items: [item()] }),
        person({ id: 'user-c', name: 'Cleo Ward', items: [stateItem('tool-2', 'Ticket writer', 'granted')] }),
    ];

    it('opens on Needs action', () => {
        renderSheet({ people: [person()] });

        expect(tab('Needs action')).toHaveAttribute('aria-selected', 'true');
        expect(tab('All')).toHaveAttribute('aria-selected', 'false');
    });

    it('hides a person with nothing missing until All is picked', async () => {
        renderSheet({ people: settledAndOpen() });

        expect(screen.queryByText('Cleo Ward')).not.toBeInTheDocument();

        await switchTo('All');

        expect(screen.getByText('Cleo Ward')).toBeInTheDocument();
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('hides a settled capability of the person being viewed until All is picked', async () => {
        renderSheet({
            people: [person({ items: [item(), stateItem('tool-2', 'Ticket writer', 'granted')] })],
        });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        expect(screen.getByText('Ticket lookup')).toBeInTheDocument();
        expect(screen.queryByText('Ticket writer')).not.toBeInTheDocument();

        await switchTo('All');

        expect(screen.getByText('Ticket writer')).toBeInTheDocument();
    });

    it('hides a group with nothing missing until All is picked', async () => {
        renderSheet({
            principalKind: 'securityGroup',
            groups: [
                group(),
                group({ id: 'group-b', name: 'Design', items: [groupItem({ itemId: 'tool-2', state: 'ignored' })] }),
            ],
        });

        expect(screen.queryByText('Design')).not.toBeInTheDocument();

        await switchTo('All');

        expect(screen.getByText('Design')).toBeInTheDocument();
    });
});

describe('AccessGapSheet — navigating the levels', () => {
    it('names the sheet at the list level and offers no way back', () => {
        renderSheet({ people: [person()] });

        expect(screen.getByText('Included users')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    it('opens a person from the users list and comes back', async () => {
        renderSheet({ people: [person()] });

        await openRow('Ada Lovelace');

        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();

        await openGroup('Tools, 1 item');

        expect(rowFor('Ticket lookup').getByRole('button', { name: 'No access' })).toBeInTheDocument();

        await goBack();

        expect(screen.getByText('Included users')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });

    // The person-level status pill went from both surfaces; a group row is the same kind of row and
    // keeps no version of it.
    it('says nothing about a group\u2019s standing beyond its member count', () => {
        renderSheet({
            principalKind: 'securityGroup',
            groups: [group({ memberIds: ['user-a'] })],
            people: [person()],
        });

        const row = rowFor('Engineering');

        expect(row.getByText('1 member')).toBeInTheDocument();
        expect(row.queryByText('1 missing')).not.toBeInTheDocument();
        expect(row.queryByText('Ready')).not.toBeInTheDocument();
    });

    it('walks group to members to capabilities on the security groups sheet', async () => {
        renderSheet({
            principalKind: 'securityGroup',
            groups: [group({ memberIds: ['user-a'] })],
            people: [person()],
        });

        expect(screen.getByText('Security groups')).toBeInTheDocument();
        expect(screen.getByText('1 member')).toBeInTheDocument();

        await openRow('Engineering');

        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.queryByText('Ticket lookup')).not.toBeInTheDocument();

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        expect(screen.getByText('Ticket lookup')).toBeInTheDocument();

        await goBack();

        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.queryByText('Ticket lookup')).not.toBeInTheDocument();

        await goBack();

        expect(screen.getByText('Security groups')).toBeInTheDocument();
    });

    it('names the groups a person was reached through under their name', async () => {
        renderSheet({
            principalKind: 'securityGroup',
            groups: [group()],
            people: [
                person({
                    viaGroups: [
                        { id: 'group-a', name: 'Engineering' },
                        { id: 'group-b', name: 'Design' },
                    ],
                }),
            ],
        });

        await openRow('Engineering');
        await openRow('Ada Lovelace');

        expect(screen.getByText('via Engineering, Design')).toBeInTheDocument();
    });

    it('lists only the members of the group that was opened', async () => {
        renderSheet({
            principalKind: 'securityGroup',
            groups: [group({ memberIds: ['user-a'] })],
            people: [person(), person({ id: 'user-c', name: 'Cleo Ward' })],
        });

        await openRow('Engineering');

        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(screen.queryByText('Cleo Ward')).not.toBeInTheDocument();
    });

    it('points at the All view when the filter hid every member of the opened group', async () => {
        renderSheet({ principalKind: 'securityGroup', groups: [group({ memberIds: [] })], people: [person()] });

        await openRow('Engineering');

        // Under the filter an empty list means nothing needs action here — claiming the group has
        // no members would contradict the All view, which still lists them.
        expect(
            screen.getByText('No members of this group need action. Switch to All to see everyone in it.'),
        ).toBeInTheDocument();
    });

    it('says the group is empty only when nothing is filtered out', async () => {
        renderSheet({ principalKind: 'securityGroup', groups: [group({ memberIds: [] })], people: [person()] });

        await openRow('Engineering');
        await switchTo('All');

        expect(screen.getByText('This security group has no members.')).toBeInTheDocument();
    });
});

describe('AccessGapSheet — search', () => {
    it('filters the group list by name', async () => {
        renderSheet({
            principalKind: 'securityGroup',
            groups: [group(), group({ id: 'group-b', name: 'Design' })],
        });

        await search('desi');

        expect(screen.getByText('Design')).toBeInTheDocument();
        expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    });

    it('filters the people list by name', async () => {
        renderSheet({ people: [person(), person({ id: 'user-c', name: 'Cleo Ward' })] });

        await search('cleo');

        expect(screen.getByText('Cleo Ward')).toBeInTheDocument();
        expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    });

    it('filters a person capabilities by name', async () => {
        renderSheet({ people: [person({ items: [item(), item({ itemId: 'tool-2', itemName: 'Ticket writer' })] })] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 2 items');
        await search('writer');

        expect(screen.getByText('Ticket writer')).toBeInTheDocument();
        expect(screen.queryByText('Ticket lookup')).not.toBeInTheDocument();
    });

    it('says the filter matched nothing rather than saying everyone has access', async () => {
        renderSheet({ people: [person()] });

        await search('nobody');

        expect(screen.getByText('Nothing matches your search.')).toBeInTheDocument();
        expect(screen.queryByText('Everyone listed has access to everything this agent uses.')).not.toBeInTheDocument();
    });

    it('clears the query when the next level opens', async () => {
        renderSheet({ people: [person({ items: [item(), item({ itemId: 'tool-2', itemName: 'Ticket writer' })] })] });

        await search('ada');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 2 items');

        expect(screen.getByPlaceholderText('Search')).toHaveValue('');
        expect(screen.getByText('Ticket lookup')).toBeInTheDocument();
        expect(screen.getByText('Ticket writer')).toBeInTheDocument();
    });
});

describe('AccessGapSheet — the capability detail view', () => {
    it('groups a person capabilities under headers named after the kind', async () => {
        renderSheet({
            people: [
                person({
                    items: [item(), item({ itemId: 'store-1', itemName: 'Project docs', itemKind: 'dataStore' })],
                }),
            ],
        });

        await openRow('Ada Lovelace');

        expect(screen.getByRole('button', { name: 'Tools, 1 item' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Data stores, 1 item' })).toBeInTheDocument();
    });

    // The Access tab's own rule, now shared: what still owes work is on screen, what is settled is
    // one click away.
    it('opens the kinds that still owe work and leaves the settled ones shut', async () => {
        renderSheet({
            people: [
                person({
                    items: [
                        item(),
                        item({ itemId: 'store-1', itemName: 'Project docs', itemKind: 'dataStore', state: 'granted' }),
                    ],
                }),
            ],
        });

        await switchTo('All');
        await openRow('Ada Lovelace');

        expect(screen.getByText('Ticket lookup')).toBeInTheDocument();
        expect(screen.queryByText('Project docs')).not.toBeInTheDocument();

        await openGroup('Data stores, 1 item');

        expect(screen.getByText('Project docs')).toBeInTheDocument();
    });

    it('lands a capability kind it cannot map in a labelled catch-all group', async () => {
        renderSheet({ people: [person({ items: [item({ itemKind: 'quantum' as CapabilityKind })] })] });

        await openRow('Ada Lovelace');

        expect(screen.getByRole('button', { name: 'Other, 1 item' })).toBeInTheDocument();

        await openGroup('Other, 1 item');

        expect(screen.getByText('Ticket lookup')).toBeInTheDocument();
    });

    it('offers no write on a platform admin and says why', async () => {
        renderSheet({ people: [platformAdmin()] });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        const row = rowFor('Ticket lookup');

        expect(row.getByText('No access')).toBeInTheDocument();
        expect(row.queryByRole('button')).not.toBeInTheDocument();
        expect(row.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(
            screen.getByText('Administrators are not governed by these access lists, so they cannot be changed here.'),
        ).toBeInTheDocument();
    });

    // The split the roster now draws: only the platform role reads through the capability ACLs,
    // so an admin named on the agent has rows a write can still move.
    it('still offers the item actions of an agent admin, unlike a platform admin', async () => {
        renderSheet({ people: [agentAdmin(), platformAdmin()] });

        await openRow('Grace Hopper');
        await openGroup('Tools, 1 item');

        expect(rowFor('Ticket lookup').getByRole('button', { name: 'No access' })).toBeInTheDocument();
        expect(rowFor('Ticket lookup').getByRole('checkbox')).toBeInTheDocument();
        expect(
            screen.queryByText(
                'Administrators are not governed by these access lists, so they cannot be changed here.',
            ),
        ).not.toBeInTheDocument();
    });
});

describe('AccessGapSheet — the row state menu', () => {
    const everyState = () =>
        person({
            items: [
                stateItem('tool-1', 'Ticket lookup', 'granted'),
                stateItem('tool-2', 'Ticket writer', 'missing'),
                stateItem('tool-3', 'Ticket closer', 'revoked'),
                stateItem('tool-4', 'Ticket mover', 'ignored'),
            ],
        });

    const openEveryState = async () => {
        renderSheet({ people: [everyState()] });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 4 items');
    };

    it('reads the state each row is in without relying on colour', async () => {
        await openEveryState();

        expect(rowFor('Ticket lookup').getByRole('button', { name: 'Has access' })).toBeInTheDocument();
        expect(rowFor('Ticket writer').getByRole('button', { name: 'No access' })).toBeInTheDocument();
        expect(rowFor('Ticket closer').getByRole('button', { name: 'Excluded' })).toBeInTheDocument();
        expect(rowFor('Ticket mover').getByRole('button', { name: 'Ignored' })).toBeInTheDocument();
    });

    it('offers grant, ignore and block on a row with no access', async () => {
        await openEveryState();

        const menu = await openStateMenu('Ticket writer', 'No access');

        expect(menu.getByRole('menuitem', { name: /^Ignore/ })).toBeInTheDocument();
        expect(menu.getByRole('menuitem', { name: /^Exclude/ })).toBeInTheDocument();
        expect(menu.getAllByRole('menuitem')).toHaveLength(3);
    });

    it('offers only block and reset on a row that has access', async () => {
        stubAclRead(INCLUDED_ACL);
        await openEveryState();

        const menu = await openStateMenu('Ticket lookup', 'Has access');

        expect(menu.getByRole('menuitem', { name: /^Exclude/ })).toBeInTheDocument();
        expect(menu.getByRole('menuitem', { name: /^Reset/ })).toBeInTheDocument();
        expect(menu.queryByRole('menuitem', { name: /^Grant/ })).not.toBeInTheDocument();
        expect(menu.queryByRole('menuitem', { name: /^Ignore/ })).not.toBeInTheDocument();
    });

    it('offers only grant and unblock on a blocked row', async () => {
        stubAclRead(EXCLUDED_ACL);
        await openEveryState();

        const menu = await openStateMenu('Ticket closer', 'Excluded');

        expect(menu.getByRole('menuitem', { name: /^Grant/ })).toBeInTheDocument();
        expect(menu.getByRole('menuitem', { name: /^Stop excluding/ })).toBeInTheDocument();
        expect(menu.getAllByRole('menuitem')).toHaveLength(2);
    });

    it('offers the way out of ignored alongside the two ACL verbs', async () => {
        await openEveryState();

        const menu = await openStateMenu('Ticket mover', 'Ignored');

        expect(menu.getByRole('menuitem', { name: /^Grant/ })).toBeInTheDocument();
        expect(menu.getByRole('menuitem', { name: /^Stop ignoring/ })).toBeInTheDocument();
        expect(menu.getByRole('menuitem', { name: /^Exclude/ })).toBeInTheDocument();
        expect(menu.getAllByRole('menuitem')).toHaveLength(3);
    });

    it('withholds excluding when the item cannot exclude that person', async () => {
        renderSheet({ people: [person({ items: [item({ excludable: false })] })] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        const menu = await openStateMenu('Ticket lookup', 'No access');

        expect(menu.getByRole('menuitem', { name: /^Grant/ })).toBeInTheDocument();
        expect(menu.getByRole('menuitem', { name: /^Ignore/ })).toBeInTheDocument();
        expect(menu.queryByRole('menuitem', { name: /^Exclude/ })).not.toBeInTheDocument();
    });

    it('keeps ignoring available when the endpoint says the capability is not writable', async () => {
        renderSheet({ people: [person({ items: [item({ canGrant: false })] })] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        const menu = await openStateMenu('Ticket lookup', 'No access');

        expect(menu.getByRole('menuitem', { name: /^Ignore/ })).toBeInTheDocument();
        expect(menu.queryByRole('menuitem', { name: /^Grant/ })).not.toBeInTheDocument();
        expect(menu.queryByRole('menuitem', { name: /^Exclude/ })).not.toBeInTheDocument();
    });

    // One rule for both surfaces: `canGrant` from the endpoint already mirrors the gate the write
    // will hit, so the sheet adds no module check of its own that the Access tab does not make.
    it('offers granting on the Access tab\u2019s own rule, whatever the viewer\u2019s module rights', async () => {
        renderSheet({ people: [person()], role: 'user' });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        const menu = await openStateMenu('Ticket lookup', 'No access');

        expect(menu.getByRole('menuitem', { name: /^Grant/ })).toBeInTheDocument();
        expect(menu.getByRole('menuitem', { name: /^Ignore/ })).toBeInTheDocument();
    });

    it('says why a row has access on the menu that offers to take it away', async () => {
        stubAclRead(OPEN_TO_EVERYONE_ACL);
        renderSheet({ people: [person({ items: [stateItem('tool-1', 'Ticket lookup', 'granted')] })] });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        const menu = await openStateMenu('Ticket lookup', 'Has access');

        expect(await menu.findByText('Has access because this item is open to everyone.')).toBeInTheDocument();
    });

    it('disables a reset that would change nothing and says why instead', async () => {
        stubAclRead(OPEN_TO_EVERYONE_ACL);
        renderSheet({ people: [person({ items: [stateItem('tool-1', 'Ticket lookup', 'granted')] })] });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        const menu = await openStateMenu('Ticket lookup', 'Has access');

        await waitFor(() =>
            expect(menu.getByText('This tool is open to everyone, so there is nothing to remove')).toBeInTheDocument(),
        );
        expect(menu.getByRole('menuitem', { name: /^Reset/ })).toHaveAttribute('aria-disabled', 'true');
        // Excluding still lands on the item's own list, so it is the one verb that would change something.
        expect(menu.getByRole('menuitem', { name: /^Exclude/ })).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('states the row as plain text when the viewer can change nothing, glyph and all', async () => {
        renderSheet({ people: [person()], canGrant: false });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        const row = rowFor('Ticket lookup');

        expect(row.getByText('No access')).toBeInTheDocument();
        expect(row.queryByRole('button')).not.toBeInTheDocument();
        // The glyph carries the state's colour here exactly as it does on an actionable row.
        expect(row.getByText('No access').parentElement?.querySelector('svg.text-destructive')).toBeTruthy();
    });

    it('says the row cannot be ticked because the item refuses the exclusion, not because it is decided', async () => {
        const user = userEvent.setup();

        renderSheet({
            people: [person({ items: [item({ state: 'granted', excludable: false })] })],
        });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');

        await user.hover(rowFor('Ticket lookup').getByRole('checkbox'));

        expect(
            await screen.findByText(
                'Excluding this person from this item would be stored and ignored, so it cannot be changed here.',
            ),
        ).toBeInTheDocument();
    });
});

describe('AccessGapSheet — the writes each action issues', () => {
    /** The same notice the Access tab gives: a removal that succeeds and leaves the row exactly as
     *  it was reads as a broken button unless it says what is still keeping the access. */
    it('says why a reset that landed changed nothing', async () => {
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, {
            adminIds: [],
            includeUserIds: ['user-a'],
            excludeUserIds: [],
            includeSecurityGroupIds: ['group-a'],
            excludeSecurityGroupIds: [],
        });

        renderWithProviders(
            <>
                {sheetElement({
                    people: [
                        person({
                            viaGroups: [{ id: 'group-a', name: 'Engineering' }],
                            items: [stateItem('tool-1', 'Ticket lookup', 'granted')],
                        }),
                    ],
                })}
                <Toaster />
            </>,
            { preloadedState: { user: { ...authenticatedUser, role: 'admin' } } },
        );

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await chooseAction('Ticket lookup', 'Has access', 'Reset');

        expect(
            await screen.findByText(
                'Ada Lovelace still has access to \u201CTicket lookup\u201D because a group still allows it.',
            ),
        ).toBeInTheDocument();
    });

    it('grants one row, adding the inclusion and clearing the exclusion', async () => {
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, EXCLUDED_ACL);
        renderSheet({ people: [person()] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await chooseAction('Ticket lookup', 'No access', 'Grant');

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes).toEqual([
            { itemId: 'tool-1', body: { includeUserIds: ['user-z', 'user-a'], excludeUserIds: [] } },
        ]);
    });

    it('blocks one row, writing the exclusion and dropping the inclusion', async () => {
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, INCLUDED_ACL);
        renderSheet({ people: [person({ items: [stateItem('tool-1', 'Ticket lookup', 'granted')] })] });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await chooseAction('Ticket lookup', 'Has access', 'Exclude');

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes).toEqual([
            { itemId: 'tool-1', body: { includeUserIds: ['user-z'], excludeUserIds: ['user-a'] } },
        ]);
    });

    it('shows a row is working and takes no second click until its write lands', async () => {
        const release = heldToolWrite();

        renderSheet({ people: [person()] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await chooseAction('Ticket lookup', 'No access', 'Grant');

        const trigger = rowFor('Ticket lookup').getByRole('button', { name: /No access/ });

        await waitFor(() => expect(trigger).toBeDisabled());
        expect(within(trigger).getByRole('status')).toBeInTheDocument();

        release();
        await waitFor(() => expect(trigger).toBeEnabled());
    });

    it('ignores one row through the ignore route, touching no ACL', async () => {
        const ignores: { agentId: string; body: unknown }[] = [];
        const aclWrites: CapturedWrite[] = [];

        captureToolWrites(aclWrites, EXCLUDED_ACL);
        captureIgnoreWrites(ignores);
        renderSheet({ people: [person()] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await chooseAction('Ticket lookup', 'No access', 'Ignore');

        await waitFor(() => expect(ignores).toHaveLength(1));
        expect(ignores).toEqual([
            {
                agentId: AGENT_ID,
                body: {
                    capabilityKind: 'tool',
                    capabilityId: 'tool-1',
                    principalKind: 'user',
                    principalId: 'user-a',
                    ignored: true,
                },
            },
        ]);
        expect(aclWrites).toEqual([]);
    });

    it('brings a dismissed row back by sending ignored false', async () => {
        const ignores: { agentId: string; body: unknown }[] = [];

        captureIgnoreWrites(ignores);
        renderSheet({ people: [person({ items: [stateItem('tool-1', 'Ticket lookup', 'ignored')] })] });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await chooseAction('Ticket lookup', 'Ignored', 'Stop ignoring');

        await waitFor(() => expect(ignores).toHaveLength(1));
        expect(ignores[0].body).toMatchObject({ capabilityId: 'tool-1', ignored: false });
    });

    it('clears both halves of the pair on reset', async () => {
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, INCLUDED_ACL);
        renderSheet({ people: [person({ items: [stateItem('tool-1', 'Ticket lookup', 'granted')] })] });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await chooseAction('Ticket lookup', 'Has access', 'Reset');

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes).toEqual([{ itemId: 'tool-1', body: { includeUserIds: ['user-z'], excludeUserIds: [] } }]);
    });

    it('takes a second action while the first write is still in flight', async () => {
        const writes: CapturedWrite[] = [];
        let releaseFirst = () => {};
        const firstLanded = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });

        server.use(
            http.get(apiUrl('/tools/:itemId'), () => envelope(EXCLUDED_ACL)),
            http.put(apiUrl('/tools/:itemId'), async ({ request, params }) => {
                writes.push({ itemId: String(params.itemId), body: await request.json() });

                if (writes.length === 1) await firstLanded;

                return envelope({});
            }),
        );
        renderSheet({
            people: [person({ items: [item(), item({ itemId: 'tool-2', itemName: 'Ticket writer' })] })],
        });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 2 items');
        await chooseAction('Ticket lookup', 'No access', 'Grant');
        await waitFor(() => expect(writes).toHaveLength(1));
        // Nothing locks while a write runs, so the second row answers its click straight away.
        await chooseAction('Ticket writer', 'No access', 'Grant');

        releaseFirst();

        await waitFor(() => expect(writes).toHaveLength(2));
        expect(writes.map((write) => write.itemId)).toEqual(['tool-1', 'tool-2']);
    });
});

describe('AccessGapSheet — selecting people for a bulk grant', () => {
    const twoOpenPeople = () => [person(), person({ id: 'user-c', name: 'Cleo Ward' })];

    it('offers no Grant button until something is selected', () => {
        renderSheet({ people: twoOpenPeople() });

        expect(screen.getByRole('checkbox', { name: 'Select all missing' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Grant/ })).not.toBeInTheDocument();
    });

    it('counts the selection and offers a Grant for it', async () => {
        const user = userEvent.setup();

        renderSheet({ people: twoOpenPeople() });

        await user.click(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' }));

        expect(screen.getByRole('checkbox', { name: '1 selected' })).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'Select Cleo Ward' }));

        expect(screen.getByRole('button', { name: 'Grant all' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: '2 selected' })).toBeInTheDocument();
    });

    it('selects every selectable row from the bar', async () => {
        const user = userEvent.setup();

        renderSheet({ people: twoOpenPeople() });

        await user.click(screen.getByRole('checkbox', { name: 'Select all missing' }));

        expect(screen.getByRole('checkbox', { name: '2 selected' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Grant all' })).toBeInTheDocument();
    });

    it('disables rather than hides the checkbox of a person nothing can be granted for', async () => {
        renderSheet({
            people: [
                platformAdmin(),
                person({ id: 'user-c', name: 'Cleo Ward', items: [stateItem('tool-2', 'Ticket writer', 'revoked')] }),
            ],
        });

        await switchTo('All');

        expect(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: 'Select Cleo Ward' })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: 'Select all missing' })).toBeDisabled();
    });

    it('leaves a person whose only gap is dismissed unselectable', async () => {
        renderSheet({ people: [person({ items: [stateItem('tool-4', 'Ticket mover', 'ignored')] })] });

        await switchTo('All');

        expect(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: 'Select all missing' })).toBeDisabled();
    });

    // The tab's bargain, now the sheet's too: no ask, because every write is undoable from the row
    // it lands on and the toast that follows says what happened.
    // Nothing paints before the server answers, so the control that started the write is the only
    // thing that can say it is working — and it must not take a second click while it is.
    it('shows the grant is running and disables it until the batch settles', async () => {
        const user = userEvent.setup();

        const release = heldToolWrite();

        renderSheet({ people: twoOpenPeople() });

        await user.click(screen.getByRole('checkbox', { name: 'Select all missing' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        const granting = await screen.findByRole('button', { name: /Grant all/ });

        await waitFor(() => expect(granting).toBeDisabled());
        expect(within(granting).getByRole('status')).toBeInTheDocument();

        release();
        // The batch landed cleanly, so the ticks it acted on clear and the verb goes with them.
        await waitFor(() => expect(screen.queryByRole('button', { name: /Grant all/ })).not.toBeInTheDocument());
    });

    // Nothing disables a person's tick while a batch runs, so one added meanwhile is the admin's
    // own pending work — clearing it would say they were granted when they were never sent.
    it('keeps a tick added while a batch was in flight', async () => {
        const user = userEvent.setup();
        const release = heldToolWrite();

        renderSheet({ people: twoOpenPeople() });

        await user.click(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));
        await user.click(screen.getByRole('checkbox', { name: 'Select Cleo Ward' }));

        release();

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' })).not.toBeChecked());
        expect(screen.getByRole('checkbox', { name: 'Select Cleo Ward' })).toBeChecked();
    });

    it('grants without asking first', async () => {
        const user = userEvent.setup();
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, EXCLUDED_ACL);
        renderSheet({ people: twoOpenPeople() });

        await user.click(screen.getByRole('checkbox', { name: 'Select all missing' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('grants every chosen person in one write per capability', async () => {
        const user = userEvent.setup();
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, EXCLUDED_ACL);
        renderSheet({ people: twoOpenPeople() });

        await user.click(screen.getByRole('checkbox', { name: 'Select all missing' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes).toEqual([
            { itemId: 'tool-1', body: { includeUserIds: ['user-z', 'user-a', 'user-c'], excludeUserIds: [] } },
        ]);
    });

    it('keeps the selection when every write of a bulk grant failed', async () => {
        const user = userEvent.setup();
        const writes: CapturedWrite[] = [];

        failToolWrites(writes);
        renderSheet({ people: [person()] });

        await user.click(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' })).toBeChecked();
        expect(screen.getByRole('button', { name: 'Grant all' })).toBeInTheDocument();
    });

    it('grants group members from the group detail level too', async () => {
        const user = userEvent.setup();
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, EXCLUDED_ACL);
        renderSheet({
            principalKind: 'securityGroup',
            groups: [group({ memberIds: ['user-a'] })],
            people: [person(), person({ id: 'user-c', name: 'Cleo Ward' })],
        });

        await openRow('Engineering');
        await user.click(screen.getByRole('checkbox', { name: 'Select all missing' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes).toEqual([
            { itemId: 'tool-1', body: { includeUserIds: ['user-z', 'user-a'], excludeUserIds: [] } },
        ]);
    });
});

describe('AccessGapSheet — selecting capabilities for a bulk grant', () => {
    it('offers a checkbox on every row that has a verb, whatever its state', async () => {
        renderSheet({
            people: [
                person({
                    items: [
                        item(),
                        stateItem('tool-2', 'Ticket writer', 'granted'),
                        stateItem('tool-3', 'Ticket closer', 'revoked'),
                        stateItem('tool-4', 'Ticket mover', 'ignored'),
                    ],
                }),
            ],
        });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 4 items');

        expect(screen.getByRole('checkbox', { name: 'Select Ticket lookup' })).toBeEnabled();
        expect(screen.getByRole('checkbox', { name: 'Select Ticket writer' })).toBeEnabled();
        expect(screen.getByRole('checkbox', { name: 'Select Ticket closer' })).toBeEnabled();
        expect(screen.getByRole('checkbox', { name: 'Select Ticket mover' })).toBeEnabled();
    });

    it('leaves only the granted row whose exclusion would be ignored unselectable', async () => {
        renderSheet({
            people: [
                person({
                    items: [item(), { ...stateItem('tool-2', 'Ticket writer', 'granted'), excludable: false }],
                }),
            ],
        });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 2 items');

        expect(screen.getByRole('checkbox', { name: 'Select Ticket lookup' })).toBeEnabled();
        expect(screen.getByRole('checkbox', { name: 'Select Ticket writer' })).toBeDisabled();
    });

    it('offers each verb the ticked rows have a use for', async () => {
        const user = userEvent.setup();

        renderSheet({
            people: [
                person({
                    items: [
                        item(),
                        stateItem('tool-2', 'Ticket writer', 'granted'),
                        stateItem('tool-3', 'Ticket closer', 'revoked'),
                        stateItem('tool-4', 'Ticket mover', 'ignored'),
                    ],
                }),
            ],
        });

        await switchTo('All');
        await openRow('Ada Lovelace');
        await openGroup('Tools, 4 items');
        await user.click(screen.getByRole('checkbox', { name: 'Select all Tools' }));

        expect(screen.getByText('4 selected')).toBeInTheDocument();
        ['Grant all', 'Exclude all', 'Ignore all', 'Reset all'].forEach((label) =>
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument(),
        );
    });

    // One toast for the batch, naming the person and how much of theirs moved — there is no
    // confirmation to read it off any more, and nothing repaints before the server answers.
    it('names the person and the count in the toast a batch leaves behind', async () => {
        const user = userEvent.setup();
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, EXCLUDED_ACL);
        renderWithToasts({
            people: [person({ items: [item(), item({ itemId: 'tool-2', itemName: 'Ticket writer' })] })],
        });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 2 items');
        await user.click(screen.getByRole('checkbox', { name: 'Select all Tools' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        expect(await screen.findByText('Granted Ada Lovelace access to 2 items.')).toBeInTheDocument();
    });

    it('keeps each group\u2019s selection to itself', async () => {
        const user = userEvent.setup();

        renderSheet({
            people: [
                person({
                    items: [item(), item({ itemId: 'skill-1', itemName: 'Ticket triage', itemKind: 'skill' })],
                }),
            ],
        });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 1 item');
        await openGroup('Skills, 1 item');
        await user.click(screen.getByRole('checkbox', { name: 'Select all Tools' }));

        expect(screen.getByRole('checkbox', { name: 'Select Ticket lookup' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Select Ticket triage' })).not.toBeChecked();
        expect(screen.getAllByRole('button', { name: 'Grant all' })).toHaveLength(1);
    });

    it('offers Ignore alongside Grant for a selection of gaps, and dismisses them in one go', async () => {
        const user = userEvent.setup();
        const ignores: string[] = [];

        server.use(
            http.put(apiUrl('/agents/:agentId/access-ignores'), async ({ request }) => {
                const body = (await request.json()) as { capabilityId: string };

                ignores.push(body.capabilityId);

                return envelope({});
            }),
        );

        renderSheet({ people: [person({ items: [item(), item({ itemId: 'tool-2', itemName: 'Ticket writer' })] })] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 2 items');
        await user.click(screen.getByRole('checkbox', { name: 'Select all Tools' }));
        await user.click(screen.getByRole('button', { name: 'Ignore all' }));

        await waitFor(() => expect(ignores).toEqual(['tool-1', 'tool-2']));
    });

    // Two groups can be in flight at once, and one settling must not re-arm the other's buttons or
    // steal its spinner.
    it('shows which group\u2019s batch is running and locks that group alone', async () => {
        const user = userEvent.setup();
        const release = heldToolWrite();

        renderSheet({
            people: [
                person({
                    items: [item(), item({ itemId: 'skill-1', itemName: 'Ticket triage', itemKind: 'skill' })],
                }),
            ],
        });

        await openRow('Ada Lovelace');
        await user.click(screen.getByRole('checkbox', { name: 'Select all Tools' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        const granting = screen.getByRole('button', { name: /Grant all/ });

        await waitFor(() => expect(granting).toBeDisabled());
        expect(within(granting).getByRole('status')).toBeInTheDocument();
        // The other group never started a batch, so its own verbs are untouched.
        expect(screen.getByRole('button', { name: 'Ignore all' })).toBeDisabled();

        await user.click(screen.getByRole('checkbox', { name: 'Select all Skills' }));

        const skillVerbs = screen.getAllByRole('button', { name: 'Ignore all' });

        expect(skillVerbs[skillVerbs.length - 1]).toBeEnabled();

        release();
        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });

    it('writes one ACL per chosen capability on confirm', async () => {
        const user = userEvent.setup();
        const writes: CapturedWrite[] = [];

        captureToolWrites(writes, EXCLUDED_ACL);
        renderSheet({ people: [person({ items: [item(), item({ itemId: 'tool-2', itemName: 'Ticket writer' })] })] });

        await openRow('Ada Lovelace');
        await openGroup('Tools, 2 items');
        await user.click(screen.getByRole('checkbox', { name: 'Select Ticket writer' }));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        await waitFor(() => expect(writes).toHaveLength(1));
        expect(writes).toEqual([
            { itemId: 'tool-2', body: { includeUserIds: ['user-z', 'user-a'], excludeUserIds: [] } },
        ]);
    });
});

describe('AccessGapSheet — closing', () => {
    it('resets to the list level so the next open does not resume mid-drill', async () => {
        const onClose = vi.fn();
        const { rerender } = renderSheet({ people: [person()], onClose });

        await openRow('Ada Lovelace');

        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Close side sheet' }));

        expect(onClose).toHaveBeenCalledTimes(1);

        rerender(sheetElement({ people: [person()], onClose }));

        expect(screen.getByText('Included users')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });
});

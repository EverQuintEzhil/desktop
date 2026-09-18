import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, server } from '@/test/msw';
import { renderWithProviders, screen, within } from '@/test/test-utils';

import type { AccessItem, AccessUser } from '../access-types';
import type { AccessWrites } from '../use-access-writes';

import AccessGapBreakdown from './access-gap-breakdown';

const toolItem = (overrides: Partial<AccessItem> = {}): AccessItem => ({
    id: 'tool-a',
    name: 'Ticket lookup',
    kind: 'tool',
    state: 'not-included',
    ...overrides,
});

const userWith = (items: AccessItem[]): AccessUser => ({
    id: 'user-1',
    name: 'Ada Lovelace',
    viaGroups: [],
    items,
});

/** The lists as the api serves them: a second name on the include list is what makes a reset a
 *  write with something to remove, so the entry is not disabled for a reason of its own. */
const ACL = {
    _id: 'tool-a',
    adminIds: [],
    includeUserIds: ['user-1', 'user-2'],
    excludeUserIds: [],
    includeSecurityGroupIds: [],
    excludeSecurityGroupIds: [],
};

/** Only the members a test asserts on carry behaviour; the rest exist so the panel can be rendered. */
const stubWrites = (overrides: Partial<AccessWrites> = {}): AccessWrites => {
    const nothing = vi.fn(() => Promise.resolve(true));
    const noIds = vi.fn(() => Promise.resolve<string[]>([]));

    return {
        grantItem: nothing,
        unblockItem: nothing,
        revokeItem: nothing,
        resetItem: nothing,
        setIgnore: nothing,
        grantItems: noIds,
        revokeItems: noIds,
        ignoreItems: noIds,
        resetItems: noIds,
        revokeUser: nothing,
        excludeUser: nothing,
        grantMissing: noIds,
        ignoreMissing: noIds,
        excludeUsers: nothing,
        includeUsers: nothing,
        ...overrides,
    } as AccessWrites;
};

const renderBreakdown = (items: AccessItem[], writes: AccessWrites = stubWrites()) =>
    renderWithProviders(
        <AccessGapBreakdown user={userWith(items)} ignored={new Set()} ignoresStatus="ready" canEdit writes={writes} />,
    );

const checkboxFor = (name: string) => screen.getByRole('checkbox', { name: `Select ${name}` });

describe('AccessGapBreakdown', () => {
    it('keeps the dropdown on a covered row the item refuses to exclude, so Reset stays reachable', async () => {
        server.use(http.get(apiUrl('/tools/tool-a'), () => envelope(ACL)));

        const user = userEvent.setup();

        renderBreakdown([toolItem({ state: 'covered', excludable: false })]);

        // A settled kind opens shut: the row is only there once its section is expanded.
        await user.click(screen.getByRole('button', { name: /^Tools/ }));
        await user.click(screen.getByRole('button', { name: /Has access/ }));

        const menu = within(await screen.findByRole('menu'));

        expect(menu.getByRole('menuitem', { name: /^Reset/ })).toBeEnabled();
        expect(menu.getByRole('menuitem', { name: /^Exclude/ })).toHaveAttribute('data-disabled');
        expect(
            await menu.findByText(
                'Excluding this person from this item would be stored and ignored, so it cannot be changed here.',
            ),
        ).toBeInTheDocument();
    });

    // Nothing paints before the server answers, so the control that started the write is the only
    // thing that can say it is working — and it must not take a second click while it is.
    it('shows the row is working and refuses a second click until the write lands', async () => {
        server.use(http.get(apiUrl('/tools/tool-a'), () => envelope(ACL)));

        const user = userEvent.setup();
        const held = new Promise<boolean>(() => {});

        renderBreakdown([toolItem()], stubWrites({ grantItem: vi.fn(() => held) }));

        await user.click(screen.getByRole('button', { name: /No access/ }));
        await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /^Grant/ }));

        const trigger = screen.getByRole('button', { name: /No access/ });

        expect(within(trigger).getByRole('status')).toBeInTheDocument();
        expect(trigger).toBeDisabled();
    });

    it('shows which bulk verb is running and disables the rest of its section', async () => {
        const user = userEvent.setup();
        const held = new Promise<string[]>(() => {});
        const items = [toolItem(), toolItem({ id: 'tool-b', name: 'Ticket writer' })];

        renderBreakdown(items, stubWrites({ grantItems: vi.fn(() => held) }));

        await user.click(checkboxFor('Ticket lookup'));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        const granting = screen.getByRole('button', { name: /Grant all/ });

        expect(within(granting).getByRole('status')).toBeInTheDocument();
        expect(granting).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Ignore all' })).toBeDisabled();
    });

    // Two sections can be in flight at once, and one settling must not re-arm the other's buttons
    // or steal its spinner.
    it('keeps each section\u2019s in-flight state to itself', async () => {
        const user = userEvent.setup();
        const held = new Promise<string[]>(() => {});
        const items = [toolItem(), toolItem({ id: 'skill-a', name: 'Ticket triage', kind: 'skill' })];

        renderBreakdown(items, stubWrites({ grantItems: vi.fn(() => held), ignoreItems: vi.fn(() => held) }));

        await user.click(checkboxFor('Ticket lookup'));
        await user.click(checkboxFor('Ticket triage'));

        const [toolsGrant, skillsGrant] = screen.getAllByRole('button', { name: 'Grant all' });

        await user.click(toolsGrant);
        await user.click(skillsGrant);

        const [tools, skills] = screen.getAllByRole('button', { name: /Grant all/ });

        expect(within(tools).getByRole('status')).toBeInTheDocument();
        expect(within(skills).getByRole('status')).toBeInTheDocument();
        screen.getAllByRole('button', { name: 'Ignore all' }).forEach((button) => expect(button).toBeDisabled());
    });

    it('keeps the items a partial failure refused ticked, and unticks only the ones that landed', async () => {
        const user = userEvent.setup();
        const items = [toolItem(), toolItem({ id: 'tool-b', name: 'Ticket writer' })];

        renderBreakdown(items, stubWrites({ grantItems: vi.fn(() => Promise.resolve(['tool-b'])) }));

        await user.click(checkboxFor('Ticket lookup'));
        await user.click(checkboxFor('Ticket writer'));
        await user.click(screen.getByRole('button', { name: 'Grant all' }));

        expect(checkboxFor('Ticket writer')).toBeChecked();
        expect(checkboxFor('Ticket lookup')).not.toBeChecked();
    });
});

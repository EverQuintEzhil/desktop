import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';
import { renderWithProviders } from '@/test/test-utils';
import type { McpType, SkillType, ToolType } from '@/types/admin';

import type { DisabledAgentSkill } from '../../types';

import { CHIP_GEOMETRY_CLASSES, CHIP_ICON_CLASSES, CHIP_SURFACE_CLASSES, ROW_LABEL_ICON_CLASSES } from './constants';
import RecommendedCapabilitiesBanner from './recommended-capabilities-banner';
import type { CapabilitySources } from './utils/get-no-access-capabilities';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

const HOUR_MS = 60 * 60 * 1000;

const makeMcp = (overrides: Partial<McpType> & Pick<McpType, '_id' | 'name'>): McpType =>
    ({
        description: '',
        serverUrl: 'https://mcp.example.com',
        resourceMetadataUrl: '',
        isRecommended: true,
        authType: 'oauth',
        authCredentials: {},
        isDev: false,
        requireApproval: false,
        timeout: 30,
        retryAttempts: 1,
        sslVerify: true,
        headers: null,
        transport: 'http',
        command: null,
        args: null,
        env: null,
        version: '1',
        capabilities: null,
        status: 'active',
        includeUsers: [],
        includeSecurityGroups: [],
        excludeUsers: [],
        excludeSecurityGroups: [],
        connection: null,
        ...overrides,
    }) as McpType;

const makeSkill = (_id: string, name: string, noAccess?: boolean): SkillType =>
    (noAccess === undefined ? { _id, name } : { _id, name, noAccess }) as SkillType;

const makeTool = (_id: string, name: string, noAccess?: boolean): ToolType =>
    (noAccess === undefined ? { _id, name } : { _id, name, noAccess }) as ToolType;

interface HarnessOptions {
    mcpServers?: McpType[];
    disabledMap?: Record<string, boolean>;
    connectingId?: string | null;
    enablingId?: string | null;
    onConnect?: (mcpServerId: string) => Promise<boolean>;
    onEnable?: (mcpServerId: string) => Promise<boolean>;
    disabledSkills?: DisabledAgentSkill[];
    onEnableSkill?: (skillId: string) => Promise<boolean>;
    agentId?: string;
    capabilities?: CapabilitySources;
}

const bannerElement = ({
    mcpServers = [],
    disabledMap = {},
    connectingId = null,
    enablingId = null,
    onConnect = () => Promise.resolve(true),
    onEnable = () => Promise.resolve(true),
    disabledSkills = [],
    onEnableSkill = () => Promise.resolve(true),
    agentId = 'agent-1',
    capabilities = undefined,
}: HarnessOptions) => (
    <RecommendedCapabilitiesBanner
        agentId={agentId}
        mcpServers={mcpServers}
        disabledMap={disabledMap}
        connectingId={connectingId}
        enablingId={enablingId}
        onConnect={onConnect}
        onEnable={onEnable}
        disabledSkills={disabledSkills}
        onEnableSkill={onEnableSkill}
        capabilities={capabilities}
    />
);

const renderBanner = (options: HarnessOptions) => renderWithProviders(bannerElement(options));

const renderBannerElement = (disabledSkills: DisabledAgentSkill[]) => bannerElement({ disabledSkills });

const stubImmediateResizeObserver = () => {
    const original = globalThis.ResizeObserver;

    class ImmediateResizeObserver {
        callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
            this.callback = callback;
        }

        observe() {
            this.callback([], this as unknown as ResizeObserver);
        }

        unobserve() {}

        disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);

    return () => vi.stubGlobal('ResizeObserver', original);
};

describe('RecommendedCapabilitiesBanner', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('lists every recommended connector that is not usable yet', () => {
        renderBanner({
            mcpServers: [
                makeMcp({ _id: 'needs-connect', name: 'Microsoft 365' }),
                makeMcp({ _id: 'switched-off', name: 'Firecrawl', authType: 'api-key' }),
                makeMcp({
                    _id: 'admin-off',
                    name: 'Shell',
                    authType: 'api-key',
                    status: 'inactive',
                }),
                makeMcp({
                    _id: 'connected',
                    name: 'Notion',
                    connection: { status: 'connected', tokenExpiry: new Date(Date.now() + HOUR_MS).toISOString() },
                }),
                makeMcp({ _id: 'ready-non-oauth', name: 'Slack', authType: 'api-key' }),
                makeMcp({ _id: 'not-recommended', name: 'Linear', isRecommended: false }),
            ],
            disabledMap: { 'switched-off': true },
        });

        const banner = within(screen.getByRole('group', { name: /recommended connectors and skills/i }));

        expect(banner.getByRole('button', { name: /connect microsoft 365/i })).toBeInTheDocument();
        expect(banner.getByRole('button', { name: /enable firecrawl/i })).toBeInTheDocument();
        expect(banner.queryByText('Shell')).not.toBeInTheDocument();
        expect(banner.queryByText('Notion')).not.toBeInTheDocument();
        expect(banner.queryByText('Slack')).not.toBeInTheDocument();
        expect(banner.queryByText('Linear')).not.toBeInTheDocument();
    });

    it('names the action on the chip itself, not only in its label', () => {
        renderBanner({
            mcpServers: [
                makeMcp({ _id: 'needs-connect', name: 'Miro' }),
                makeMcp({ _id: 'switched-off', name: 'Firecrawl', authType: 'api-key' }),
            ],
            disabledMap: { 'switched-off': true },
        });

        const banner = within(screen.getByRole('group', { name: /recommended connectors and skills/i }));

        expect(banner.getByText('Connect Miro')).toBeInTheDocument();
        expect(banner.getByText('Enable Firecrawl')).toBeInTheDocument();
    });

    it('keeps the visible banner text fixed whatever needs attention', () => {
        const { rerender } = renderBanner({ mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })] });

        expect(screen.getAllByText('Recommended')).not.toHaveLength(0);

        rerender(bannerElement({ disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: true }] }));

        expect(screen.getAllByText('Recommended')).not.toHaveLength(0);
        expect(screen.queryByText('Recommended skills')).not.toBeInTheDocument();
    });

    it('explains what the banner is asking for from the warning icon itself', () => {
        renderBanner({ mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })] });

        const hint = within(screen.getByRole('group', { name: /recommended connectors and skills/i })).getByRole(
            'button',
            { name: 'This agent uses these. Turn them on to use them in this chat.' },
        );

        expect(hint).toBeInTheDocument();
        expect(hint).not.toBeDisabled();
    });

    it('says nothing about a connector an admin has deactivated', () => {
        const { container } = renderBanner({
            mcpServers: [makeMcp({ _id: 'admin-off', name: 'Shell', status: 'inactive' })],
        });

        expect(container).toBeEmptyDOMElement();
    });

    it('enables a switched-off connector without toggling it back off', async () => {
        const user = userEvent.setup();
        const onEnable = vi.fn(() => Promise.resolve(true));

        renderBanner({
            mcpServers: [makeMcp({ _id: 'firecrawl', name: 'Firecrawl', authType: 'api-key' })],
            disabledMap: { firecrawl: true },
            onEnable,
        });

        await user.click(screen.getByRole('button', { name: /enable firecrawl/i }));

        expect(onEnable).toHaveBeenCalledExactlyOnceWith('firecrawl');
    });

    it('shows a busy chip while the connector is being enabled', () => {
        renderBanner({
            mcpServers: [makeMcp({ _id: 'firecrawl', name: 'Firecrawl', authType: 'api-key' })],
            disabledMap: { firecrawl: true },
            enablingId: 'firecrawl',
        });

        expect(screen.getByRole('button', { name: /enabling firecrawl/i })).toBeDisabled();
    });

    it('marks the chip as failed when enabling could not be saved', async () => {
        const user = userEvent.setup();

        renderBanner({
            mcpServers: [makeMcp({ _id: 'firecrawl', name: 'Firecrawl', authType: 'api-key' })],
            disabledMap: { firecrawl: true },
            onEnable: () => Promise.resolve(false),
        });

        await user.click(screen.getByRole('button', { name: /enable firecrawl/i }));

        expect(await screen.findByRole('button', { name: /retry enabling firecrawl/i })).toBeInTheDocument();
    });

    it('offers a reconnect action when the token has expired', () => {
        renderBanner({
            mcpServers: [
                makeMcp({
                    _id: 'expired',
                    name: 'Microsoft 365',
                    connection: { status: 'connected', tokenExpiry: new Date(Date.now() - HOUR_MS).toISOString() },
                }),
            ],
        });

        expect(screen.getByRole('button', { name: /reconnect microsoft 365/i })).toBeInTheDocument();
    });

    it('asks to switch a connector back on before asking to connect it', () => {
        renderBanner({
            mcpServers: [makeMcp({ _id: 'off', name: 'Microsoft 365' })],
            disabledMap: { off: true },
        });

        expect(screen.getByRole('button', { name: /enable microsoft 365/i })).toBeInTheDocument();
    });

    it('connects the connector that was clicked', async () => {
        const user = userEvent.setup();
        const onConnect = vi.fn(() => Promise.resolve(true));

        renderBanner({
            mcpServers: [
                makeMcp({ _id: 'microsoft', name: 'Microsoft 365' }),
                makeMcp({ _id: 'firecrawl', name: 'Firecrawl' }),
            ],
            onConnect,
        });

        await user.click(screen.getByRole('button', { name: /connect firecrawl/i }));

        expect(onConnect).toHaveBeenCalledExactlyOnceWith('firecrawl');
    });

    it('shows a busy chip while the connection is starting', () => {
        renderBanner({
            mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
            connectingId: 'microsoft',
        });

        const chip = screen.getByRole('button', { name: /connecting to microsoft 365/i });

        expect(chip).toBeDisabled();
        expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    });

    it('marks the chip as failed and allows a retry when the connection cannot start', async () => {
        const user = userEvent.setup();
        const onConnect = vi.fn(() => Promise.resolve(false));

        renderBanner({
            mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
            onConnect,
        });

        await user.click(screen.getByRole('button', { name: /connect microsoft 365/i }));

        const retry = await screen.findByRole('button', { name: /retry connecting to microsoft 365/i });

        await user.click(retry);

        await waitFor(() => expect(onConnect).toHaveBeenCalledTimes(2));
    });

    it('offers to switch on an attached skill that is off in this chat', () => {
        renderBanner({
            disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: true }],
        });

        expect(screen.getByRole('button', { name: /enable brand voice/i })).toBeInTheDocument();
    });

    it('lists connector and skill chips in one row', () => {
        renderBanner({
            mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
            disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: true }],
        });

        const banner = within(screen.getByRole('group', { name: /recommended connectors and skills/i }));

        expect(banner.getByRole('button', { name: /connect microsoft 365/i })).toBeInTheDocument();
        expect(banner.getByRole('button', { name: /enable brand voice/i })).toBeInTheDocument();
    });

    it('groups connector chips before skill chips', () => {
        renderBanner({
            mcpServers: [
                makeMcp({ _id: 'microsoft', name: 'Microsoft 365' }),
                makeMcp({ _id: 'firecrawl', name: 'Firecrawl', authType: 'api-key' }),
            ],
            disabledMap: { firecrawl: true },
            disabledSkills: [
                { _id: 'skill-1', name: 'Brand voice', isRecommended: true },
                { _id: 'skill-2', name: 'Cost model', isRecommended: true },
            ],
        });

        const labels = within(screen.getByRole('group', { name: /recommended connectors and skills/i }))
            .getAllByRole('button')
            .map((button) => button.getAttribute('aria-label'));

        expect(labels).toEqual([
            'This agent uses these. Turn them on to use them in this chat.',
            'Connect Microsoft 365',
            'Enable Firecrawl',
            'Enable Brand voice',
            'Enable Cost model',
            'Dismiss recommendations',
        ]);
    });

    it('switches on the skill that was clicked', async () => {
        const user = userEvent.setup();
        const onEnableSkill = vi.fn(() => Promise.resolve(true));

        renderBanner({
            disabledSkills: [
                { _id: 'skill-1', name: 'Brand voice', isRecommended: true },
                { _id: 'skill-2', name: 'Cost model', isRecommended: true },
            ],
            onEnableSkill,
        });

        await user.click(screen.getByRole('button', { name: /enable cost model/i }));

        expect(onEnableSkill).toHaveBeenCalledExactlyOnceWith('skill-2');
    });

    it('shows a busy skill chip and ignores a second click while the write is in flight', async () => {
        const user = userEvent.setup();
        let settle: (isEnabled: boolean) => void = () => {};
        const onEnableSkill = vi.fn(
            () =>
                new Promise<boolean>((resolve) => {
                    settle = resolve;
                }),
        );

        renderBanner({
            disabledSkills: [{ _id: 'skill-a', name: 'Brand voice', isRecommended: true }],
            onEnableSkill,
        });

        await user.click(screen.getByRole('button', { name: 'Enable Brand voice' }));

        const pendingChip = await screen.findByRole('button', { name: 'Enabling Brand voice' });

        expect(pendingChip).toBeDisabled();

        await user.click(pendingChip);

        expect(onEnableSkill).toHaveBeenCalledExactlyOnceWith('skill-a');

        settle(true);

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Brand voice enabled for this chat'));
    });

    it('marks the skill chip as failed when the preference could not be saved', async () => {
        const user = userEvent.setup();

        renderBanner({
            disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: true }],
            onEnableSkill: () => Promise.resolve(false),
        });

        await user.click(screen.getByRole('button', { name: /enable brand voice/i }));

        expect(await screen.findByRole('button', { name: /retry enabling brand voice/i })).toBeInTheDocument();
    });

    it('renders nothing when no connector and no skill needs attention', () => {
        const { container } = renderBanner({
            mcpServers: [
                makeMcp({ _id: 'connected', name: 'Notion', connection: { status: 'connected', tokenExpiry: null } }),
            ],
            disabledSkills: [],
        });

        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when every recommended connector is usable', () => {
        const { container } = renderBanner({
            mcpServers: [
                makeMcp({ _id: 'connected', name: 'Notion', connection: { status: 'connected', tokenExpiry: null } }),
            ],
        });

        expect(container).toBeEmptyDOMElement();
    });
    it('hides the banner once it is dismissed', async () => {
        const user = userEvent.setup();

        const { container } = renderBanner({
            mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
        });

        await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

        expect(container).toBeEmptyDOMElement();
    });

    it('shows the banner again for another agent', async () => {
        const user = userEvent.setup();
        const mcpServers = [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })];
        const { rerender } = renderBanner({ mcpServers, agentId: 'agent-1' });

        await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

        expect(screen.queryByRole('group', { name: /recommended connectors and skills/i })).not.toBeInTheDocument();

        rerender(bannerElement({ mcpServers, agentId: 'agent-2' }));

        expect(screen.getByRole('group', { name: /recommended connectors and skills/i })).toBeInTheDocument();
    });

    it('stays dismissed across a remount while the item set is unchanged', async () => {
        const user = userEvent.setup();
        const mcpServers = [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })];
        const { unmount } = renderBanner({ mcpServers });

        await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));
        unmount();

        const { container } = renderBanner({ mcpServers });

        expect(container).toBeEmptyDOMElement();
    });

    it('never reopens the overflow dialog on its own after the list empties and refills', async () => {
        const user = userEvent.setup();
        const restoreResizeObserver = stubImmediateResizeObserver();
        const skills: DisabledAgentSkill[] = [
            { _id: 'skill-1', name: 'Brand voice', isRecommended: true },
            { _id: 'skill-2', name: 'Cost model', isRecommended: true },
        ];

        try {
            const { rerender } = renderBanner({ disabledSkills: skills });

            await user.click(screen.getByRole('button', { name: /show 2 more/i }));
            expect(await screen.findByRole('dialog')).toBeInTheDocument();

            rerender(renderBannerElement([]));
            rerender(renderBannerElement(skills));

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        } finally {
            restoreResizeObserver();
        }
    });

    describe('no-access row', () => {
        const NO_ACCESS_GROUP = /capabilities you have no access to/i;
        const ACTION_GROUP = /recommended connectors and skills/i;

        it('lists every capability the viewer has no access to, across all five collections', () => {
            renderBanner({
                capabilities: {
                    mcpServers: [makeMcp({ _id: 'mcp-1', name: 'Salesforce', noAccess: true })],
                    skills: [makeSkill('skill-1', 'Brand voice', true)],
                    dataStores: [{ _id: 'ds-1', name: 'Fee guide', noAccess: true }] as CapabilitySources['dataStores'],
                    tools: [makeTool('tool-1', 'Cost lookup', true)],
                    agents: [{ _id: 'agent-1', name: 'Reviewer', noAccess: true }] as CapabilitySources['agents'],
                },
            });

            const row = within(screen.getByRole('group', { name: NO_ACCESS_GROUP }));

            expect(row.getByText('Salesforce')).toBeInTheDocument();
            expect(row.getByText('Brand voice')).toBeInTheDocument();
            expect(row.getByText('Fee guide')).toBeInTheDocument();
            expect(row.getByText('Cost lookup')).toBeInTheDocument();
            expect(row.getByText('Reviewer')).toBeInTheDocument();
        });

        it('leaves out items that are usable', () => {
            renderBanner({
                capabilities: {
                    skills: [makeSkill('skill-1', 'Brand voice', true), makeSkill('skill-2', 'Cost model', false)],
                    tools: [makeTool('tool-1', 'Cost lookup', false)],
                },
            });

            const row = within(screen.getByRole('group', { name: NO_ACCESS_GROUP }));

            expect(row.getByText('Brand voice')).toBeInTheDocument();
            expect(row.queryByText('Cost model')).not.toBeInTheDocument();
            expect(row.queryByText('Cost lookup')).not.toBeInTheDocument();
        });

        it('renders the no-access items as inert chips rather than buttons', () => {
            renderBanner({ capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] } });

            const row = within(screen.getByRole('group', { name: NO_ACCESS_GROUP }));

            expect(row.queryByRole('button', { name: /brand voice/i })).not.toBeInTheDocument();
            expect(row.getByText('Brand voice').closest('button')).toBeNull();
        });

        it('does nothing when a no-access chip is clicked', async () => {
            const user = userEvent.setup();
            const enabledIds: string[] = [];
            const onEnableSkill = vi.fn((skillId: string) => {
                enabledIds.push(skillId);

                return Promise.resolve(true);
            });
            const onEnable = vi.fn(() => Promise.resolve(true));
            const onConnect = vi.fn(() => Promise.resolve(true));

            renderBanner({
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
                onEnableSkill,
                onEnable,
                onConnect,
            });

            const row = within(screen.getByRole('group', { name: NO_ACCESS_GROUP }));

            await user.click(row.getByText('Brand voice'));

            expect(onEnableSkill).not.toHaveBeenCalled();
            expect(onEnable).not.toHaveBeenCalled();
            expect(onConnect).not.toHaveBeenCalled();
            expect(row.getByText('Brand voice')).toBeInTheDocument();
        });

        it('tells the viewer what to do about it from the row label', () => {
            renderBanner({ capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] } });

            const row = within(screen.getByRole('group', { name: NO_ACCESS_GROUP }));

            expect(row.getByText('No access')).toBeInTheDocument();
            expect(row.getByRole('button', { name: 'No access — ask an admin to grant it.' })).toBeInTheDocument();
        });

        it('renders no second row while nothing is flagged as no access', () => {
            renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: {
                    skills: [makeSkill('skill-1', 'Brand voice', false)],
                    tools: [makeTool('tool-1', 'Cost lookup', false)],
                },
            });

            expect(screen.getByRole('group', { name: /recommended connectors and skills/i })).toBeInTheDocument();
            expect(screen.queryByRole('group', { name: NO_ACCESS_GROUP })).not.toBeInTheDocument();
        });

        it('renders nothing at all when the payload has no noAccess field yet', () => {
            const { container } = renderBanner({
                capabilities: {
                    skills: [makeSkill('skill-1', 'Brand voice', false)],
                    mcpServers: [
                        makeMcp({
                            _id: 'connected',
                            name: 'Notion',
                            connection: { status: 'connected', tokenExpiry: null },
                        }),
                    ],
                },
            });

            expect(container).toBeEmptyDOMElement();
        });

        it('renders when only the no-access row has content', () => {
            renderBanner({ capabilities: { tools: [makeTool('tool-1', 'Cost lookup', true)] } });

            expect(screen.getByRole('group', { name: NO_ACCESS_GROUP })).toBeInTheDocument();
            expect(screen.queryByRole('group', { name: /recommended connectors and skills/i })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Dismiss no access' })).toBeInTheDocument();
        });

        it('rounds only the topmost row: the no-access row when both are present', () => {
            renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            expect(screen.getByRole('group', { name: NO_ACCESS_GROUP })).toHaveClass(
                'recommended-capabilities-row-first',
            );
            expect(screen.getByRole('group', { name: ACTION_GROUP })).not.toHaveClass(
                'recommended-capabilities-row-first',
            );
        });

        it('rounds the actionable row when it is alone', () => {
            renderBanner({ mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })] });

            expect(screen.getByRole('group', { name: ACTION_GROUP })).toHaveClass('recommended-capabilities-row-first');
        });

        it('keeps the actionable row when only the no-access row is dismissed', async () => {
            const user = userEvent.setup();

            renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));

            expect(screen.queryByRole('group', { name: NO_ACCESS_GROUP })).not.toBeInTheDocument();
            expect(screen.getByRole('group', { name: ACTION_GROUP })).toBeInTheDocument();
        });

        it('keeps the no-access row when only the actionable row is dismissed', async () => {
            const user = userEvent.setup();

            renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            expect(screen.queryByRole('group', { name: ACTION_GROUP })).not.toBeInTheDocument();
            expect(screen.getByRole('group', { name: NO_ACCESS_GROUP })).toBeInTheDocument();
        });

        it('hides the banner only once both rows are dismissed', async () => {
            const user = userEvent.setup();

            const { container } = renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));
            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            expect(container).toBeEmptyDOMElement();
        });

        it('moves the top rounding to the actionable row once the no-access row is dismissed', async () => {
            const user = userEvent.setup();

            renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            expect(screen.getByRole('group', { name: ACTION_GROUP })).not.toHaveClass(
                'recommended-capabilities-row-first',
            );

            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));

            expect(screen.getByRole('group', { name: ACTION_GROUP })).toHaveClass('recommended-capabilities-row-first');
        });

        it('brings both dismissed rows back for another agent', async () => {
            const user = userEvent.setup();
            const options = {
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            };
            const { rerender } = renderBanner({ ...options, agentId: 'agent-1' });

            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));
            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            rerender(bannerElement({ ...options, agentId: 'agent-2' }));

            expect(screen.getByRole('group', { name: NO_ACCESS_GROUP })).toBeInTheDocument();
            expect(screen.getByRole('group', { name: ACTION_GROUP })).toBeInTheDocument();
        });

        it('hides the no-access row on its own from its own dismiss button', async () => {
            const user = userEvent.setup();

            const { container } = renderBanner({
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));

            expect(container).toBeEmptyDOMElement();
        });

        it('collapses a long no-access list into its own overflow dialog', async () => {
            const user = userEvent.setup();
            const restoreResizeObserver = stubImmediateResizeObserver();

            try {
                renderBanner({
                    capabilities: {
                        skills: [makeSkill('skill-1', 'Brand voice', true), makeSkill('skill-2', 'Cost model', true)],
                    },
                });

                await user.click(
                    screen.getByRole('button', { name: /show 2 more capabilities you have no access to/i }),
                );

                const dialog = within(await screen.findByRole('dialog'));

                expect(dialog.getByText('Brand voice')).toBeInTheDocument();
                expect(dialog.getByText('Cost model')).toBeInTheDocument();
                expect(dialog.queryByRole('button', { name: /enable/i })).not.toBeInTheDocument();
            } finally {
                restoreResizeObserver();
            }
        });

        it('renders nothing at all when the payload omits the noAccess field entirely', () => {
            const { container } = renderBanner({
                capabilities: {
                    skills: [makeSkill('skill-1', 'Brand voice')],
                    tools: [makeTool('tool-1', 'Cost lookup')],
                    mcpServers: [
                        makeMcp({
                            _id: 'connected',
                            name: 'Notion',
                            connection: { status: 'connected', tokenExpiry: null },
                        }),
                    ],
                },
            });

            expect(container).toBeEmptyDOMElement();
        });

        it('never offers an action for a connector the viewer has no access to', () => {
            const noAccessMcp = makeMcp({ _id: 'salesforce', name: 'Salesforce', noAccess: true });

            renderBanner({ mcpServers: [noAccessMcp], capabilities: { mcpServers: [noAccessMcp] } });

            const row = within(screen.getByRole('group', { name: NO_ACCESS_GROUP }));

            expect(row.getByText('Salesforce')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /connect salesforce/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('group', { name: /recommended connectors and skills/i })).not.toBeInTheDocument();
        });

        it('gives each row its own overflow count', async () => {
            const user = userEvent.setup();
            const restoreResizeObserver = stubImmediateResizeObserver();

            try {
                renderBanner({
                    disabledSkills: [{ _id: 'skill-a', name: 'Brand voice', isRecommended: true }],
                    capabilities: {
                        skills: [makeSkill('no-1', 'Fee guide', true), makeSkill('no-2', 'Cost model', true)],
                    },
                });

                expect(
                    screen.getByRole('button', { name: /show 1 more recommended connectors and skills/i }),
                ).toBeInTheDocument();
                expect(
                    screen.getByRole('button', { name: /show 2 more capabilities you have no access to/i }),
                ).toBeInTheDocument();

                await user.click(
                    screen.getByRole('button', { name: /show 2 more capabilities you have no access to/i }),
                );

                expect(within(await screen.findByRole('dialog')).queryByText('Brand voice')).not.toBeInTheDocument();
            } finally {
                restoreResizeObserver();
            }
        });
    });

    describe('row consistency', () => {
        const CHIP_GEOMETRY_TOKENS = [
            'flex',
            'shrink-0',
            'items-center',
            'gap-1.5',
            'h-7',
            'px-2.5',
            'rounded-full',
            'text-xs',
            'font-medium',
            'whitespace-nowrap',
        ];
        const ROW_TOKENS = ['flex', 'items-center', 'gap-2', 'px-4', 'py-2.5', 'overflow-hidden'];

        const renderBothRows = () =>
            renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

        const getNoAccessChip = (name: string) =>
            within(screen.getByRole('group', { name: /capabilities you have no access to/i })).getByText(name)
                .parentElement as HTMLElement;

        it('gives the two rows the same chip geometry, differing only in colour', () => {
            renderBothRows();

            const actionChip = screen.getByRole('button', { name: /connect microsoft 365/i });
            const noAccessChip = getNoAccessChip('Brand voice');

            CHIP_GEOMETRY_TOKENS.forEach((token) => {
                expect(actionChip).toHaveClass(token);
                expect(noAccessChip).toHaveClass(token);
            });

            expect(actionChip.querySelector('span')).toHaveClass('truncate', 'max-w-[220px]');
            expect(noAccessChip.querySelector('span')).toHaveClass('truncate', 'max-w-[220px]');
            expect(actionChip.tagName).toBe('BUTTON');
            expect(noAccessChip.tagName).toBe('SPAN');
        });

        it('gives the two row labels the same icon treatment', () => {
            renderBothRows();

            const actionIcon = screen
                .getByRole('button', { name: 'This agent uses these. Turn them on to use them in this chat.' })
                .querySelector('svg');
            const noAccessIcon = screen
                .getByRole('button', { name: 'No access — ask an admin to grant it.' })
                .querySelector('svg');

            ROW_LABEL_ICON_CLASSES.split(' ').forEach((token) => {
                expect(actionIcon).toHaveClass(token);
                expect(noAccessIcon).toHaveClass(token);
            });
        });

        it('gives the two rows the same chip surface, differing only in the hue', () => {
            renderBothRows();

            const actionChip = screen.getByRole('button', { name: /connect microsoft 365/i });
            const noAccessChip = getNoAccessChip('Brand voice');

            `${CHIP_GEOMETRY_CLASSES} ${CHIP_SURFACE_CLASSES}`.split(' ').forEach((token) => {
                expect(actionChip).toHaveClass(token);
                expect(noAccessChip).toHaveClass(token);
            });

            CHIP_ICON_CLASSES.split(' ').forEach((token) => {
                expect(actionChip.querySelector('svg')).toHaveClass(token);
                expect(noAccessChip.querySelector('svg')).toHaveClass(token);
            });

            expect(actionChip).toHaveClass('text-[var(--primary)]');
            expect(noAccessChip).toHaveClass('text-muted-foreground');
        });

        it('gives the two rows the same container padding, gap and overflow handling', () => {
            renderBothRows();

            ROW_TOKENS.forEach((token) => {
                expect(screen.getByRole('group', { name: /recommended connectors and skills/i })).toHaveClass(token);
                expect(screen.getByRole('group', { name: /capabilities you have no access to/i })).toHaveClass(token);
            });
        });

        it('explains both rows from a keyboard-reachable tooltip trigger on the leading icon', () => {
            renderBothRows();

            const actionHint = screen.getByRole('button', {
                name: 'This agent uses these. Turn them on to use them in this chat.',
            });
            const noAccessHint = screen.getByRole('button', { name: 'No access — ask an admin to grant it.' });

            [actionHint, noAccessHint].forEach((trigger) => {
                expect(trigger).toHaveAttribute('type', 'button');
                expect(trigger).toHaveClass('cursor-help');
                expect(trigger).not.toBeDisabled();
            });
        });

        it('gives each row its own dismiss button, identically sized and placed', () => {
            renderBothRows();

            const actionDismiss = screen.getByRole('button', { name: 'Dismiss recommendations' });
            const noAccessDismiss = screen.getByRole('button', { name: 'Dismiss no access' });

            expect(actionDismiss.className).toBe(noAccessDismiss.className);
            expect(actionDismiss.parentElement).toHaveClass('ml-auto', 'flex', 'shrink-0', 'items-center');
            expect(noAccessDismiss.parentElement).toHaveClass('ml-auto', 'flex', 'shrink-0', 'items-center');
        });
    });

    /**
     * jsdom reports every element width as 0, so these exercise the code paths and the
     * markup, not the overflow arithmetic: with the immediate ResizeObserver the fitted
     * count always collapses to zero and "+N" always carries the whole list.
     */
    describe('crowded rows', () => {
        const LONG_NAME = `Quarterly ${'fee schedule '.repeat(9)}`.slice(0, 120);

        const makeNoAccessSkills = (count: number) =>
            Array.from({ length: count }, (_, index) =>
                makeSkill(`no-access-${index}`, `Denied capability ${index}`, true),
            );

        const makeDisabledSkills = (count: number): DisabledAgentSkill[] =>
            Array.from({ length: count }, (_, index) => ({
                _id: `skill-${index}`,
                name: `Attached skill ${index}`,
                isRecommended: true,
            }));

        it('collapses a 15-item no-access row into a dialog that lists every item', async () => {
            const user = userEvent.setup();
            const restoreResizeObserver = stubImmediateResizeObserver();

            try {
                renderBanner({ capabilities: { skills: makeNoAccessSkills(15) } });

                expect(screen.getByRole('group', { name: /capabilities you have no access to/i })).toBeInTheDocument();

                await user.click(
                    screen.getByRole('button', { name: /show 15 more capabilities you have no access to/i }),
                );

                const dialog = within(await screen.findByRole('dialog'));

                makeNoAccessSkills(15).forEach((skill) => expect(dialog.getByText(skill.name)).toBeInTheDocument());
            } finally {
                restoreResizeObserver();
            }
        });

        it('keeps a separate overflow count per row when both rows are full', () => {
            const restoreResizeObserver = stubImmediateResizeObserver();

            try {
                renderBanner({
                    disabledSkills: makeDisabledSkills(8),
                    capabilities: { skills: makeNoAccessSkills(15) },
                });

                expect(
                    screen.getByRole('button', { name: /show 15 more capabilities you have no access to/i }),
                ).toBeInTheDocument();
                expect(
                    screen.getByRole('button', { name: /show 8 more recommended connectors and skills/i }),
                ).toBeInTheDocument();
                expect(screen.getAllByRole('group')).toHaveLength(2);
            } finally {
                restoreResizeObserver();
            }
        });

        it('truncates a 120-character name instead of widening the row, keeping the full name in the title', () => {
            renderBanner({
                disabledSkills: [{ _id: 'skill-long', name: LONG_NAME, isRecommended: true }],
                capabilities: { skills: [makeSkill('no-access-long', LONG_NAME, true)] },
            });

            const noAccessName = within(
                screen.getByRole('group', { name: /capabilities you have no access to/i }),
            ).getByText(LONG_NAME);
            const actionChip = screen.getByRole('button', { name: `Enable ${LONG_NAME}` });

            expect(noAccessName).toHaveClass('truncate', 'max-w-[220px]');
            expect(noAccessName.parentElement).toHaveAttribute(
                'title',
                expect.stringContaining(LONG_NAME) as unknown as string,
            );
            expect(actionChip.querySelector('span')).toHaveClass('truncate', 'max-w-[220px]');
            expect(actionChip).toHaveAttribute('title', `Enable ${LONG_NAME}`);
        });

        it('still renders a usable row when a single name cannot fit at all', () => {
            const restoreResizeObserver = stubImmediateResizeObserver();

            try {
                renderBanner({ capabilities: { skills: [makeSkill('no-access-long', LONG_NAME, true)] } });

                const row = within(screen.getByRole('group', { name: /capabilities you have no access to/i }));

                expect(row.getByText('No access')).toBeInTheDocument();
                expect(
                    row.getByRole('button', { name: 'Show 1 more capabilities you have no access to' }),
                ).toBeInTheDocument();
                expect(row.getByRole('button', { name: 'Dismiss no access' })).toBeInTheDocument();
            } finally {
                restoreResizeObserver();
            }
        });

        it('gives every no-access kind its own icon', () => {
            renderBanner({
                capabilities: {
                    mcpServers: [makeMcp({ _id: 'mcp-1', name: 'Salesforce', noAccess: true })],
                    skills: [makeSkill('skill-1', 'Brand voice', true)],
                    dataStores: [{ _id: 'ds-1', name: 'Fee guide', noAccess: true }] as CapabilitySources['dataStores'],
                    tools: [makeTool('tool-1', 'Cost lookup', true)],
                    agents: [{ _id: 'agent-1', name: 'Reviewer', noAccess: true }] as CapabilitySources['agents'],
                },
            });

            const row = within(screen.getByRole('group', { name: /capabilities you have no access to/i }));
            const iconClasses = ['Salesforce', 'Brand voice', 'Fee guide', 'Cost lookup', 'Reviewer'].map((name) => {
                const chip = row.getByText(name).parentElement as HTMLElement;

                return chip.querySelector('svg')?.getAttribute('class') ?? '';
            });

            expect(iconClasses.filter(Boolean)).toHaveLength(5);
            expect(new Set(iconClasses).size).toBe(5);
        });

        it('never leaks a dismissal between rows or between agents', async () => {
            const user = userEvent.setup();
            const options = {
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            };
            const { rerender } = renderBanner({ ...options, agentId: 'agent-1' });

            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));

            rerender(bannerElement({ ...options, agentId: 'agent-2' }));

            expect(screen.getByRole('group', { name: /capabilities you have no access to/i })).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            rerender(bannerElement({ ...options, agentId: 'agent-1' }));

            expect(
                screen.queryByRole('group', { name: /capabilities you have no access to/i }),
            ).not.toBeInTheDocument();
            expect(screen.getByRole('group', { name: /recommended connectors and skills/i })).toBeInTheDocument();
        });
    });

    describe('dismissal storage', () => {
        const NO_ACCESS_GROUP = /capabilities you have no access to/i;
        const ACTION_GROUP = /recommended connectors and skills/i;
        const RECOMMENDED_KEY = 'fm.banner.dismissed.agent-1.recommended';
        const NO_ACCESS_KEY = 'fm.banner.dismissed.agent-1.noAccess';

        it('records the dismissed item ids under a per-agent, per-row key', async () => {
            const user = userEvent.setup();

            renderBanner({
                mcpServers: [
                    makeMcp({ _id: 'ms365-test', name: 'Microsoft 365 TEST' }),
                    makeMcp({ _id: 'hg', name: 'Hg' }),
                ],
                capabilities: { tools: [makeTool('cost-lookup', 'Cost lookup', true)] },
            });

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));
            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));

            expect(sessionStorage.getItem(RECOMMENDED_KEY)).toBe('connector:hg:connect,connector:ms365-test:connect');
            expect(sessionStorage.getItem(NO_ACCESS_KEY)).toBe('cost-lookup');
        });

        it('keeps the row hidden on a fresh mount reading the same stored fingerprint', () => {
            sessionStorage.setItem(RECOMMENDED_KEY, 'connector:microsoft:connect');

            const { container } = renderBanner({ mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })] });

            expect(container).toBeEmptyDOMElement();
        });

        it('brings the row back when a capability is added to it', () => {
            sessionStorage.setItem(RECOMMENDED_KEY, 'connector:microsoft:connect');

            renderBanner({
                mcpServers: [
                    makeMcp({ _id: 'microsoft', name: 'Microsoft 365' }),
                    makeMcp({ _id: 'firecrawl', name: 'Firecrawl' }),
                ],
            });

            expect(screen.getByRole('group', { name: ACTION_GROUP })).toBeInTheDocument();
        });

        it('keeps the row dismissed when a capability is only removed from it', () => {
            sessionStorage.setItem(NO_ACCESS_KEY, 'ds-1,tool-1');

            const { container } = renderBanner({ capabilities: { tools: [makeTool('tool-1', 'Cost lookup', true)] } });

            expect(container).toBeEmptyDOMElement();
        });

        it('keeps the row dismissed after one of its connectors is enabled elsewhere', () => {
            sessionStorage.setItem(RECOMMENDED_KEY, 'connector:firecrawl:enable,connector:microsoft:enable');

            const { container } = renderBanner({
                mcpServers: [
                    makeMcp({ _id: 'microsoft', name: 'Microsoft 365', authType: 'api-key' }),
                    makeMcp({ _id: 'firecrawl', name: 'Firecrawl', authType: 'api-key' }),
                ],
                disabledMap: { microsoft: true },
            });

            expect(container).toBeEmptyDOMElement();
        });

        it('brings the row back when a dismissed connector now needs reconnecting instead', () => {
            sessionStorage.setItem(RECOMMENDED_KEY, 'connector:notion:enable');

            renderBanner({
                mcpServers: [
                    makeMcp({
                        _id: 'notion',
                        name: 'Notion',
                        connection: { status: 'connected', tokenExpiry: new Date(Date.now() - HOUR_MS).toISOString() },
                    }),
                ],
            });

            expect(screen.getByRole('button', { name: /reconnect notion/i })).toBeInTheDocument();
        });

        it('does not resurrect the row when only the id order changes', () => {
            sessionStorage.setItem(RECOMMENDED_KEY, 'connector:firecrawl:connect,connector:microsoft:connect');

            const { container } = renderBanner({
                mcpServers: [
                    makeMcp({ _id: 'microsoft', name: 'Microsoft 365' }),
                    makeMcp({ _id: 'firecrawl', name: 'Firecrawl' }),
                ],
            });

            expect(container).toBeEmptyDOMElement();
        });

        it("keeps each row's record to itself", () => {
            sessionStorage.setItem(NO_ACCESS_KEY, 'skill-1');

            renderBanner({
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            expect(screen.queryByRole('group', { name: NO_ACCESS_GROUP })).not.toBeInTheDocument();
            expect(screen.getByRole('group', { name: ACTION_GROUP })).toHaveClass('recommended-capabilities-row-first');
        });

        it("leaves another agent untouched by this agent's dismissal", () => {
            sessionStorage.setItem(RECOMMENDED_KEY, 'connector:microsoft:connect');

            renderBanner({
                agentId: 'agent-2',
                mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })],
            });

            expect(screen.getByRole('group', { name: ACTION_GROUP })).toBeInTheDocument();
        });

        it('renders normally when sessionStorage is unavailable', async () => {
            const user = userEvent.setup();
            const denied = () => {
                throw new Error('storage disabled');
            };
            const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
            const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);

            try {
                renderBanner({ mcpServers: [makeMcp({ _id: 'microsoft', name: 'Microsoft 365' })] });

                expect(screen.getByRole('group', { name: ACTION_GROUP })).toBeInTheDocument();

                await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

                expect(screen.queryByRole('group', { name: ACTION_GROUP })).not.toBeInTheDocument();
            } finally {
                getItem.mockRestore();
                setItem.mockRestore();
            }
        });
    });

    describe('recommended skills', () => {
        it('offers no chip for a disabled skill the agent does not recommend', () => {
            const { container } = renderBanner({
                disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: false }],
            });

            expect(container).toBeEmptyDOMElement();
        });

        it('offers no chip for a disabled skill whose payload omits the flag', () => {
            const { container } = renderBanner({ disabledSkills: [{ _id: 'skill-1', name: 'Brand voice' }] });

            expect(container).toBeEmptyDOMElement();
        });

        it('offers a chip for a disabled skill the agent recommends', () => {
            renderBanner({ disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: true }] });

            expect(screen.getByRole('button', { name: /enable brand voice/i })).toBeInTheDocument();
        });

        it('still lists a no-access skill whatever the recommendation flag says', () => {
            renderBanner({
                disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: false }],
                capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] },
            });

            const row = within(screen.getByRole('group', { name: /capabilities you have no access to/i }));

            expect(row.getByText('Brand voice')).toBeInTheDocument();
            expect(screen.queryByRole('group', { name: /recommended connectors and skills/i })).not.toBeInTheDocument();
        });
    });
    describe('overflow dialog sections', () => {
        const withImmediateResizeObserver = async (run: () => Promise<void>) => {
            const restore = stubImmediateResizeObserver();

            try {
                await run();
            } finally {
                restore();
            }
        };

        const openDialog = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
            await user.click(screen.getByRole('button', { name }));

            return screen.findByRole('dialog');
        };

        const openRecommended = (user: ReturnType<typeof userEvent.setup>) =>
            openDialog(user, /show \d+ more recommended connectors and skills/i);

        const openNoAccess = (user: ReturnType<typeof userEvent.setup>) =>
            openDialog(user, /show \d+ more capabilities you have no access to/i);

        const headingTexts = (dialog: HTMLElement) =>
            within(dialog)
                .getAllByRole('heading', { level: 3 })
                .map((heading) => heading.textContent);

        const ALL_KINDS: CapabilitySources = {
            mcpServers: [makeMcp({ _id: 'mcp-1', name: 'Salesforce', noAccess: true })],
            skills: [makeSkill('skill-1', 'Brand voice', true)],
            dataStores: [{ _id: 'ds-1', name: 'Fee guide', noAccess: true }] as CapabilitySources['dataStores'],
            tools: [makeTool('tool-1', 'Cost lookup', true)],
            agents: [{ _id: 'agent-9', name: 'Reviewer', noAccess: true }] as CapabilitySources['agents'],
        };

        const RECOMMENDED_BOTH_KINDS = {
            mcpServers: [makeMcp({ _id: 'notion', name: 'Notion' })],
            disabledSkills: [{ _id: 'skill-a', name: 'Brand voice', isRecommended: true }],
        };

        it('groups the recommended dialog by kind and heads only the kinds it has', async () => {
            const user = userEvent.setup();

            await withImmediateResizeObserver(async () => {
                renderBanner(RECOMMENDED_BOTH_KINDS);

                const dialogElement = await openRecommended(user);
                const dialog = within(dialogElement);

                expect(headingTexts(dialogElement)).toEqual(['Connectors', 'Skills']);
                expect(dialog.queryByRole('heading', { name: 'Data stores' })).not.toBeInTheDocument();
                expect(dialog.queryByRole('heading', { name: 'Tools' })).not.toBeInTheDocument();
            });
        });

        it('groups the no-access dialog by kind, one heading per kind present', async () => {
            const user = userEvent.setup();

            await withImmediateResizeObserver(async () => {
                renderBanner({ capabilities: ALL_KINDS });

                expect(headingTexts(await openNoAccess(user))).toEqual([
                    'Connectors',
                    'Skills',
                    'Data stores',
                    'Tools',
                    'Agents',
                ]);
            });
        });

        it('heads only the kinds that have items in the no-access dialog', async () => {
            const user = userEvent.setup();

            await withImmediateResizeObserver(async () => {
                renderBanner({ capabilities: { dataStores: ALL_KINDS.dataStores } });

                expect(headingTexts(await openNoAccess(user))).toEqual(['Data stores']);
            });
        });

        it('orders the sections the same way in both dialogs', async () => {
            const user = userEvent.setup();

            await withImmediateResizeObserver(async () => {
                renderBanner({
                    ...RECOMMENDED_BOTH_KINDS,
                    capabilities: {
                        mcpServers: [makeMcp({ _id: 'mcp-1', name: 'Salesforce', noAccess: true })],
                        skills: [makeSkill('skill-1', 'Cost model', true)],
                    },
                });

                const recommended = headingTexts(await openRecommended(user));

                await user.click(screen.getByRole('button', { name: 'Close' }));
                await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

                expect(headingTexts(await openNoAccess(user))).toEqual(recommended);
            });
        });

        it('offers Enable all on the skills section of the recommended dialog only', async () => {
            const user = userEvent.setup();

            await withImmediateResizeObserver(async () => {
                renderBanner(RECOMMENDED_BOTH_KINDS);

                const dialog = within(await openRecommended(user));
                const enableAll = dialog.getByRole('button', { name: 'Enable all skills' });

                expect(dialog.getAllByRole('button', { name: 'Enable all skills' })).toHaveLength(1);
                expect(
                    within(enableAll.closest('section') as HTMLElement).getByRole('heading', { level: 3 }),
                ).toHaveTextContent('Skills');
            });
        });

        it('offers no Enable all when the recommended dialog has no skills section', async () => {
            const user = userEvent.setup();

            await withImmediateResizeObserver(async () => {
                renderBanner({ mcpServers: [makeMcp({ _id: 'notion', name: 'Notion' })] });

                const dialog = within(await openRecommended(user));

                expect(dialog.queryByRole('button', { name: 'Enable all skills' })).not.toBeInTheDocument();
            });
        });

        it('gives the no-access dialog no buttons beyond its close control', async () => {
            const user = userEvent.setup();

            await withImmediateResizeObserver(async () => {
                renderBanner({ capabilities: ALL_KINDS });

                const dialog = within(await openNoAccess(user));

                expect(dialog.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
                    'Close',
                ]);
            });
        });

        it('enables every skill in the section once, sequentially', async () => {
            const user = userEvent.setup();
            const enabledIds: string[] = [];
            const onEnableSkill = vi.fn((skillId: string) => {
                enabledIds.push(skillId);

                return Promise.resolve(true);
            });

            await withImmediateResizeObserver(async () => {
                renderBanner({
                    mcpServers: [makeMcp({ _id: 'notion', name: 'Notion' })],
                    disabledSkills: [
                        { _id: 'skill-a', name: 'Brand voice', isRecommended: true },
                        { _id: 'skill-b', name: 'Cost model', isRecommended: true },
                        { _id: 'skill-c', name: 'Fee guide', isRecommended: true },
                    ],
                    onEnableSkill,
                });

                const dialog = within(await openRecommended(user));

                await user.click(dialog.getByRole('button', { name: 'Enable all skills' }));

                await waitFor(() => expect(onEnableSkill).toHaveBeenCalledTimes(3));
                expect(enabledIds).toEqual(['skill-a', 'skill-b', 'skill-c']);
            });
        });

        it('shows the skill it is writing right now as pending during an Enable all run', async () => {
            const user = userEvent.setup();
            let settle: (isEnabled: boolean) => void = () => {};
            const onEnableSkill = vi.fn((skillId: string) =>
                skillId === 'skill-a'
                    ? new Promise<boolean>((resolve) => {
                          settle = resolve;
                      })
                    : Promise.resolve(true),
            );

            await withImmediateResizeObserver(async () => {
                renderBanner({
                    disabledSkills: [
                        { _id: 'skill-a', name: 'Brand voice', isRecommended: true },
                        { _id: 'skill-b', name: 'Cost model', isRecommended: true },
                    ],
                    onEnableSkill,
                });

                const dialog = within(await openRecommended(user));

                await user.click(dialog.getByRole('button', { name: 'Enable all skills' }));

                expect(await dialog.findByRole('button', { name: 'Enabling Brand voice' })).toBeDisabled();
                expect(dialog.getByRole('button', { name: 'Enable Cost model' })).toBeDisabled();

                settle(true);

                await waitFor(() => expect(onEnableSkill).toHaveBeenCalledTimes(2));
            });
        });

        it('attempts every skill after one fails and reports a k of n summary', async () => {
            const user = userEvent.setup();
            const onEnableSkill = vi.fn((skillId: string) => Promise.resolve(skillId !== 'skill-b'));

            await withImmediateResizeObserver(async () => {
                renderBanner({
                    disabledSkills: [
                        { _id: 'skill-a', name: 'Brand voice', isRecommended: true },
                        { _id: 'skill-b', name: 'Cost model', isRecommended: true },
                        { _id: 'skill-c', name: 'Fee guide', isRecommended: true },
                    ],
                    onEnableSkill,
                });

                const dialog = within(await openRecommended(user));

                await user.click(dialog.getByRole('button', { name: 'Enable all skills' }));

                await waitFor(() => expect(onEnableSkill).toHaveBeenCalledTimes(3));
                await waitFor(() =>
                    expect(toast.error).toHaveBeenCalledWith('2 of 3 skills enabled for this chat. Failed: Cost model'),
                );
            });
        });
    });

    describe('collisions and stale state', () => {
        const ACTION_GROUP = /recommended connectors and skills/i;
        const RECOMMENDED_KEY = 'fm.banner.dismissed.agent-1.recommended';

        const THREE_SKILLS: DisabledAgentSkill[] = [
            { _id: 'skill-a', name: 'Brand voice', isRecommended: true },
            { _id: 'skill-b', name: 'Cost model', isRecommended: true },
            { _id: 'skill-c', name: 'Fee guide', isRecommended: true },
        ];

        /**
         * jsdom lays nothing out, so the fitted count is forced by pinning the measured
         * container and its children to fixed widths before the observer callback runs.
         */
        const stubMeasuredResizeObserver = (containerWidth: number, childWidth: number) => {
            const original = globalThis.ResizeObserver;

            class MeasuredResizeObserver {
                callback: ResizeObserverCallback;

                constructor(callback: ResizeObserverCallback) {
                    this.callback = callback;
                }

                observe(target: Element) {
                    const container = target as HTMLElement;

                    container.style.paddingLeft = '0px';
                    container.style.paddingRight = '0px';
                    Object.defineProperty(container, 'clientWidth', { configurable: true, value: containerWidth });
                    Array.from(container.children).forEach((child) => {
                        Object.defineProperty(child, 'offsetWidth', { configurable: true, value: childWidth });
                    });

                    this.callback([], this as unknown as ResizeObserver);
                }

                unobserve() {}

                disconnect() {}
            }

            vi.stubGlobal('ResizeObserver', MeasuredResizeObserver);

            return () => vi.stubGlobal('ResizeObserver', original);
        };

        const blockOn = (blockedSkillId: string) => {
            let settle: (isEnabled: boolean) => void = () => {};
            const onEnableSkill = vi.fn((skillId: string) =>
                skillId === blockedSkillId
                    ? new Promise<boolean>((resolve) => {
                          settle = resolve;
                      })
                    : Promise.resolve(true),
            );

            return { onEnableSkill, settle: (isEnabled: boolean) => settle(isEnabled) };
        };

        it('locks the row chips while a bulk run is writing the same skills', async () => {
            const user = userEvent.setup();
            const { onEnableSkill, settle } = blockOn('skill-a');
            const restore = stubMeasuredResizeObserver(400, 100);

            try {
                renderBanner({ disabledSkills: THREE_SKILLS, onEnableSkill });

                const row = within(screen.getByRole('group', { name: ACTION_GROUP }));

                expect(row.getByRole('button', { name: 'Enable Cost model' })).toBeEnabled();

                await user.click(
                    screen.getByRole('button', { name: /show 1 more recommended connectors and skills/i }),
                );

                const dialog = within(await screen.findByRole('dialog'));

                await user.click(dialog.getByRole('button', { name: 'Enable all skills' }));
                await user.keyboard('{Escape}');
                await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

                expect(row.getByRole('button', { name: 'Enable Cost model' })).toBeDisabled();
                expect(onEnableSkill).toHaveBeenCalledExactlyOnceWith('skill-a');

                settle(true);

                await waitFor(() => expect(onEnableSkill).toHaveBeenCalledTimes(3));
                expect(onEnableSkill.mock.calls.filter(([skillId]) => skillId === 'skill-c')).toHaveLength(1);
            } finally {
                restore();
            }
        });

        it('drops a chip failure once its capability leaves the row', async () => {
            const user = userEvent.setup();
            const onEnableSkill = vi.fn(() => Promise.resolve(false));
            const skills: DisabledAgentSkill[] = [{ _id: 'skill-1', name: 'Brand voice', isRecommended: true }];
            const { rerender } = renderBanner({ disabledSkills: skills, onEnableSkill });

            await user.click(screen.getByRole('button', { name: 'Enable Brand voice' }));

            expect(await screen.findByRole('button', { name: 'Retry enabling Brand voice' })).toBeInTheDocument();

            rerender(bannerElement({ disabledSkills: [], onEnableSkill }));
            rerender(bannerElement({ disabledSkills: skills, onEnableSkill }));

            expect(screen.getByRole('button', { name: 'Enable Brand voice' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Retry enabling Brand voice' })).not.toBeInTheDocument();
        });

        it('reports nothing from a bulk run whose banner is already gone', async () => {
            const user = userEvent.setup();
            const { onEnableSkill, settle } = blockOn('skill-a');
            const restore = stubImmediateResizeObserver();

            try {
                const { unmount } = renderBanner({ disabledSkills: THREE_SKILLS.slice(0, 2), onEnableSkill });

                await user.click(
                    screen.getByRole('button', { name: /show 2 more recommended connectors and skills/i }),
                );

                const dialog = within(await screen.findByRole('dialog'));

                await user.click(dialog.getByRole('button', { name: 'Enable all skills' }));

                vi.mocked(toast.success).mockClear();
                vi.mocked(toast.error).mockClear();

                unmount();
                settle(true);

                await waitFor(() => expect(onEnableSkill).toHaveBeenCalledTimes(2));
                await new Promise((resolve) => {
                    setTimeout(resolve, 0);
                });

                expect(toast.success).not.toHaveBeenCalled();
                expect(toast.error).not.toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        it('warns again when a dismissed blocker goes away and comes back', async () => {
            const user = userEvent.setup();
            const salesforce = makeMcp({ _id: 'salesforce', name: 'Salesforce' });
            const { rerender } = renderBanner({ mcpServers: [salesforce] });

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            expect(screen.queryByRole('group', { name: ACTION_GROUP })).not.toBeInTheDocument();

            rerender(bannerElement({ mcpServers: [] }));

            expect(sessionStorage.getItem(RECOMMENDED_KEY)).toBe('');

            rerender(bannerElement({ mcpServers: [salesforce] }));

            expect(screen.getByRole('group', { name: ACTION_GROUP })).toBeInTheDocument();
        });

        it('keeps the rest of a dismissed row quiet when only one of its items is resolved', async () => {
            const user = userEvent.setup();
            const microsoft = makeMcp({ _id: 'microsoft', name: 'Microsoft 365' });
            const firecrawl = makeMcp({ _id: 'firecrawl', name: 'Firecrawl' });
            const { rerender } = renderBanner({ mcpServers: [microsoft, firecrawl] });

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            rerender(bannerElement({ mcpServers: [microsoft] }));

            expect(screen.queryByRole('group', { name: ACTION_GROUP })).not.toBeInTheDocument();
            expect(sessionStorage.getItem(RECOMMENDED_KEY)).toBe('connector:microsoft:connect');
        });
    });
    describe('dismissal analytics', () => {
        const trackEventMock = vi.mocked(trackEvent);

        beforeEach(() => {
            trackEventMock.mockClear();
        });

        it('reports the dismissed recommendation once per click', async () => {
            const user = userEvent.setup();

            renderBanner({
                agentId: 'agent-7',
                mcpServers: [
                    makeMcp({
                        _id: 'github',
                        name: 'GitHub',
                        connection: { status: 'connected', tokenExpiry: new Date(Date.now() - HOUR_MS).toISOString() },
                    }),
                ],
            });

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            expect(trackEventMock).toHaveBeenCalledTimes(1);
            expect(trackEventMock).toHaveBeenCalledWith('recommendation_dismissed', {
                surface: 'chat_composer',
                agent_id: 'agent-7',
                recommendation_type: 'reconnect_connector',
                connector_id: 'github',
                item_count: 1,
                items: [{ recommendation_type: 'reconnect_connector', capability_id: 'github', name: 'GitHub' }],
            });
        });

        it('reports every item the row was carrying, not only the ones that fit', async () => {
            const user = userEvent.setup();

            renderBanner({
                mcpServers: [
                    makeMcp({ _id: 'microsoft', name: 'Microsoft 365' }),
                    makeMcp({ _id: 'firecrawl', name: 'Firecrawl' }),
                ],
                disabledSkills: [{ _id: 'skill-1', name: 'Brand voice', isRecommended: true }],
            });

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            expect(trackEventMock).toHaveBeenCalledWith(
                'recommendation_dismissed',
                expect.objectContaining({ recommendation_type: 'mixed', connector_id: null, item_count: 3 }),
            );
        });

        it('stays silent when the no-access row is dismissed', async () => {
            const user = userEvent.setup();

            renderBanner({ capabilities: { skills: [makeSkill('skill-1', 'Brand voice', true)] } });

            await user.click(screen.getByRole('button', { name: 'Dismiss no access' }));

            expect(trackEventMock).not.toHaveBeenCalled();
        });

        it('stays silent when a recommendation goes stale instead of being dismissed', () => {
            const microsoft = makeMcp({ _id: 'microsoft', name: 'Microsoft 365' });
            const { rerender } = renderBanner({ mcpServers: [microsoft] });

            rerender(bannerElement({ mcpServers: [] }));

            expect(trackEventMock).not.toHaveBeenCalled();
        });

        it('raises no second event while the pruning effect rewrites a dismissed row', async () => {
            const user = userEvent.setup();
            const microsoft = makeMcp({ _id: 'microsoft', name: 'Microsoft 365' });
            const firecrawl = makeMcp({ _id: 'firecrawl', name: 'Firecrawl' });
            const { rerender } = renderBanner({ mcpServers: [microsoft, firecrawl] });

            await user.click(screen.getByRole('button', { name: 'Dismiss recommendations' }));

            rerender(bannerElement({ mcpServers: [microsoft] }));

            expect(trackEventMock).toHaveBeenCalledTimes(1);
        });
    });
});

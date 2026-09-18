import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DropdownMenuContent, DropdownMenuRoot, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { fireEvent, renderWithProviders, screen, within } from '@/test/test-utils';

import ConnectorsSubmenu, { type ConnectorsSubmenuProps } from './connectors-submenu';

const disconnectedConnector = {
    _id: 'oauth-connector-1',
    name: 'OAuth Connector',
};

const renderSubmenu = async (overrides: Partial<ConnectorsSubmenuProps> = {}) => {
    const user = userEvent.setup();
    const props: ConnectorsSubmenuProps = {
        connections: [],
        nonOauthConnectors: [],
        disconnectedConnectors: [disconnectedConnector],
        isLoading: false,
        disabledMap: {},
        onToggle: vi.fn(),
        onReconnect: vi.fn(),
        onToggleDisconnected: vi.fn(),
        connectingId: null,
        onCancel: vi.fn(),
        cancellingId: null,
        ...overrides,
    };

    renderWithProviders(
        <DropdownMenuRoot open>
            <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
            <DropdownMenuContent>
                <ConnectorsSubmenu {...props} />
            </DropdownMenuContent>
        </DropdownMenuRoot>,
    );

    await user.hover(await screen.findByRole('menuitem', { name: /Connectors/ }));
    const row = await screen.findByRole('menuitem', { name: /OAuth Connector/ });

    return { props, row, user };
};

describe('ConnectorsSubmenu disconnected OAuth rows', () => {
    it('shows Connect and a checked toggle when enabled', async () => {
        const { row } = await renderSubmenu();

        expect(within(row).getByRole('button', { name: 'Connect' })).toBeInTheDocument();
        expect(within(row).getByRole('switch')).toBeChecked();
    });

    it('toggles enablement only via the switch, not a row click', async () => {
        const onToggleDisconnected = vi.fn();
        const { row } = await renderSubmenu({ onToggleDisconnected });

        fireEvent.click(row);

        expect(onToggleDisconnected).not.toHaveBeenCalled();

        fireEvent.click(within(row).getByRole('switch'));

        expect(onToggleDisconnected).toHaveBeenCalledOnce();
        expect(onToggleDisconnected).toHaveBeenCalledWith('oauth-connector-1');
    });

    it('toggles enablement when Enter is pressed on the focused row', async () => {
        const onToggleDisconnected = vi.fn();
        const { row, user } = await renderSubmenu({ onToggleDisconnected });

        row.focus();
        await user.keyboard('{Enter}');

        expect(onToggleDisconnected).toHaveBeenCalledOnce();
        expect(onToggleDisconnected).toHaveBeenCalledWith('oauth-connector-1');
    });

    it('connects without toggling when Connect is clicked', async () => {
        const onReconnect = vi.fn();
        const onToggleDisconnected = vi.fn();
        const { row } = await renderSubmenu({ onReconnect, onToggleDisconnected });

        fireEvent.click(within(row).getByRole('button', { name: 'Connect' }));

        expect(onReconnect).toHaveBeenCalledOnce();
        expect(onReconnect).toHaveBeenCalledWith('oauth-connector-1');
        expect(onToggleDisconnected).not.toHaveBeenCalled();
    });

    it('shows only an unchecked toggle when disabled', async () => {
        const { row } = await renderSubmenu({
            disabledMap: { 'oauth-connector-1': true },
        });

        expect(within(row).queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
        expect(within(row).getByRole('switch')).not.toBeChecked();
    });

    it('keeps the switch live while the enable is saving so a late click still lands', async () => {
        const onToggleDisconnected = vi.fn();
        const { row } = await renderSubmenu({
            onToggleDisconnected,
            disabledMap: { 'oauth-connector-1': true },
            enablingId: 'oauth-connector-1',
        });
        const toggle = within(row).getByRole('switch');

        expect(toggle).toBeEnabled();

        fireEvent.click(toggle);

        expect(onToggleDisconnected).toHaveBeenCalledWith('oauth-connector-1');
    });

    it('holds Connect disabled until the enable has been saved', async () => {
        const { row } = await renderSubmenu({ enablingId: 'oauth-connector-1' });

        expect(within(row).getByRole('button', { name: 'Connect' })).toBeDisabled();
    });
});

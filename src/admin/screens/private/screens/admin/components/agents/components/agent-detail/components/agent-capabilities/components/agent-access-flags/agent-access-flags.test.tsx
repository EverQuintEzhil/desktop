import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';
import type { AgentSettingsType } from '@/types/admin';

import AgentAccessFlags, { type AgentAccessFlagKey } from './agent-access-flags';

const NO_FLAGS: Required<AgentSettingsType> = {
    allowCustomSkills: false,
    allowSharedSkills: false,
    allowCustomConnectors: false,
    allowSharedConnectors: false,
};

interface RenderOverrides {
    settings?: Required<AgentSettingsType>;
    canUserEdit?: boolean;
    flagKeys?: AgentAccessFlagKey[];
}

const renderFlags = (overrides: RenderOverrides = {}) => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const rendered = renderWithProviders(
        <AgentAccessFlags
            settings={overrides.settings ?? NO_FLAGS}
            canUserEdit={overrides.canUserEdit ?? true}
            flagKeys={overrides.flagKeys ?? ['allowCustomSkills', 'allowSharedSkills']}
            onToggle={onToggle}
        />,
    );

    return { ...rendered, onToggle, user };
};

const customSwitch = () => screen.getByRole('switch', { name: /^Allow custom/ });
const enterpriseSwitch = () => screen.getByRole('switch', { name: /^Allow enterprise/ });

describe('AgentAccessFlags — checked state', () => {
    it('reads the checked state of each rendered flag from the settings prop', () => {
        renderFlags({ settings: { ...NO_FLAGS, allowCustomSkills: true } });

        expect(customSwitch()).toBeChecked();
        expect(enterpriseSwitch()).not.toBeChecked();
    });

    it('renders the connector pair from the same settings object', () => {
        renderFlags({
            settings: { ...NO_FLAGS, allowSharedConnectors: true },
            flagKeys: ['allowCustomConnectors', 'allowSharedConnectors'],
        });

        expect(enterpriseSwitch()).toBeChecked();
        expect(customSwitch()).not.toBeChecked();
    });

    it('renders both switches unchecked when no flag is set', () => {
        renderFlags();

        expect(customSwitch()).not.toBeChecked();
        expect(enterpriseSwitch()).not.toBeChecked();
    });
});

describe('AgentAccessFlags — labelling', () => {
    it('shows a short visible label in the crowded card header', () => {
        renderFlags();

        expect(screen.getByText('Allow custom')).toBeInTheDocument();
        expect(screen.getByText('Allow enterprise')).toBeInTheDocument();
    });

    // All four switches share the header, so the accessible name has to carry the resource word.
    it('names each switch with the resource it governs', () => {
        renderFlags();

        expect(customSwitch()).toHaveAccessibleName('Allow custom skills');
        expect(enterpriseSwitch()).toHaveAccessibleName('Allow enterprise skills');
    });

    it('names the connector pair after connectors', () => {
        renderFlags({ flagKeys: ['allowCustomConnectors', 'allowSharedConnectors'] });

        expect(customSwitch()).toHaveAccessibleName('Allow custom connectors');
        expect(enterpriseSwitch()).toHaveAccessibleName('Allow enterprise connectors');
    });

    it('shows the full sentence in a tooltip on hover', async () => {
        const { user } = renderFlags();

        await user.hover(customSwitch());

        await waitFor(() => {
            expect(screen.getAllByText('Users can use skills they created').length).toBeGreaterThan(0);
        });
    });
});

describe('AgentAccessFlags — toggling', () => {
    it('reports the toggled key and its next value to the owner', async () => {
        const { user, onToggle } = renderFlags();

        await user.click(customSwitch());

        expect(onToggle).toHaveBeenCalledWith('allowCustomSkills', true);
    });

    it('reports a turn-off as false', async () => {
        const { user, onToggle } = renderFlags({ settings: { ...NO_FLAGS, allowSharedSkills: true } });

        await user.click(enterpriseSwitch());

        expect(onToggle).toHaveBeenCalledWith('allowSharedSkills', false);
    });
});

describe('AgentAccessFlags — permissions and saving', () => {
    it('disables both switches when the user cannot edit', () => {
        renderFlags({ canUserEdit: false });

        expect(customSwitch()).toBeDisabled();
        expect(enterpriseSwitch()).toBeDisabled();
    });
});

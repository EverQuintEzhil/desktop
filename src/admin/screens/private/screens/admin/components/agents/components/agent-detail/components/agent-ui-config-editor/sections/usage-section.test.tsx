import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import type { ChatUiConfig } from '../schema';

import UsageSection from './usage-section';

const renderSection = async (value: ChatUiConfig['usage']) => {
    const onChange = vi.fn();

    renderWithProviders(<UsageSection value={value} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /AI usage/i }));
    await screen.findByRole('checkbox', { name: 'Hide AI usage' });

    return { onChange };
};

const hideCheckbox = () => screen.getByRole('checkbox', { name: 'Hide AI usage' });
const roleCheckbox = (label: string) => screen.getByRole('checkbox', { name: label });

describe('UsageSection', () => {
    it('renders the hide flag and the four role checkboxes', async () => {
        await renderSection(undefined);

        expect(hideCheckbox()).toHaveAttribute('data-state', 'unchecked');
        expect(roleCheckbox('Admin')).toHaveAttribute('data-state', 'checked');
        expect(roleCheckbox('Owner')).toHaveAttribute('data-state', 'checked');
        expect(roleCheckbox('Developer')).toHaveAttribute('data-state', 'checked');
        expect(roleCheckbox('User')).toHaveAttribute('data-state', 'checked');
    });

    it('patches hidden true when Hide AI usage is checked', async () => {
        const { onChange } = await renderSection(undefined);

        await userEvent.click(hideCheckbox());

        expect(onChange).toHaveBeenCalledWith({ hidden: true });
    });

    it('clears the whole key when Hide AI usage is unchecked', async () => {
        const { onChange } = await renderSection({ hidden: true });

        await userEvent.click(hideCheckbox());

        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('keeps a configured role list when Hide AI usage is unchecked', async () => {
        const { onChange } = await renderSection({ hidden: true, visibleToRoles: ['admin'] });

        await userEvent.click(hideCheckbox());

        expect(onChange).toHaveBeenCalledWith({ visibleToRoles: ['admin'] });
    });

    it('disables the role checkboxes while Hide AI usage is on', async () => {
        await renderSection({ hidden: true });

        expect(hideCheckbox()).toHaveAttribute('data-state', 'checked');
        expect(hideCheckbox()).toBeEnabled();
        expect(roleCheckbox('Admin')).toBeDisabled();
        expect(roleCheckbox('Owner')).toBeDisabled();
        expect(roleCheckbox('Developer')).toBeDisabled();
        expect(roleCheckbox('User')).toBeDisabled();
    });

    it('writes the remaining roles when one is unchecked from the default all-visible state', async () => {
        const { onChange } = await renderSection(undefined);

        await userEvent.click(roleCheckbox('Developer'));

        expect(onChange).toHaveBeenCalledWith({ visibleToRoles: ['admin', 'owner', 'user'] });
    });

    it('unsets the role list once every role is checked again', async () => {
        const { onChange } = await renderSection({ visibleToRoles: ['admin', 'owner', 'user'] });

        await userEvent.click(roleCheckbox('Developer'));

        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('turns Hide on instead of saving an empty role list when the last role is unchecked', async () => {
        const { onChange } = await renderSection({ visibleToRoles: ['admin'] });

        await userEvent.click(roleCheckbox('Admin'));

        expect(onChange).toHaveBeenCalledWith({ hidden: true });
    });

    it('keeps roles in schema order when a role is added back', async () => {
        const { onChange } = await renderSection({ visibleToRoles: ['user'] });

        await userEvent.click(roleCheckbox('Admin'));

        expect(onChange).toHaveBeenCalledWith({ visibleToRoles: ['admin', 'user'] });
    });

    it('does not patch anything while disabled', async () => {
        const onChange = vi.fn();

        renderWithProviders(<UsageSection value={undefined} onChange={onChange} disabled />);

        await userEvent.click(screen.getByRole('button', { name: /AI usage/i }));
        const checkbox = await screen.findByRole('checkbox', { name: 'Hide AI usage' });

        expect(checkbox).toBeDisabled();
        expect(onChange).not.toHaveBeenCalled();
    });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installScrollIntoViewShim, installWebAnimationsShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';
import type { AppType } from '@/types/admin';

import type { AppUiConfig } from '../schema';

import AppPaneSection from './app-pane-section';

installWebAnimationsShims();
installPointerCaptureShims();
installScrollIntoViewShim();

const linkedApp = (refName: string, name: string): AppType => ({ _id: refName, refName, name }) as AppType;

const linkedApps = [linkedApp('scout-app', 'Scout App'), linkedApp('pipeline-app', 'Pipeline App')];

const renderSection = async (value: AppUiConfig['app'], apps: AppType[] | undefined = linkedApps) => {
    const onChange = vi.fn();

    renderWithProviders(<AppPaneSection value={value} apps={apps} onChange={onChange} getError={() => undefined} />);

    await userEvent.click(screen.getByRole('button', { name: /App pane/i }));
    await screen.findByText('Assistant label');

    return { onChange };
};

describe('AppPaneSection', () => {
    it('renders the four app-pane controls', async () => {
        await renderSection({ refName: 'scout-app' });

        expect(screen.getByText('App')).toBeInTheDocument();
        expect(screen.getByText('Assistant label')).toBeInTheDocument();
        expect(screen.getByText('Assistant side')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Assistant open by default/i })).toBeInTheDocument();
    });

    it('offers the agent linked apps as the app options', async () => {
        const user = userEvent.setup();

        await renderSection({ refName: '' });

        await user.click(screen.getAllByRole('combobox')[0]);

        expect(await screen.findByText('Scout App')).toBeInTheDocument();
        expect(screen.getByText('Pipeline App')).toBeInTheDocument();
    });

    it('patches refName with the picked app', async () => {
        const user = userEvent.setup();
        const { onChange } = await renderSection({ refName: '' });

        await user.click(screen.getAllByRole('combobox')[0]);
        await user.click(await screen.findByText('Pipeline App'));

        expect(onChange).toHaveBeenCalledWith({ refName: 'pipeline-app' });
    });

    it('tells the admin to attach an app when the agent has none linked', async () => {
        await renderSection({ refName: '' }, []);

        expect(screen.getByText(/Attach an app in the Apps tab/i)).toBeInTheDocument();
        expect(screen.queryByText('Scout App')).not.toBeInTheDocument();
    });

    it('shows a stored refName that is no longer linked, instead of an empty-looking select', async () => {
        await renderSection({ refName: 'unlinked-app' });

        expect(screen.getByText('unlinked-app (not linked)')).toBeInTheDocument();
        expect(screen.getByText(/is not linked to this agent/i)).toBeInTheDocument();
    });

    it('shows a stored refName even when the agent links no apps at all', async () => {
        await renderSection({ refName: 'unlinked-app' }, []);

        expect(screen.getByText('unlinked-app (not linked)')).toBeInTheDocument();
        expect(screen.queryByText(/Attach an app in the Apps tab/i)).not.toBeInTheDocument();
    });

    it('patches the assistant label without dropping refName', async () => {
        const user = userEvent.setup();
        const { onChange } = await renderSection({ refName: 'scout-app' });

        await user.type(screen.getByPlaceholderText('Assistant'), 'S');

        expect(onChange).toHaveBeenCalledWith({ refName: 'scout-app', assistantLabel: 'S' });
    });

    it('patches assistantDefaultOpen from the toggle', async () => {
        const user = userEvent.setup();
        const { onChange } = await renderSection({ refName: 'scout-app' });

        await user.click(screen.getByRole('checkbox', { name: /Assistant open by default/i }));

        expect(onChange).toHaveBeenCalledWith({ refName: 'scout-app', assistantDefaultOpen: true });
    });

    it('patches assistantSide from the side select', async () => {
        const user = userEvent.setup();
        const { onChange } = await renderSection({ refName: 'scout-app' });

        await user.click(screen.getAllByRole('combobox')[1]);
        await user.click(await screen.findByText('Left'));

        expect(onChange).toHaveBeenCalledWith({ refName: 'scout-app', assistantSide: 'left' });
    });
});

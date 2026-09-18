import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { sampleLauncher } from '@/test/fixtures/agents';
import { renderWithProviders } from '@/test/test-utils';
import type { LauncherType } from '@/types/admin';

import AgentCard from './agent-card';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const agent = {
    ...sampleLauncher,
    createdAt: daysAgo(19),
    updatedAt: daysAgo(2),
    lastInteractedAt: daysAgo(1),
} as LauncherType;

const neverUsedAgent = { ...agent, lastInteractedAt: null } as LauncherType;

describe('AgentCard timestamps', () => {
    it('shows the bare last-used time for an owned agent, labelled only on hover', () => {
        renderWithProviders(<AgentCard agent={agent} isOwned />);

        expect(screen.getByText('1 day ago')).toBeInTheDocument();
        expect(screen.queryByText(/^Last used 1 day ago$/)).not.toBeInTheDocument();
        expect(screen.getByText(/^Last used at: /)).toBeInTheDocument();
    });

    it('falls back to the created date when the agent has never been used, named only on hover', () => {
        renderWithProviders(<AgentCard agent={neverUsedAgent} isOwned />);

        expect(screen.getByText('19 days ago')).toBeInTheDocument();
        expect(screen.queryByText(/^Created 19 days ago$/)).not.toBeInTheDocument();
        expect(screen.getByText(/^Created at: /)).toBeInTheDocument();
    });

    it('keeps copy in the slot for an owned agent carrying neither date', () => {
        const undated = { ...agent, lastInteractedAt: null, createdAt: undefined } as unknown as LauncherType;

        renderWithProviders(<AgentCard agent={undated} isOwned />);

        expect(screen.getByText('Not used yet')).toBeInTheDocument();
    });

    it('leaves a firmwide tile unchanged', () => {
        renderWithProviders(<AgentCard agent={agent} />);

        expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('passes every timestamp to the details dialog of an owned agent', async () => {
        const user = userEvent.setup();

        renderWithProviders(<AgentCard agent={agent} isOwned />);

        await user.click(screen.getByRole('button', { name: `View ${agent.name} details` }));

        expect(await screen.findByText('Created 19 days ago')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toHaveTextContent('Updated 2 days ago');
        expect(screen.getByRole('dialog')).toHaveTextContent('Last used 1 day ago');
    });

    it('marks an owned agent that has never been used in the details dialog', async () => {
        const user = userEvent.setup();

        renderWithProviders(<AgentCard agent={neverUsedAgent} isOwned />);

        await user.click(screen.getByRole('button', { name: `View ${agent.name} details` }));

        expect(await screen.findByRole('dialog')).toHaveTextContent('Not used yet');
    });

    it('keeps the details dialog of a firmwide tile free of timestamps', async () => {
        const user = userEvent.setup();

        renderWithProviders(<AgentCard agent={agent} />);

        await user.click(screen.getByRole('button', { name: `View ${agent.name} details` }));

        expect(await screen.findByRole('dialog')).not.toHaveTextContent(/Created|Updated|Last used|Not used yet/);
    });
});

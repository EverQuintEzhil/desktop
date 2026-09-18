import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import CreateAgent from './create-agent';
import { createDraftAgent } from './lib/create-agent-api';

vi.mock('./lib/create-agent-api', () => ({
    createDraftAgent: vi.fn(),
}));

const renderCreateAgentRoute = () =>
    renderWithProviders(
        <Routes>
            <Route path="/agent-builder" element={<CreateAgent />} />
            <Route path="/agent-builder/:id" element={<div>Editor shell</div>} />
        </Routes>,
        { route: '/agent-builder' },
    );

describe('CreateAgent', () => {
    beforeEach(() => {
        vi.mocked(createDraftAgent).mockReset();
    });

    it('renders the create-agent heading and back button', () => {
        renderCreateAgentRoute();

        expect(screen.getByText('Create a new agent')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /back to/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start blank' })).toBeInTheDocument();
    });

    it('creates a draft agent and navigates to the editor when starting blank', async () => {
        vi.mocked(createDraftAgent).mockResolvedValue({ _id: 'agent-123' } as never);

        const user = userEvent.setup();

        renderCreateAgentRoute();

        await user.click(screen.getByRole('button', { name: 'Start blank' }));

        await waitFor(() => {
            expect(screen.getByText('Editor shell')).toBeInTheDocument();
        });

        expect(createDraftAgent).toHaveBeenCalledTimes(1);
    });

    it('creates a draft agent and navigates to the editor when submitting a prompt', async () => {
        vi.mocked(createDraftAgent).mockResolvedValue({ _id: 'agent-456' } as never);

        const { container } = renderCreateAgentRoute();
        const composerInput = container.querySelector('.ca-entry__composer-input') as HTMLElement;

        composerInput.textContent = 'Build me a bot';
        Object.defineProperty(composerInput, 'innerText', { value: 'Build me a bot', configurable: true });
        fireEvent.input(composerInput);

        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() => {
            expect(screen.getByText('Editor shell')).toBeInTheDocument();
        });

        expect(createDraftAgent).toHaveBeenCalledTimes(1);
    });
});

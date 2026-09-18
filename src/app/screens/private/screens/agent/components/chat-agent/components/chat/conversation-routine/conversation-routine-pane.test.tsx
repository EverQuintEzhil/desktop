import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearManualRunWindow } from '@/lib/api/app/routines';
import { envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import { ChatSidePanelProvider, useChatSidePanel } from '../conversation-files/chat-files-panel-context';

import ConversationRoutinePane from './conversation-routine-pane';

const agent = { _id: 'agent-1', name: 'Research', slug: 'research' } as unknown as ChatAgentType;

const run = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: 'run-1',
    routineId: 'routine-1',
    status: 'completed',
    trigger: 'schedule',
    conversationId: 'conv-1',
    error: '',
    startedAt: '2026-08-22T09:00:00.000Z',
    finishedAt: '2026-08-22T09:05:00.000Z',
    isRead: true,
    routine: {
        _id: 'routine-1',
        name: 'Weekly competitor scan',
        agentId: 'agent-1',
        agent: { _id: 'agent-1', name: 'Research', slug: 'research' },
    },
    createdAt: '2026-08-22T09:00:00.000Z',
    updatedAt: '2026-08-22T09:05:00.000Z',
    ...overrides,
});

const OpenPaneProbe = () => {
    const { open } = useChatSidePanel();

    return (
        <button type="button" onClick={() => open('routine')}>
            open pane
        </button>
    );
};

interface SetupOptions {
    runs?: Record<string, unknown>[];
    detail?: Record<string, unknown> | null;
}

const setup = async ({ runs = [run()], detail = null }: SetupOptions = {}) => {
    const detailCalls = { count: 0 };

    server.use(
        respond('get', '/routines/runs', () => pagedEnvelope(runs)),
        respond('get', '/routines/routine-1/runs', () => pagedEnvelope(runs)),
        respond('get', '/routines/routine-1/runs/run-1', () => {
            detailCalls.count += 1;

            return detail ? envelope(detail) : httpError(404, 'Not found');
        }),
    );

    const { queryClient } = renderWithProviders(
        <ChatSidePanelProvider>
            <OpenPaneProbe />
            <ConversationRoutinePane agent={agent} conversationId="conv-1" />
        </ChatSidePanelProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'open pane' }));
    await screen.findByText('Runs');

    return { detailCalls, queryClient };
};

describe('ConversationRoutinePane', () => {
    beforeEach(() => {
        clearManualRunWindow();
        window.innerWidth = 1440;
    });

    it('gives the reason a run was skipped', async () => {
        await setup({
            runs: [run({ status: 'skipped', error: 'the previous run is still going.', conversationId: 'conv-1' })],
            detail: { ...run({ status: 'skipped', error: 'the previous run is still going.' }), steps: [] },
        });

        expect(await screen.findByText('Skipped — the previous run is still going.')).toBeInTheDocument();
    });

    it('keeps the run list and the routine link when run detail is unavailable', async () => {
        await setup({ detail: null });

        expect(await screen.findByText('Runs')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Open routine/ })).toBeInTheDocument();
    });
    it('dots a run whose report has not been read yet', async () => {
        await setup({ runs: [run({ isRead: false })] });

        expect(await screen.findByLabelText('New response ready')).toBeInTheDocument();
    });

    /**
     * Asserted as an ABSENCE on purpose. A reconnect button here was built and then removed: chat
     * already answers a dead connector with its own inline reconnect card, and this list is per run,
     * so several failed runs stacked several identical buttons for one fix. The sentence names the
     * connector and is the whole affordance. Re-adding the button should fail here rather than pass
     * quietly — the routines detail screen is where that button belongs.
     */
    it('names the connector in prose and offers no reconnect button of its own', async () => {
        await setup({
            runs: [
                run({
                    status: 'needs_reconnect',
                    isRead: false,
                    conversationId: null,
                    error: 'The "Linear" connector needs reconnecting before this routine can run.',
                    errorCode: 'CONNECTOR_REAUTH_REQUIRED',
                    errorContext: { connectorId: 'srv-1', connectorName: 'Linear' },
                }),
            ],
        });

        // The positive signal first: waiting on an absence alone can pass before the run ever renders.
        expect(
            await screen.findByText('The "Linear" connector needs reconnecting before this routine can run.'),
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Reconnect/ })).not.toBeInTheDocument();
    });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Toaster, toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { JobType } from '@/types/admin';

import { showGenerationFailedToast } from './show-generation-failed-toast';

installPointerCaptureShims();

const job = (overrides: Record<string, unknown> = {}): JobType =>
    ({
        _id: 'job-1',
        message: 'A cat on a bicycle',
        status: 'failed',
        agentId: { _id: 'agent-1', slug: 'gallery-agent' },
        ...overrides,
    }) as unknown as JobType;

const renderToaster = () => renderWithProviders(<Toaster />);

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

describe('showGenerationFailedToast', () => {
    afterEach(() => {
        toast.dismiss();

        if (originalClipboard) {
            Object.defineProperty(navigator, 'clipboard', originalClipboard);
        } else {
            Reflect.deleteProperty(navigator, 'clipboard');
        }
    });

    it('shows the prompt and a generic failure line', async () => {
        renderToaster();
        showGenerationFailedToast({ job: job() });

        expect(await screen.findByText('A cat on a bicycle')).toBeInTheDocument();
        expect(screen.getByText('Generation failed')).toBeInTheDocument();
    });

    it('falls back to "Untitled" for a job with no prompt', async () => {
        renderToaster();
        showGenerationFailedToast({ job: job({ message: '' }) });

        expect(await screen.findByText('Untitled')).toBeInTheDocument();
    });

    it('shows the failure reason inline when there is one', async () => {
        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }) });

        expect(await screen.findByText('Model timed out')).toBeInTheDocument();
    });

    it('navigates to the agent when there is nothing more to show', async () => {
        const user = userEvent.setup();
        const onNavigate = vi.fn();

        renderToaster();
        showGenerationFailedToast({ job: job(), onNavigate });

        await user.click(await screen.findByText('A cat on a bicycle'));

        expect(onNavigate).toHaveBeenCalledWith('/agent/gallery-agent');
    });

    it('opens the detail dialog instead when a failure reason exists', async () => {
        const user = userEvent.setup();
        const onNavigate = vi.fn();

        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }), onNavigate });

        await user.click(await screen.findByText('A cat on a bicycle'));

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Generation Failed')).toBeInTheDocument();
        expect(within(dialog).getByText('Original Prompt')).toBeInTheDocument();
        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('does not open the dialog when the close affordance is used', async () => {
        const user = userEvent.setup();

        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }) });

        await user.click(await screen.findByRole('button', { name: 'Close toast' }));

        // Settle on the toast actually going away, then assert the close click did
        // not also take the detail dialog route.
        await waitFor(() => {
            expect(screen.queryByText('A cat on a bicycle')).not.toBeInTheDocument();
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('copies the prompt and the error to the clipboard', async () => {
        const user = userEvent.setup();
        // `userEvent.setup()` installs its own clipboard stub, so this has to come
        // after it. The `afterEach` above puts the original descriptor back.
        const writeText = vi.fn().mockResolvedValue(undefined);

        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }) });

        await user.click(await screen.findByText('A cat on a bicycle'));

        const dialog = await screen.findByRole('dialog');
        const copyButtons = within(dialog).getAllByRole('button', { name: 'Copy to clipboard' });

        await user.click(copyButtons[0]);
        expect(writeText).toHaveBeenCalledWith('A cat on a bicycle');

        await user.click(copyButtons[1]);
        expect(writeText).toHaveBeenCalledWith('Model timed out');
    });

    it('blocks Try Again while the prompt is empty', async () => {
        const user = userEvent.setup();

        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }) });

        await user.click(await screen.findByText('A cat on a bicycle'));

        const dialog = await screen.findByRole('dialog');

        await user.clear(within(dialog).getByPlaceholderText('Enter prompt...'));

        expect(within(dialog).getByText('Prompt cannot be empty')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /Try Again/ })).toBeDisabled();
    });

    it('requeues with only the job id when the prompt is untouched', async () => {
        const user = userEvent.setup();
        let body: unknown;

        server.use(
            http.post(apiUrl('/ai/job/requeue'), async ({ request }) => {
                body = await request.json();

                return envelope(null);
            }),
        );

        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }) });

        await user.click(await screen.findByText('A cat on a bicycle'));

        const dialog = await screen.findByRole('dialog');

        await user.click(within(dialog).getByRole('button', { name: /Try Again/ }));

        await waitFor(() => {
            expect(body).toEqual({ jobIds: ['job-1'] });
        });
    });

    it('sends the edited prompt and routes to the agent afterwards', async () => {
        const user = userEvent.setup();
        const onNavigate = vi.fn();
        let body: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/ai/job/requeue'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(null);
            }),
        );

        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }), onNavigate });

        await user.click(await screen.findByText('A cat on a bicycle'));

        const dialog = await screen.findByRole('dialog');
        const textarea = within(dialog).getByPlaceholderText('Enter prompt...');

        await user.clear(textarea);
        await user.type(textarea, 'A dog on a bicycle');
        await user.click(within(dialog).getByRole('button', { name: /Try Again/ }));

        await waitFor(() => {
            expect(body.prompt).toBe('A dog on a bicycle');
        });
        expect(onNavigate).toHaveBeenCalledWith('/agent/gallery-agent');
    });

    it('keeps the dialog open when the requeue fails', async () => {
        const user = userEvent.setup();
        let attempts = 0;

        server.use(
            respond('post', '/ai/job/requeue', () => {
                attempts += 1;

                return httpError(500);
            }),
        );

        renderToaster();
        showGenerationFailedToast({ job: job({ failReason: { message: 'Model timed out' } }) });

        await user.click(await screen.findByText('A cat on a bicycle'));

        const dialog = await screen.findByRole('dialog');

        await user.click(within(dialog).getByRole('button', { name: /Try Again/ }));

        // The dialog is already open, so waiting for it proves nothing. Wait for
        // the failing request to land, then assert it survived.
        await waitFor(() => {
            expect(attempts).toBe(1);
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('reads the agent slug off a job that carries an agent object instead', async () => {
        const user = userEvent.setup();
        const onNavigate = vi.fn();

        renderToaster();
        showGenerationFailedToast({
            job: job({ agentId: undefined, agent: { _id: 'agent-9', slug: 'other-agent' } }),
            onNavigate,
        });

        await user.click(await screen.findByText('A cat on a bicycle'));

        expect(onNavigate).toHaveBeenCalledWith('/agent/other-agent');
    });
});

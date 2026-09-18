import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';
import type { JobType } from '@/types/admin';

import Notifications from './notifications';

installPointerCaptureShims();

const makeJob = (overrides: Record<string, unknown> = {}): JobType =>
    ({
        _id: 'job-1',
        message: 'A cat on a bicycle',
        status: 'completed',
        ...overrides,
    }) as unknown as JobType;

interface RenderOptions {
    jobs?: JobType[];
    itemType?: 'image' | 'video';
    isJobsLoading?: boolean;
    onJobClick?: (job: JobType) => void;
    onCancelJob?: (job: JobType) => void | Promise<void>;
    onRequeue?: (job: JobType, prompt?: string) => void | Promise<void>;
}

const renderNotifications = (options: RenderOptions = {}) => {
    const {
        jobs = [makeJob()],
        itemType = 'image',
        isJobsLoading = false,
        onJobClick,
        onCancelJob,
        onRequeue,
    } = options;

    return renderWithProviders(
        <Notifications
            itemType={itemType}
            jobs={jobs}
            isJobsLoading={isJobsLoading}
            showMoreLoading={false}
            hasMore={false}
            onLoadMore={() => {}}
            loadMoreRef={{ current: null }}
            onJobClick={onJobClick}
            onCancelJob={onCancelJob}
            onRequeue={onRequeue}
        />,
    );
};

const getTrigger = (): HTMLElement => screen.getByRole('button', { name: 'Notifications' });

const openPopover = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(getTrigger());

    return screen.findByRole('dialog');
};

const getFailDialog = (name: 'Generation Failed' | 'Generation Cancelled') => screen.findByRole('dialog', { name });

describe('Notifications', () => {
    it('shows the clock trigger and no unread dot for jobs present on first render', () => {
        const { container } = renderNotifications();

        expect(getTrigger()).toBeInTheDocument();
        expect(container.querySelector('.notification-unread-dot')).toBeNull();
        expect(container.querySelector('.notification-pending-trigger')).toBeNull();
    });

    it('names the trigger in both the idle and the pending variant', () => {
        const { unmount } = renderNotifications();

        expect(screen.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-haspopup', 'dialog');

        unmount();

        renderNotifications({ jobs: [makeJob({ status: 'running' })] });

        const pendingTrigger = screen.getByRole('button', { name: 'Notifications' });

        expect(pendingTrigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(pendingTrigger).toHaveTextContent('1');
    });

    it('replaces the clock with a pending count while jobs are running', () => {
        renderNotifications({
            jobs: [
                makeJob({ _id: 'job-1', status: 'queued' }),
                makeJob({ _id: 'job-2', status: 'running' }),
                makeJob({ _id: 'job-3', status: 'completed' }),
            ],
        });

        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('marks a newly arrived job unread until the popover is opened', async () => {
        const user = userEvent.setup();
        const { container, rerender } = renderNotifications();

        rerender(
            <Notifications
                itemType="image"
                jobs={[makeJob({ _id: 'job-2', message: 'A dog on a skateboard' }), makeJob()]}
                isJobsLoading={false}
                showMoreLoading={false}
                hasMore={false}
                onLoadMore={() => {}}
                loadMoreRef={{ current: null }}
            />,
        );

        expect(container.querySelector('.notification-unread-dot')).not.toBeNull();

        await openPopover(user);

        await waitFor(() => {
            expect(container.querySelector('.notification-unread-dot')).toBeNull();
        });
    });

    it('shows three skeleton rows while the first page is loading', async () => {
        const user = userEvent.setup();

        renderNotifications({ jobs: [], isJobsLoading: true });

        const popover = await openPopover(user);

        expect(popover.querySelectorAll('.notification-skeleton-item')).toHaveLength(3);
    });

    it('reports an empty notification list', async () => {
        const user = userEvent.setup();

        renderNotifications({ jobs: [] });

        const popover = await openPopover(user);

        expect(within(popover).getByText('No recent items')).toBeInTheDocument();
    });

    it('renders one row per job and falls back to Untitled with no prompt', async () => {
        const user = userEvent.setup();

        renderNotifications({
            jobs: [makeJob(), makeJob({ _id: 'job-2', message: '' })],
        });

        const popover = await openPopover(user);

        expect(popover.querySelectorAll('.notification-list-item')).toHaveLength(2);
        expect(within(popover).getByText('A cat on a bicycle')).toBeInTheDocument();
        expect(within(popover).getByText('Untitled')).toBeInTheDocument();
    });

    it('labels a finished job with the media type', async () => {
        const user = userEvent.setup();

        renderNotifications({ itemType: 'video' });

        const popover = await openPopover(user);

        expect(within(popover).getByText('Video')).toBeInTheDocument();
    });

    it('labels a queued job as Queued', async () => {
        const user = userEvent.setup();

        renderNotifications({ jobs: [makeJob({ status: 'queued' })] });

        const popover = await openPopover(user);

        expect(within(popover).getByText('Queued')).toBeInTheDocument();
    });

    it('labels a failed job and rewrites the known exhaustion message', async () => {
        const user = userEvent.setup();

        renderNotifications({
            jobs: [makeJob({ status: 'failed', failReason: { message: 'No image generated.' } })],
        });

        const popover = await openPopover(user);

        expect(within(popover).getByText('Generation failed')).toBeInTheDocument();
        expect(within(popover).getByText('Resource has been exhausted.')).toBeInTheDocument();
    });

    it('labels both cancelled and killed jobs as Cancelled', async () => {
        const user = userEvent.setup();

        renderNotifications({
            jobs: [makeJob({ _id: 'job-1', status: 'cancelled' }), makeJob({ _id: 'job-2', status: 'killed' })],
        });

        const popover = await openPopover(user);

        expect(within(popover).getAllByText('Cancelled')).toHaveLength(2);
    });

    it('labels a job whose output has been deleted', async () => {
        const user = userEvent.setup();

        renderNotifications({
            jobs: [makeJob({ status: 'completed', output: [{ identifier: 'f1', isDeleted: true }] })],
        });

        const popover = await openPopover(user);

        expect(within(popover).getByText('Image Deleted')).toBeInTheDocument();
    });

    it('leaves a job with an empty output array unmarked as deleted', async () => {
        const user = userEvent.setup();

        renderNotifications({ jobs: [makeJob({ status: 'completed', output: [] })] });

        const popover = await openPopover(user);

        expect(within(popover).queryByText('Image Deleted')).toBeNull();
        expect(within(popover).getByAltText('A cat on a bicycle')).toBeInTheDocument();
    });

    it('labels a retry-queued job as Retrying...', async () => {
        const user = userEvent.setup();

        renderNotifications({ jobs: [makeJob({ status: 'retry-queued' })] });

        const popover = await openPopover(user);

        expect(within(popover).getByText('Retrying...')).toBeInTheDocument();
    });

    it('reports a finished job to the caller and closes the popover', async () => {
        const user = userEvent.setup();
        const onJobClick = vi.fn();
        const job = makeJob();

        renderNotifications({ jobs: [job], onJobClick });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        expect(onJobClick).toHaveBeenCalledWith(job);
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).toBeNull();
        });
    });

    it('opens the failure dialog instead of reporting a failed job', async () => {
        const user = userEvent.setup();
        const onJobClick = vi.fn();

        renderNotifications({
            jobs: [makeJob({ status: 'failed', failReason: { message: 'Model timed out' } })],
            onJobClick,
        });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        expect(await getFailDialog('Generation Failed')).toBeInTheDocument();
        expect(onJobClick).not.toHaveBeenCalled();
    });

    it('requeues a failed job from the row button', async () => {
        const user = userEvent.setup();
        const onRequeue = vi.fn();
        const job = makeJob({ status: 'failed' });

        renderNotifications({ jobs: [job], onRequeue });

        const popover = await openPopover(user);

        await user.click(within(popover).getByRole('button', { name: 'Try again with recent prompt' }));

        expect(onRequeue).toHaveBeenCalledWith(job, undefined);
    });

    it('cancels a pending job through the confirmation modal', async () => {
        const user = userEvent.setup();
        const onCancelJob = vi.fn();
        const job = makeJob({ status: 'running' });

        renderNotifications({ jobs: [job], onCancelJob });

        const popover = await openPopover(user);

        await user.click(within(popover).getByRole('button', { name: 'Cancel generation' }));

        const confirm = await screen.findByRole('alertdialog');

        expect(within(confirm).getByText('Are you sure you want to cancel this generation?')).toBeInTheDocument();

        await user.click(within(confirm).getByRole('button', { name: 'Yes, cancel' }));

        expect(onCancelJob).toHaveBeenCalledWith(job);
        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });
    });

    it('holds the confirmation open and disables confirm while the cancel is in flight', async () => {
        const user = userEvent.setup();
        const onCancelJob = vi.fn().mockReturnValue(new Promise<void>(() => {}));

        renderNotifications({
            jobs: [makeJob({ status: 'running' })],
            onCancelJob,
        });

        const popover = await openPopover(user);

        await user.click(within(popover).getByRole('button', { name: 'Cancel generation' }));

        const confirm = await screen.findByRole('alertdialog');

        await user.click(within(confirm).getByRole('button', { name: 'Yes, cancel' }));

        expect(onCancelJob).toHaveBeenCalled();
        await waitFor(() => {
            expect(within(confirm).getByRole('button', { name: 'Yes, cancel' })).toBeDisabled();
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('reports a rejected cancel and keeps the confirmation open', async () => {
        const user = userEvent.setup();
        const onCancelJob = vi.fn().mockRejectedValue(new Error('network down'));

        renderWithProviders(<Toaster />);
        renderNotifications({ jobs: [makeJob({ status: 'running' })], onCancelJob });

        const popover = await openPopover(user);

        await user.click(within(popover).getByRole('button', { name: 'Cancel generation' }));

        const confirm = await screen.findByRole('alertdialog');

        await user.click(within(confirm).getByRole('button', { name: 'Yes, cancel' }));

        expect(await screen.findByText('Failed to cancel generation')).toBeInTheDocument();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        await waitFor(() => {
            expect(within(confirm).getByRole('button', { name: 'Yes, cancel' })).toBeEnabled();
        });
    });

    it('closes the confirmation without cancelling', async () => {
        const user = userEvent.setup();
        const onCancelJob = vi.fn();

        renderNotifications({
            jobs: [makeJob({ status: 'running' })],
            onCancelJob,
        });

        const popover = await openPopover(user);

        await user.click(within(popover).getByRole('button', { name: 'Cancel generation' }));

        const confirm = await screen.findByRole('alertdialog');

        await user.click(within(confirm).getByRole('button', { name: 'Keep' }));

        expect(onCancelJob).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });
    });

    it('titles the dialog Generation Cancelled and drops the error section', async () => {
        const user = userEvent.setup();

        renderNotifications({
            jobs: [makeJob({ status: 'killed', failReason: { message: 'Model timed out' } })],
        });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Cancelled');

        expect(within(dialog).queryByText('Error')).toBeNull();
        expect(within(dialog).queryByText('Model timed out')).toBeNull();
    });

    it('falls back to a generic error line when the job carries no reason', async () => {
        const user = userEvent.setup();

        renderNotifications({ jobs: [makeJob({ status: 'failed' })] });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');

        expect(within(dialog).getByText('No additional error details are available for this job.')).toBeInTheDocument();
    });

    it('shows the model card from a populated modelId', async () => {
        const user = userEvent.setup();

        renderNotifications({
            jobs: [makeJob({ status: 'failed', modelId: { _id: 'm1', model: 'imagen-3', provider: 'google' } })],
        });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');

        expect(within(dialog).getByText('imagen-3')).toBeInTheDocument();
        expect(within(dialog).getByText('google')).toBeInTheDocument();
    });

    it('prefers the model refName when only the expanded model is present', async () => {
        const user = userEvent.setup();

        renderNotifications({
            jobs: [
                makeJob({
                    status: 'failed',
                    model: { refName: 'flux_pro', model: 'flux-1.1', provider: 'bfl' },
                }),
            ],
        });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');

        expect(within(dialog).getByText('flux_pro')).toBeInTheDocument();
        expect(within(dialog).queryByText('flux-1.1')).toBeNull();
    });

    it('omits the model card when the job names no model', async () => {
        const user = userEvent.setup();

        renderNotifications({ jobs: [makeJob({ status: 'failed' })] });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');

        expect(within(dialog).queryByText('Model')).toBeNull();
    });

    it('copies the original prompt and the error text', async () => {
        const user = userEvent.setup();
        // `userEvent.setup()` installs its own clipboard stub, so spy after it.
        const writeText = vi.spyOn(navigator.clipboard, 'writeText');

        renderNotifications({
            jobs: [makeJob({ status: 'failed', failReason: { message: 'Model timed out' } })],
        });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');
        const [copyPrompt, copyError] = within(dialog).getAllByRole('button', { name: 'Copy to clipboard' });

        await user.click(copyPrompt);
        expect(writeText).toHaveBeenCalledWith('A cat on a bicycle');

        await user.click(copyError);
        expect(writeText).toHaveBeenCalledWith('Model timed out');
    });

    it('blocks Try Again while the prompt is empty', async () => {
        const user = userEvent.setup();
        const onRequeue = vi.fn();

        renderNotifications({ jobs: [makeJob({ status: 'failed' })], onRequeue });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');

        await user.clear(within(dialog).getByRole('textbox'));

        expect(within(dialog).getByText('Prompt cannot be empty')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Try Again' })).toBeDisabled();
        expect(onRequeue).not.toHaveBeenCalled();
    });

    it('requeues with no prompt override when the text is untouched', async () => {
        const user = userEvent.setup();
        const onRequeue = vi.fn();
        const job = makeJob({ status: 'failed' });

        renderNotifications({ jobs: [job], onRequeue });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');

        await user.click(within(dialog).getByRole('button', { name: 'Try Again' }));

        expect(onRequeue).toHaveBeenCalledWith(job, undefined);
    });

    it('requeues with the edited prompt', async () => {
        const user = userEvent.setup();
        const onRequeue = vi.fn();
        const job = makeJob({ status: 'failed' });

        renderNotifications({ jobs: [job], onRequeue });

        const popover = await openPopover(user);

        await user.click(within(popover).getByText('A cat on a bicycle'));

        const dialog = await getFailDialog('Generation Failed');
        const textbox = within(dialog).getByRole('textbox');

        await user.clear(textbox);
        await user.type(textbox, 'A dog on a skateboard');
        await user.click(within(dialog).getByRole('button', { name: 'Try Again' }));

        expect(onRequeue).toHaveBeenCalledWith(job, 'A dog on a skateboard');
    });
});

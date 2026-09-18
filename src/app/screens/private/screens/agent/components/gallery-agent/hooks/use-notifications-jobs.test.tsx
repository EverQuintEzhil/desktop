import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { httpError, envelope, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { JobType } from '@/types/admin';

import { Notifications } from '../components/notifications';

import { useNotificationsJobs } from './use-notifications-jobs';

installPointerCaptureShims();

const AGENT_ID = 'agent-1';

const runningJob = {
    _id: 'job-1',
    message: 'A cat on a bicycle',
    status: 'running',
} as unknown as JobType;

const NotificationsHarness = () => {
    const { jobs, isJobsLoading, showMoreLoading, hasMore, onLoadMore, loadMoreRef, cancelJob } = useNotificationsJobs({
        agentId: AGENT_ID,
    });

    return (
        <Notifications
            itemType="image"
            jobs={jobs}
            isJobsLoading={isJobsLoading}
            showMoreLoading={showMoreLoading}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            loadMoreRef={loadMoreRef}
            onCancelJob={(job) => cancelJob(job._id)}
        />
    );
};

const renderHarness = () =>
    renderWithProviders(
        <>
            <Toaster />
            <NotificationsHarness />
        </>,
    );

const openCancelConfirmation = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));

    const popover = await screen.findByRole('dialog');

    await user.click(await within(popover).findByRole('button', { name: 'Cancel generation' }));

    return screen.findByRole('alertdialog');
};

describe('useNotificationsJobs wired to Notifications', () => {
    it('keeps the confirmation open and reports one error when the cancel request fails', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/jobs', () => pagedEnvelope([runningJob])),
            respond('post', '/jobs/job-1/kill', () => httpError(500)),
        );

        renderHarness();

        const confirm = await openCancelConfirmation(user);

        await user.click(within(confirm).getByRole('button', { name: 'Yes, cancel' }));

        await waitFor(() => {
            expect(screen.getAllByText('Failed to cancel generation')).toHaveLength(1);
        });
        // The `alertdialog` assertion is what discriminates the defect: a `cancelJob` that
        // swallows the failure also toasts exactly once, but closes the confirmation.
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(within(confirm).getByRole('button', { name: 'Yes, cancel' })).toBeEnabled();
        expect(screen.queryByText('Generation Cancelled')).toBeNull();
    });

    it('reports a successful cancel even when the follow-up refresh fails', async () => {
        const user = userEvent.setup();
        let jobsRequests = 0;

        server.use(
            respond('get', '/jobs', () => {
                jobsRequests += 1;

                return jobsRequests === 1 ? pagedEnvelope([runningJob]) : httpError(500);
            }),
            respond('post', '/jobs/job-1/kill', () => envelope(null)),
        );

        renderHarness();

        const confirm = await openCancelConfirmation(user);

        await user.click(within(confirm).getByRole('button', { name: 'Yes, cancel' }));

        expect(await screen.findByText('Generation Cancelled')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });
        expect(screen.queryByText('Failed to cancel generation')).toBeNull();
    });
});

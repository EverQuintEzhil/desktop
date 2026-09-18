import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installPointerCaptureShims } from '@/test/dom-shims';
import { envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import { routineConnectorSchema } from '@/types/routines';

import ConnectorHealthBanner from './connector-health-banner';

installPointerCaptureShims();

/**
 * The absence assertions below need a positive signal first: without waiting for the read to land,
 * "no warning" passes while the query is still in flight and would pass with the query removed.
 */
let asked: string[] = [];

const onRequest = ({ request }: { request: Request }) => {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/routines/connector-health')) asked.push(url.searchParams.get('agentId') ?? '');
};

beforeEach(() => {
    asked = [];
    server.events.on('request:start', onRequest);
});

afterEach(() => server.events.removeListener('request:start', onRequest));

const stub = (connectors: Record<string, unknown>[]) =>
    server.use(respond('get', '/routines/connector-health', () => envelope({ connectors })));

const render = () => renderWithProviders(<ConnectorHealthBanner agentId="agent-1" />);

const waitForRead = () => waitFor(() => expect(asked).toHaveLength(1));

describe('ConnectorHealthBanner', () => {
    it('offers one action chip per disconnected connector, each targeting that connector', async () => {
        stub([
            { _id: 'conn-1', name: 'Microsoft 365 (PW)', health: 'needs_reconnect' },
            { _id: 'conn-2', name: 'Miro', health: 'needs_reconnect' },
            { _id: 'conn-3', name: 'Firecrawl', health: 'ready' },
        ]);

        render();

        const first = await screen.findByRole('link', { name: 'Reconnect Microsoft 365 (PW)' });

        expect(first).toHaveAttribute('href', '/settings/connectors/conn-1');
        expect(screen.getByRole('link', { name: 'Reconnect Miro' })).toHaveAttribute(
            'href',
            '/settings/connectors/conn-2',
        );
        // A ready connector gets no chip; the row is what needs acting on, not an inventory.
        expect(screen.queryByRole('link', { name: /Firecrawl/ })).not.toBeInTheDocument();
        // The row names the state; it never claims this routine needs any particular connector.
        expect(screen.getByRole('group', { name: 'Needs reconnecting' })).toBeInTheDocument();
    });

    it('opens every chip in a new tab, since the form has no unsaved-changes guard', async () => {
        stub([{ _id: 'conn-1', name: 'Miro', health: 'needs_reconnect' }]);

        render();

        expect(await screen.findByRole('link', { name: 'Reconnect Miro' })).toHaveAttribute('target', '_blank');
    });

    it('falls back to the connectors list for an id that would not make a path', async () => {
        stub([{ _id: 'conn/1?x', name: 'Miro', health: 'needs_reconnect' }]);

        render();

        expect(await screen.findByRole('link', { name: 'Reconnect Miro' })).toHaveAttribute(
            'href',
            '/settings/connectors',
        );
    });

    it('asks by the agent id, which is the only thing the endpoint accepts', async () => {
        stub([]);

        render();

        await waitForRead();
        expect(asked[0]).toBe('agent-1');
    });

    it('re-reads the health on focus, since the reconnect it points to happens in another tab', async () => {
        stub([{ _id: 'conn-1', name: 'Miro', health: 'needs_reconnect' }]);

        render();

        await screen.findByRole('link', { name: 'Reconnect Miro' });
        expect(asked).toHaveLength(1);

        // The other tab's invalidateConnectorSurfaces cannot reach this tab's QueryClient, so coming
        // back has to be what re-reads it. A fresh row would skip a merely-true refetchOnWindowFocus.
        // query-core listens on `window`, not `document`.
        window.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() => expect(asked).toHaveLength(2));
    });

    /**
     * jsdom has no layout, so the alignment this guards cannot be asserted in pixels - but the
     * structure it depends on can. The dismiss button must not share the wrapping box with the
     * chips: as a sibling of theirs it rides the wrap onto the last line, which is how it shipped
     * and what a browser measurement caught (its centre sat on row 2, not on the label's row).
     */
    it('keeps the dismiss button out of the box the chips wrap inside', async () => {
        stub([
            { _id: 'conn-1', name: 'Microsoft 365 (PW)', health: 'needs_reconnect' },
            { _id: 'conn-2', name: 'Microsoft 365 TEST (EQ)', health: 'needs_reconnect' },
        ]);

        render();

        const chip = await screen.findByRole('link', { name: 'Reconnect Microsoft 365 (PW)' });
        const dismiss = screen.getByRole('button', { name: 'Dismiss the connectors needing a reconnect' });

        expect(chip.parentElement).not.toContainElement(dismiss);
        expect(chip.parentElement).toContainElement(
            screen.getByRole('link', { name: 'Reconnect Microsoft 365 TEST (EQ)' }),
        );
    });

    it('can be dismissed for this visit, and does not remember it for the next one', async () => {
        stub([{ _id: 'conn-1', name: 'Miro', health: 'needs_reconnect' }]);

        const { unmount } = render();

        await screen.findByRole('link', { name: 'Reconnect Miro' });
        await userEvent.click(screen.getByRole('button', { name: 'Dismiss the connectors needing a reconnect' }));

        expect(screen.queryByRole('link', { name: 'Reconnect Miro' })).not.toBeInTheDocument();

        unmount();
        render();

        // A remembered dismissal on a form is a way to ship a routine that cannot run, unseen.
        expect(await screen.findByRole('link', { name: 'Reconnect Miro' })).toBeInTheDocument();
    });

    it('ignores a connector nobody ever set up, which is most of an agent list', async () => {
        stub([
            { _id: 'conn-1', name: 'Miro', health: 'not_connected' },
            { _id: 'conn-2', name: 'Adobe Sign', health: 'not_connected' },
        ]);

        render();

        await waitForRead();
        // The api gates its own 424 on needs_reconnect alone for the same reason: warning about every
        // never-connected connector would bury the one that actually broke.
        expect(screen.queryByRole('group', { name: 'Needs reconnecting' })).not.toBeInTheDocument();
        // And the state is KEPT rather than caught as ready, so it stays available to render later.
        expect(routineConnectorSchema.parse({ _id: 'conn-1', name: 'Miro', health: 'not_connected' }).health).toBe(
            'not_connected',
        );
    });

    it('says nothing when every connector is ready', async () => {
        stub([{ _id: 'conn-1', name: 'Firecrawl', health: 'ready' }]);

        render();

        await waitForRead();
        expect(screen.queryByRole('group', { name: 'Needs reconnecting' })).not.toBeInTheDocument();
    });

    it('treats a health value it does not know as ready rather than warning falsely', async () => {
        stub([{ _id: 'conn-1', name: 'Firecrawl', health: 'degraded_somehow' }]);

        render();

        await waitForRead();
        expect(screen.queryByRole('group', { name: 'Needs reconnecting' })).not.toBeInTheDocument();
        // Asserted on the schema too: the row renders nothing either way, so the DOM alone cannot
        // tell "kept, and read as ready" from "dropped because it would not parse".
        expect(routineConnectorSchema.parse({ _id: 'conn-1', name: 'Firecrawl', health: 'degraded_somehow' })).toEqual({
            _id: 'conn-1',
            name: 'Firecrawl',
            health: 'ready',
        });
    });

    // Behavioural, not a guard on the `isError` branch specifically: a failed read also leaves `data`
    // undefined, so silence has two causes and the DOM cannot say which one produced it.
    it('stays silent when the health read fails, since a false warning is worse than none', async () => {
        server.use(respond('get', '/routines/connector-health', () => httpError(500, 'boom')));

        render();

        await waitForRead();
        expect(screen.queryByRole('group', { name: 'Needs reconnecting' })).not.toBeInTheDocument();
    });
});

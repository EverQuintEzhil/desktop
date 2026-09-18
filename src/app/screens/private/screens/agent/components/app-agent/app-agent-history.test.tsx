import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { installGalleryDomShims, installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { installWidthAwareMatchMedia } from '@/test/match-media';
import { apiUrl, envelope, httpError, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { AppAgentType } from '@/types/admin';

import AppAgent from './app-agent';

installGalleryDomShims();
installRichTextDomShims();
installScrollIntoViewShim();
// The assistant panel docks beside the app only from 1364px up; these tests are about the docked layout.
installWidthAwareMatchMedia(1600);

Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });

const appAgent = {
    _id: 'app-agent-1',
    slug: 'app-agent-1',
    identifier: 'app-agent-identifier-1',
    name: 'ESG',
    type: 'chat',
    apps: [],
    tools: [],
    uiConfig: {
        componentType: 'app',
        type: 'chat',
        app: { assistantDefaultOpen: true, assistantSide: 'right' },
        home: {
            title: 'ESG',
            search: { placeholder: 'Ask anything' },
            questions: ['Show me the current pipeline'],
        },
    },
} as unknown as AppAgentType;

// `user-1` is the id on the authenticated user that renderWithProviders puts in the store.
const CONVERSATION_KEY = `fm.app-assistant.${appAgent._id}.user-1.conversation`;

const conversation = (id: string, title: string) => ({
    _id: id,
    title,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    status: 'ready',
});

const user = userEvent.setup({ delay: null });

const LocationProbe = () => {
    const { search, hash } = useLocation();

    return (
        <>
            <span data-testid="location-search">{search}</span>
            <span data-testid="location-hash">{hash}</span>
        </>
    );
};

const renderAppAgent = (route = '/agent/app-agent-1') =>
    renderWithProviders(
        <Routes>
            <Route
                path="/agent/:agentId/*"
                element={
                    <>
                        <AppAgent agent={appAgent} />
                        <LocationProbe />
                    </>
                }
            />
        </Routes>,
        { route },
    );

const locationSearch = () => screen.getByTestId('location-search').textContent;
const locationHash = () => screen.getByTestId('location-hash').textContent;

interface MessageRequests {
    ids: string[];
}

const trackMessageRequests = (): MessageRequests => {
    const requests: MessageRequests = { ids: [] };

    server.use(
        http.get(apiUrl('/conversations/:conversationId/messages'), ({ params }) => {
            requests.ids.push(params.conversationId as string);

            return pagedEnvelope([]);
        }),
    );

    return requests;
};

beforeEach(() => {
    localStorage.clear();
    server.use(
        http.get(apiUrl('/users/me'), () => envelope({})),
        http.get(apiUrl('/conversations'), () => pagedEnvelope([conversation('conv-1', 'Aarhus energy use')])),
        http.get(apiUrl('/conversations/:conversationId'), ({ params }) =>
            envelope(conversation(params.conversationId as string, 'Aarhus energy use')),
        ),
        http.get(apiUrl('/mcpservers'), () => pagedEnvelope([])),
        http.get(apiUrl('/skills'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines/runs'), () => pagedEnvelope([])),
        http.get(apiUrl('/agents/:agentId/preferences'), () => envelope(null)),
        http.get(apiUrl('/agents/:agentId'), () => envelope(appAgent)),
        http.get(apiUrl('/ai/chat/attach'), () => new Response(null, { status: 204 })),
    );
});

describe('AppAgent assistant panel — recents', () => {
    it('reaches previous chats from the panel chrome', async () => {
        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));

        expect(await screen.findByRole('button', { name: 'Aarhus energy use' })).toBeInTheDocument();
    });

    it('opens the conversation picked from the list', async () => {
        const messages = trackMessageRequests();

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));

        await waitFor(() => expect(messages.ids).toContain('conv-1'));
        await waitFor(() => expect(localStorage.getItem(CONVERSATION_KEY)).toBe('conv-1'));
    });

    it('turns the chrome into the Recents header while Recents is open', async () => {
        renderAppAgent();

        expect(await screen.findByRole('button', { name: 'New chat' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Recent chats' }));
        await screen.findByRole('button', { name: 'Aarhus energy use' });

        expect(screen.getByRole('heading', { name: 'Recents' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument();
        // The action icons never appear or disappear with the state, and never double up: the
        // panel's own header is suppressed so its plus does not compete with the chrome's.
        expect(screen.getAllByRole('button', { name: 'New chat' })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Recent chats' })).toHaveLength(1);
    });

    it('closes Recents from the chrome back arrow', async () => {
        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await screen.findByRole('button', { name: 'Aarhus energy use' });

        await user.click(screen.getByRole('button', { name: 'Back to chat' }));

        expect(screen.queryByRole('heading', { name: 'Recents' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Back to chat' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    });

    it('starts a new chat from the panel chrome', async () => {
        trackMessageRequests();

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));
        await waitFor(() => expect(localStorage.getItem(CONVERSATION_KEY)).toBe('conv-1'));

        await user.click(await screen.findByRole('button', { name: 'New chat' }));

        expect(await screen.findByRole('button', { name: 'Show me the current pipeline' })).toBeInTheDocument();
        expect(localStorage.getItem(CONVERSATION_KEY)).toBeNull();
    });
});

describe('AppAgent assistant panel — url state', () => {
    it('mirrors the open conversation into the address bar', async () => {
        trackMessageRequests();

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));

        await waitFor(() => expect(locationSearch()).toBe('?chat=conv-1'));
    });

    it('clears the param when a new chat starts', async () => {
        trackMessageRequests();

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));
        await waitFor(() => expect(locationSearch()).toBe('?chat=conv-1'));

        await user.click(await screen.findByRole('button', { name: 'New chat' }));

        await waitFor(() => expect(locationSearch()).toBe(''));
    });

    it('keeps the app pane fragment when it writes the param', async () => {
        trackMessageRequests();
        // The pane routes itself through the fragment and sets it on window.location directly.
        window.location.hash = '#/pipeline';

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));

        await waitFor(() => expect(locationSearch()).toBe('?chat=conv-1'));
        expect(locationHash()).toBe('#/pipeline');
        window.location.hash = '';
    });

    it('leaves the url alone while no conversation is open', async () => {
        trackMessageRequests();

        renderAppAgent('/agent/app-agent-1?view=pipeline');

        expect(await screen.findByRole('button', { name: 'New chat' })).toBeInTheDocument();

        await waitFor(() => expect(locationSearch()).toBe('?view=pipeline'));
    });

    it('opens the conversation named in the url', async () => {
        const messages = trackMessageRequests();

        renderAppAgent('/agent/app-agent-1?chat=conv-7');

        await waitFor(() => expect(messages.ids).toContain('conv-7'));
    });

    it('prefers the url over a stale stored conversation', async () => {
        const messages = trackMessageRequests();

        localStorage.setItem(CONVERSATION_KEY, 'conv-stored');
        renderAppAgent('/agent/app-agent-1?chat=conv-shared');

        await waitFor(() => expect(messages.ids).toContain('conv-shared'));
        expect(messages.ids).not.toContain('conv-stored');
    });

    it('keeps other params while it writes its own', async () => {
        trackMessageRequests();

        renderAppAgent('/agent/app-agent-1?view=pipeline');

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));

        await waitFor(() => expect(locationSearch()).toBe('?view=pipeline&chat=conv-1'));
    });
});

describe('AppAgent assistant panel — resume', () => {
    it('reopens the stored conversation on a fresh mount', async () => {
        const messages = trackMessageRequests();

        localStorage.setItem(CONVERSATION_KEY, 'conv-9');
        renderAppAgent();

        await waitFor(() => expect(messages.ids).toContain('conv-9'));
    });

    it('falls back to a new chat when the stored conversation is gone', async () => {
        localStorage.setItem(CONVERSATION_KEY, 'conv-dead');
        server.use(http.get(apiUrl('/conversations/:conversationId/messages'), () => httpError(404, 'Not found')));

        renderAppAgent();

        expect(await screen.findByRole('button', { name: 'Show me the current pipeline' })).toBeInTheDocument();
        expect(localStorage.getItem(CONVERSATION_KEY)).toBeNull();
    });

    it('keeps the stored conversation when the load fails transiently', async () => {
        localStorage.setItem(CONVERSATION_KEY, 'conv-9');
        server.use(http.get(apiUrl('/conversations/:conversationId/messages'), () => httpError(500, 'Boom')));

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await screen.findByRole('button', { name: 'Aarhus energy use' });

        expect(localStorage.getItem(CONVERSATION_KEY)).toBe('conv-9');
    });

    it('retries the same conversation when it is picked again after a failed load', async () => {
        let attempts = 0;

        server.use(
            http.get(apiUrl('/conversations/:conversationId/messages'), () => {
                attempts += 1;

                return attempts === 1 ? httpError(500, 'Boom') : pagedEnvelope([]);
            }),
        );
        localStorage.setItem(CONVERSATION_KEY, 'conv-1');

        renderAppAgent();

        await waitFor(() => expect(attempts).toBe(1));

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));

        await waitFor(() => expect(attempts).toBeGreaterThan(1));
    });

    it('drops the previous conversation banner when the next one fails to load', async () => {
        server.use(
            http.get(apiUrl('/conversations'), () =>
                pagedEnvelope([conversation('conv-1', 'Aarhus energy use'), conversation('conv-2', 'Atlanta GHG')]),
            ),
            http.get(apiUrl('/conversations/:conversationId'), ({ params }) =>
                envelope({
                    ...conversation(params.conversationId as string, 'Aarhus energy use'),
                    branched_from_conversation_id: 'conv-source',
                }),
            ),
            http.get(apiUrl('/conversations/:conversationId/messages'), ({ params }) =>
                params.conversationId === 'conv-2' ? httpError(500, 'Boom') : pagedEnvelope([]),
            ),
        );

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Aarhus energy use' }));
        await waitFor(() => expect(screen.getByText(/Branched from/)).toBeInTheDocument());

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await user.click(await screen.findByRole('button', { name: 'Atlanta GHG' }));

        await waitFor(() => expect(screen.queryByText(/Branched from/)).not.toBeInTheDocument());
    });

    it('ignores a conversation stored against another account', async () => {
        const messages = trackMessageRequests();

        localStorage.setItem(`fm.app-assistant.${appAgent._id}.someone-else.conversation`, 'conv-other');
        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await screen.findByRole('button', { name: 'Aarhus energy use' });

        expect(messages.ids).toEqual([]);
    });

    it('starts on home when nothing is stored', async () => {
        const messages = trackMessageRequests();

        renderAppAgent();

        await user.click(await screen.findByRole('button', { name: 'Recent chats' }));
        await screen.findByRole('button', { name: 'Aarhus energy use' });

        expect(messages.ids).toEqual([]);
    });
});

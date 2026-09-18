import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { installGalleryDomShims, installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { apiUrl, envelope, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import ChatAgent from './chat-agent';

/**
 * `RootRoute` (defined inside `chat-agent.tsx`) decides what the agent's index
 * route shows: the chat home, or a redirect to the library for agents
 * configured with `uiConfig.home.startPage === 'library'`. The redirect is only
 * skipped when navigation explicitly asked for the home (`state.showHome`),
 * which is how "New chat" gets back to the composer on a library-first agent.
 */

installGalleryDomShims();
installRichTextDomShims();
installScrollIntoViewShim();

Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });

const COMPOSER_SELECTOR = '.chat-editor__content[contenteditable="true"]';
const PLACEHOLDER_SELECTOR = `${COMPOSER_SELECTOR} p[data-placeholder]`;

const buildAgent = (home: Record<string, unknown>): ChatAgentType =>
    ({
        _id: 'agent-1',
        slug: 'agent-1',
        identifier: 'agent-identifier-1',
        name: 'Smoke Test Agent',
        type: 'chat',
        apps: [],
        tools: [],
        uiConfig: {
            componentType: 'chat',
            type: 'chat',
            library: true,
            home: { title: 'Chat home', search: { placeholder: 'Ask anything' }, ...home },
        },
    }) as unknown as ChatAgentType;

const PathProbe = () => {
    const location = useLocation();

    return <div data-testid="path">{location.pathname}</div>;
};

const renderAgentIndex = (agent: ChatAgentType, state?: Record<string, unknown>) =>
    renderWithProviders(
        <Routes>
            <Route
                path="/agent/:agentId/*"
                element={
                    <>
                        <PathProbe />
                        <ChatAgent agent={agent} />
                    </>
                }
            />
        </Routes>,
        { routerProps: { initialEntries: [{ pathname: '/agent/agent-1', state }] } },
    );

beforeEach(() => {
    server.use(
        http.get(apiUrl('/users/me'), () => envelope({})),
        http.get(apiUrl('/conversations'), () => pagedEnvelope([])),
        http.get(apiUrl('/mcpservers'), () => pagedEnvelope([])),
        http.get(apiUrl('/skills'), () => pagedEnvelope([])),
        http.get(apiUrl('/files'), () => pagedEnvelope([])),
        http.get(apiUrl('/ai/artifacts'), () => envelope({ total: 0, items: [] })),
        http.get(apiUrl('/agents/:agentId/preferences'), () => envelope(null)),
        http.get(apiUrl('/agents/:agentId'), () => envelope(buildAgent({}))),
        http.get(apiUrl('/routines'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines/runs'), () => pagedEnvelope([])),
    );
});

describe('ChatAgent root route', () => {
    it('shows the chat composer on the index route by default', async () => {
        renderAgentIndex(buildAgent({}));

        await waitFor(() => expect(document.querySelector(COMPOSER_SELECTOR)).toBeTruthy());
        expect(screen.getByTestId('path').textContent).toBe('/agent/agent-1');
        expect(document.querySelector(PLACEHOLDER_SELECTOR)).toHaveAttribute('data-placeholder', 'Ask anything');
    });

    it('redirects a library-first agent from the index route to the library', async () => {
        renderAgentIndex(buildAgent({ startPage: 'library' }));

        await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/agent/agent-1/library'));
        expect(document.querySelector(COMPOSER_SELECTOR)).toBeNull();
    });

    it('keeps a library-first agent on the chat home when navigation asked for it', async () => {
        renderAgentIndex(buildAgent({ startPage: 'library' }), { showHome: true });

        await waitFor(() => expect(document.querySelector(COMPOSER_SELECTOR)).toBeTruthy());
        expect(screen.getByTestId('path').textContent).toBe('/agent/agent-1');
    });
});

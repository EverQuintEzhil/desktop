import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { installGalleryDomShims, installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { routinesVisibleTenant, testTenant } from '@/test/fixtures/auth';
import { apiUrl, envelope, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatAgentType } from '@/types/admin';

import ChatAgent from './chat-agent';

installGalleryDomShims();
installRichTextDomShims();
installScrollIntoViewShim();

Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });

const buildAgent = (uiConfig: Record<string, unknown>): ChatAgentType =>
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
            home: { title: 'Chat home', search: {} },
            ...uiConfig,
        },
    }) as unknown as ChatAgentType;

const PathProbe = () => {
    const location = useLocation();

    return <div data-testid="path">{location.pathname}</div>;
};

const renderRoutinesRoute = (agent: ChatAgentType, tenant = routinesVisibleTenant) =>
    renderWithProviders(
        <>
            <PathProbe />
            <Routes>
                <Route path="/agent/:agentId/*" element={<ChatAgent agent={agent} />} />
            </Routes>
        </>,
        {
            routerProps: { initialEntries: ['/agent/agent-1/routines'] },
            preloadedState: { tenant },
        },
    );

beforeEach(() => {
    server.use(
        http.get(apiUrl('/users/me'), () => envelope({})),
        http.get(apiUrl('/conversations'), () => pagedEnvelope([])),
        http.get(apiUrl('/mcpservers'), () => pagedEnvelope([])),
        http.get(apiUrl('/skills'), () => pagedEnvelope([])),
        http.get(apiUrl('/files'), () => pagedEnvelope([])),
        http.get(apiUrl('/agents/:agentId/preferences'), () => envelope(null)),
        http.get(apiUrl('/agents/:agentId'), () => envelope(buildAgent({}))),
        http.get(apiUrl('/routines'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines/runs'), () => pagedEnvelope([])),
    );
});

describe('ChatAgent routines route', () => {
    it('renders the routines screen when the agent has routines on', async () => {
        renderRoutinesRoute(buildAgent({ routines: { enabled: true } }));

        expect(await screen.findByRole('heading', { name: 'Routines' })).toBeInTheDocument();
    });

    it('renders the routines screen when the agent has no routines flag at all', async () => {
        renderRoutinesRoute(buildAgent({}));

        expect(await screen.findByRole('heading', { name: 'Routines' })).toBeInTheDocument();
    });

    it('falls through to the catch-all redirect when the tenant hides routines', async () => {
        renderRoutinesRoute(buildAgent({ routines: { enabled: true } }), testTenant);

        await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
        expect(screen.queryByRole('heading', { name: 'Routines' })).not.toBeInTheDocument();
    });

    it('falls through to the catch-all redirect and asks for no routine data when routines are off', async () => {
        const routineRequests: string[] = [];

        server.use(
            http.get(apiUrl('/routines'), ({ request }) => {
                routineRequests.push(request.url);

                return pagedEnvelope([]);
            }),
            http.get(apiUrl('/routines/runs'), ({ request }) => {
                routineRequests.push(request.url);

                return pagedEnvelope([]);
            }),
        );

        renderRoutinesRoute(buildAgent({ routines: { enabled: false } }));

        await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/'));
        expect(screen.queryByRole('heading', { name: 'Routines' })).not.toBeInTheDocument();
        expect(routineRequests).toEqual([]);
    });
});

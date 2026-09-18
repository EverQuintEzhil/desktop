import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Navigate, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { authenticatedUser } from '@/test/fixtures/auth';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { MemoryType } from '@/types/admin';
import type { Role } from '@/types/store';
import { formatDateTime } from '@/utils/date';

import SettingsLayout from '../connectors/settings-layout';

import Memories from './memories';

const sampleMemory = {
    _id: 'memory-1',
    name: 'Project preferences',
    refName: 'project_preferences',
    description: 'Remembers preferred project settings',
    kind: 'semantic',
    globalEnabled: true,
    preference: { disabled: false },
} as unknown as MemoryType;

const secondMemory = {
    ...sampleMemory,
    _id: 'memory-2',
    name: 'Writing style',
    description: 'Remembers tone of voice',
} as unknown as MemoryType;

const sampleDoc = {
    id: 'profile:user-1',
    scope: 'user',
    userId: 'user-1',
    agentId: null,
    text: 'Marine engineer based in Chennai.',
    metadata: null,
    createdAt: '2026-07-10T13:13:12.974Z',
    updatedAt: '2026-07-10T15:47:49.955Z',
};

const learnedHintMemory = {
    ...sampleMemory,
    kind: 'learned_hint',
    name: 'Learned hints',
} as unknown as MemoryType;

const renderSettingsMemories = (route = '/settings/memories', role?: Role) =>
    renderWithProviders(
        <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/memories" replace />} />
                <Route path="memories" element={<Memories />} />
                <Route path="memories/:memoryId" element={<Memories />} />
            </Route>
        </Routes>,
        {
            route,
            preloadedState: role !== undefined ? { user: { ...authenticatedUser, role } } : undefined,
        },
    );

describe('Memories settings', () => {
    it('renders the memories empty state in settings', async () => {
        server.use(respond('get', '/memories', () => pagedEnvelope([], { page: 0 })));

        renderSettingsMemories();

        expect(screen.getByRole('link', { name: 'Memories' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Memories' })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('No memories found')).toBeInTheDocument();
        });
    });

    it('lists the memories returned by the catalog', async () => {
        server.use(respond('get', '/memories', () => pagedEnvelope([sampleMemory, secondMemory], { page: 0 })));

        renderSettingsMemories();

        await waitFor(() => {
            expect(screen.getByText('Project preferences')).toBeInTheDocument();
        });

        expect(screen.getByText('Remembers preferred project settings')).toBeInTheDocument();
        expect(screen.getByText('Writing style')).toBeInTheDocument();
    });

    it('shows a retry action when the catalog request fails', async () => {
        server.use(respond('get', '/memories', () => httpError(500)));

        renderSettingsMemories();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        });
    });

    it('shows a retry action when the API answers success: false', async () => {
        server.use(
            respond(
                'get',
                '/memories',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Memories unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        renderSettingsMemories();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        });
    });

    it('requests the catalog with the default page size', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/memories'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([sampleMemory], { page: 0 });
            }),
        );

        renderSettingsMemories();

        await waitFor(() => {
            expect(requestUrl).not.toBe('');
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('size')).toBe('20');
        expect(params.get('page')).toBe('0');
        expect(params.get('search')).toBeNull();
    });

    it('sends the typed search term to the catalog endpoint', async () => {
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/memories'), ({ request }) => {
                searches.push(new URL(request.url).searchParams.get('search'));

                return pagedEnvelope([sampleMemory], { page: 0 });
            }),
        );

        renderSettingsMemories();

        await waitFor(() => {
            expect(screen.getByText('Project preferences')).toBeInTheDocument();
        });

        await userEvent.type(screen.getByPlaceholderText('Search memories'), 'style');

        await waitFor(
            () => {
                expect(searches).toContain('style');
            },
            { timeout: 3000 },
        );
    });

    it('loads the detail pane for the memory in the route param', async () => {
        server.use(respond('get', '/memories', () => pagedEnvelope([sampleMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(sampleMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(respond('get', '/memories/memory-1/docs', () => pagedEnvelope([sampleDoc], { page: 0 })));

        renderSettingsMemories('/settings/memories/memory-1');

        await waitFor(() => {
            expect(screen.getByRole('switch', { name: 'Toggle memory' })).toBeInTheDocument();
        });

        expect(screen.getByRole('heading', { name: 'Project preferences' })).toBeInTheDocument();
        expect(screen.getByText('project_preferences')).toBeInTheDocument();
        expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    it('reflects a disabled memory preference in the detail pane', async () => {
        const disabledMemory = {
            ...sampleMemory,
            preference: { disabled: true },
        } as unknown as MemoryType;

        server.use(respond('get', '/memories', () => pagedEnvelope([disabledMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(disabledMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: true })));
        server.use(respond('get', '/memories/memory-1/docs', () => pagedEnvelope([sampleDoc], { page: 0 })));

        renderSettingsMemories('/settings/memories/memory-1');

        await waitFor(() => {
            expect(screen.getByText('Disabled')).toBeInTheDocument();
        });
    });

    it('lists the stored memory docs for the signed-in user', async () => {
        let requestUrl = '';

        server.use(respond('get', '/memories', () => pagedEnvelope([sampleMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(sampleMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(
            http.get(apiUrl('/memories/memory-1/docs'), ({ request }) => {
                requestUrl = request.url;

                return pagedEnvelope([sampleDoc], { page: 0 });
            }),
        );

        renderSettingsMemories('/settings/memories/memory-1');

        await waitFor(() => {
            expect(screen.getByText('Marine engineer based in Chennai.')).toBeInTheDocument();
        });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('userId')).toBe('user-1');
        expect(params.get('page')).toBe('0');
        expect(params.get('size')).toBe('10');
        expect(params.get('sortBy')).toBe('updatedAt:desc');
    });

    it('reveals the full doc timestamps when a fact row is expanded', async () => {
        server.use(respond('get', '/memories', () => pagedEnvelope([sampleMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(sampleMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(respond('get', '/memories/memory-1/docs', () => pagedEnvelope([sampleDoc], { page: 0 })));

        renderSettingsMemories('/settings/memories/memory-1');

        const factRow = await screen.findByRole('button', { name: /Marine engineer based in Chennai\./ });

        expect(screen.queryByText(formatDateTime(sampleDoc.createdAt))).not.toBeInTheDocument();

        await userEvent.click(factRow);

        expect(screen.getByText(formatDateTime(sampleDoc.createdAt))).toBeInTheDocument();
        expect(screen.getByText(formatDateTime(sampleDoc.updatedAt))).toBeInTheDocument();
    });

    it('retries the stored docs request from the docs error state', async () => {
        let docsAttempts = 0;

        server.use(respond('get', '/memories', () => pagedEnvelope([sampleMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(sampleMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(
            http.get(apiUrl('/memories/memory-1/docs'), () => {
                docsAttempts += 1;

                return docsAttempts === 1 ? httpError(500) : pagedEnvelope([sampleDoc], { page: 0 });
            }),
        );

        renderSettingsMemories('/settings/memories/memory-1');

        await waitFor(() => {
            expect(screen.getByText('Failed to load memories')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => {
            expect(screen.getByText('Marine engineer based in Chennai.')).toBeInTheDocument();
        });

        expect(screen.queryByText('Failed to load memories')).not.toBeInTheDocument();
    });

    it('shows an empty state when the memory has no stored docs', async () => {
        server.use(respond('get', '/memories', () => pagedEnvelope([sampleMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(sampleMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(respond('get', '/memories/memory-1/docs', () => pagedEnvelope([], { page: 0 })));

        renderSettingsMemories('/settings/memories/memory-1');

        await waitFor(() => {
            expect(screen.getByText('No memories stored yet')).toBeInTheDocument();
        });
    });

    it('explains that conversation memories come from the agent chat list', async () => {
        const conversationMemory = {
            ...sampleMemory,
            kind: 'conversation',
            name: 'Amplify Chat Conversation Memory',
        } as unknown as MemoryType;

        server.use(respond('get', '/memories', () => pagedEnvelope([conversationMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(conversationMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(respond('get', '/memories/memory-1/docs', () => pagedEnvelope([], { page: 0 })));

        renderSettingsMemories('/settings/memories/memory-1');

        await waitFor(() => {
            expect(screen.getByText('Your chats are the memory')).toBeInTheDocument();
        });

        expect(screen.getByText('How this memory works')).toBeInTheDocument();
        expect(screen.queryByText('Available Data')).not.toBeInTheDocument();
        expect(screen.queryByText('No memories stored yet')).not.toBeInTheDocument();
    });

    it('tells an end user that only their admin can view learned hints, and never fetches them', async () => {
        let docsRequests = 0;

        server.use(respond('get', '/memories', () => pagedEnvelope([learnedHintMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(learnedHintMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(
            http.get(apiUrl('/memories/memory-1/docs'), () => {
                docsRequests += 1;

                return pagedEnvelope([sampleDoc], { page: 0 });
            }),
        );

        renderSettingsMemories('/settings/memories/memory-1');

        await waitFor(() => {
            expect(screen.getByText('Only your admin can view these')).toBeInTheDocument();
        });

        expect(screen.getByText('How this memory works')).toBeInTheDocument();
        expect(screen.queryByText('Marine engineer based in Chennai.')).not.toBeInTheDocument();
        expect(docsRequests).toBe(0);
    });

    it('hides learned hints from an unknown role too', async () => {
        server.use(respond('get', '/memories', () => pagedEnvelope([learnedHintMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(learnedHintMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(respond('get', '/memories/memory-1/docs', () => pagedEnvelope([sampleDoc], { page: 0 })));

        renderSettingsMemories('/settings/memories/memory-1', null);

        await waitFor(() => {
            expect(screen.getByText('Only your admin can view these')).toBeInTheDocument();
        });
    });

    it('lists learned hint docs for an admin', async () => {
        server.use(respond('get', '/memories', () => pagedEnvelope([learnedHintMemory], { page: 0 })));
        server.use(respond('get', '/memories/memory-1', () => envelope(learnedHintMemory)));
        server.use(respond('get', '/memories/memory-1/preference', () => envelope({ disabled: false })));
        server.use(respond('get', '/memories/memory-1/docs', () => pagedEnvelope([sampleDoc], { page: 0 })));

        renderSettingsMemories('/settings/memories/memory-1', 'admin');

        await waitFor(() => {
            expect(screen.getByText('Marine engineer based in Chennai.')).toBeInTheDocument();
        });

        expect(screen.getByText('Here is what we know about you')).toBeInTheDocument();
        expect(screen.queryByText('Only your admin can view these')).not.toBeInTheDocument();
    });
});

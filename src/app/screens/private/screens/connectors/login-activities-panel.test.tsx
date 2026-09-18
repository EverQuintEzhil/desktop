import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { Navigate, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import LoginActivitiesPanel from '@/components/avatar-menu/settings/login-activities-panel';
import { type LoginActivityGroup } from '@/lib/api';
import { apiUrl, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import SettingsLayout from './settings-layout';

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';
const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15';

const makeGroup = (
    requestId: string,
    overrides: Partial<LoginActivityGroup['activities'][number]> = {},
): LoginActivityGroup => ({
    requestId,
    activities: [
        {
            _id: `activity-${requestId}`,
            type: 'login',
            provider: 'local',
            email: 'jane.doe@example.com',
            requestId,
            ipAddr: '203.0.113.10',
            userAgent: CHROME_WINDOWS,
            status: 'success',
            reason: null,
            expiresAt: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            ...overrides,
        },
    ],
});

const renderSettingsLoginActivities = () =>
    renderWithProviders(
        <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/connectors" replace />} />
                <Route path="login-activities" element={<LoginActivitiesPanel />} />
            </Route>
        </Routes>,
        { route: '/settings/login-activities' },
    );

describe('Settings login activities panel', () => {
    it('renders an empty state when there is no login activity', async () => {
        server.use(respond('get', '/users/me/loginactivities', () => pagedEnvelope([], { page: 0 })));

        renderSettingsLoginActivities();

        await waitFor(() => {
            expect(screen.getByText('No login activity yet')).toBeInTheDocument();
        });
    });

    it('renders a login activity row', async () => {
        server.use(
            respond('get', '/users/me/loginactivities', () => pagedEnvelope([makeGroup('request-1')], { page: 0 })),
        );

        renderSettingsLoginActivities();

        await waitFor(() => {
            expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
        });

        expect(screen.getByText('Signed in')).toBeInTheDocument();
        expect(screen.getByText(/203\.0\.113\.10/)).toBeInTheDocument();
    });

    it('derives the browser and platform from a different user agent', async () => {
        server.use(
            respond('get', '/users/me/loginactivities', () =>
                pagedEnvelope([makeGroup('request-2', { userAgent: SAFARI_MAC })], { page: 0 }),
            ),
        );

        renderSettingsLoginActivities();

        await waitFor(() => {
            expect(screen.getByText('Safari on macOS')).toBeInTheDocument();
        });
    });

    it('renders one row per returned group', async () => {
        server.use(
            respond('get', '/users/me/loginactivities', () =>
                pagedEnvelope([makeGroup('request-1'), makeGroup('request-2', { userAgent: SAFARI_MAC })], { page: 0 }),
            ),
        );

        renderSettingsLoginActivities();

        await waitFor(() => {
            expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
        });

        expect(screen.getByText('Safari on macOS')).toBeInTheDocument();
    });

    it('requests only the first page', async () => {
        const pages: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/users/me/loginactivities'), ({ request }) => {
                pages.push(new URL(request.url).searchParams.get('page'));

                return pagedEnvelope([makeGroup('request-1')], { page: 0, totalPages: 3, totalCount: 3 });
            }),
        );

        renderSettingsLoginActivities();

        await waitFor(() => {
            expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
        });

        expect(pages).toEqual(['0']);
    });

    it('surfaces the API message when the request answers success: false', async () => {
        server.use(
            respond(
                'get',
                '/users/me/loginactivities',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Activity log unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        renderSettingsLoginActivities();

        await waitFor(() => {
            expect(screen.getByText('Activity log unavailable')).toBeInTheDocument();
        });
    });

    it('renders an error state when activities fail to load', async () => {
        server.use(respond('get', '/users/me/loginactivities', () => httpError(500)));

        renderSettingsLoginActivities();

        await waitFor(() => {
            expect(screen.getByText(/status code 500/i)).toBeInTheDocument();
        });
    });
});

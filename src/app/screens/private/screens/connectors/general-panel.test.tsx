import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { Navigate, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import GeneralPanel from '@/components/avatar-menu/settings/general-panel';
import { type MeProfile } from '@/lib/api';
import { apiUrl, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import SettingsLayout from './settings-layout';

const meProfile: MeProfile = {
    _id: 'user-1',
    name: { first: 'Jane', last: 'Doe' },
    role: 'user',
    avatar: '',
    email: 'jane.doe@example.com',
    otherEmails: [],
    mobile: null,
    defaultLanguage: 'English',
    timezone: 'America/New_York',
    timezoneOffset: '-05:00',
    tags: [],
    portalAccessEnabled: true,
    preferences: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
};

const profileSchema = {
    type: 'object',
    properties: {
        office: { type: 'string', title: 'Office', readOnly: true },
        jobtitle: { type: 'string', title: 'Job title', description: 'How you are listed in the directory' },
    },
    required: ['jobtitle'],
};

const meWithCustomFields: MeProfile = {
    ...meProfile,
    customFields: { office: 'London', jobtitle: 'Architect', legacyId: 'abc-1' },
};

/** `profileSchema` is a sibling of `value` on the `/users/me` envelope, not a field inside the user. */
const meEnvelope = (value: MeProfile, schema: unknown = null): Response =>
    HttpResponse.json({ success: true, value, profileSchema: schema });

const stubMe = (value: MeProfile, schema: unknown = null) =>
    server.use(respond('get', '/users/me', () => meEnvelope(value, schema)));

const renderSettingsGeneral = () =>
    renderWithProviders(
        <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/connectors" replace />} />
                <Route path="user" element={<GeneralPanel />} />
            </Route>
        </Routes>,
        { route: '/settings/user' },
    );

describe('Settings general panel', () => {
    it('renders profile details once loaded', async () => {
        stubMe(meProfile);

        renderSettingsGeneral();

        await waitFor(() => {
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        expect(screen.getAllByText('jane.doe@example.com').length).toBeGreaterThan(0);
        expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('requests the profile from /users/me', async () => {
        let requestPath = '';

        server.use(
            http.get(apiUrl('/users/me'), ({ request }) => {
                requestPath = new URL(request.url).pathname;

                return meEnvelope(meProfile);
            }),
        );

        renderSettingsGeneral();

        await waitFor(() => {
            expect(requestPath).toBe('/users/me');
        });
    });

    it('does not render profile details while the request is in flight', async () => {
        server.use(
            http.get(apiUrl('/users/me'), async () => {
                await delay('infinite');

                return meEnvelope(meProfile);
            }),
        );

        renderSettingsGeneral();

        expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });

    it('surfaces the API message when the profile request answers success: false', async () => {
        server.use(
            respond(
                'get',
                '/users/me',
                () =>
                    new Response(JSON.stringify({ success: false, message: 'Profile unavailable', value: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        renderSettingsGeneral();

        await waitFor(() => {
            expect(screen.getByText('Profile unavailable')).toBeInTheDocument();
        });
    });

    it('renders an error message when the profile request fails', async () => {
        server.use(respond('get', '/users/me', () => httpError(500)));

        renderSettingsGeneral();

        await waitFor(() => {
            expect(screen.getByText(/status code 500/i)).toBeInTheDocument();
        });
    });

    it('renders schema fields pre-filled from the user custom fields', async () => {
        stubMe(meWithCustomFields, profileSchema);

        renderSettingsGeneral();

        expect(await screen.findByLabelText(/Job title/)).toHaveValue('Architect');
        expect(screen.queryByText('How you are listed in the directory')).not.toBeInTheDocument();

        await userEvent.hover(screen.getByTestId('field-description-jobtitle'));

        expect(await screen.findByText('How you are listed in the directory')).toBeInTheDocument();
    });

    it('shows a placeholder for the profile section while the schema is still loading', async () => {
        let requests = 0;

        // The profile section mounts only once the profile resolves, so the second
        // `/users/me` request is always the schema fetch.
        server.use(
            http.get(apiUrl('/users/me'), async () => {
                requests += 1;

                if (requests > 1) {
                    await delay('infinite');
                }

                return meEnvelope(meWithCustomFields, profileSchema);
            }),
        );

        renderSettingsGeneral();

        expect(await screen.findByText('Profile details')).toBeInTheDocument();
        expect(screen.queryByLabelText(/Job title/)).not.toBeInTheDocument();
    });

    it('renders a readOnly property as text with no input', async () => {
        stubMe(meWithCustomFields, profileSchema);

        renderSettingsGeneral();

        expect(await screen.findByText('London')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('London')).not.toBeInTheDocument();
        expect(screen.getByText('Set by your administrator')).toBeInTheDocument();
    });

    it('renders the page normally with no profile section when no schema is configured', async () => {
        let requests = 0;

        server.use(
            http.get(apiUrl('/users/me'), () => {
                requests += 1;

                return meEnvelope(meWithCustomFields, null);
            }),
        );

        renderSettingsGeneral();

        expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
        await waitFor(() => {
            expect(requests).toBe(2);
        });
        await waitFor(() => {
            expect(screen.queryByText('Profile details')).not.toBeInTheDocument();
        });

        expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('sends read-only values and unknown keys back unchanged when saving', async () => {
        const user = userEvent.setup();
        let requestBody: { customFields?: Record<string, unknown> } | null = null;

        stubMe(meWithCustomFields, profileSchema);
        server.use(
            http.put(apiUrl('/users/me'), async ({ request }) => {
                requestBody = (await request.json()) as { customFields?: Record<string, unknown> };

                return meEnvelope(meWithCustomFields, profileSchema);
            }),
        );

        renderSettingsGeneral();

        const input = await screen.findByLabelText(/Job title/);

        await user.clear(input);
        await user.type(input, 'Senior Architect');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(screen.getByText('Your profile has been saved.')).toBeInTheDocument();
        });

        expect(requestBody).toEqual({
            customFields: { office: 'London', jobtitle: 'Senior Architect', legacyId: 'abc-1' },
        });
    });

    it('blocks the save and names the field when a required field is emptied', async () => {
        const user = userEvent.setup();
        let putRequests = 0;

        stubMe(meWithCustomFields, profileSchema);
        server.use(
            http.put(apiUrl('/users/me'), () => {
                putRequests += 1;

                return meEnvelope(meWithCustomFields, profileSchema);
            }),
        );

        renderSettingsGeneral();

        await user.clear(await screen.findByLabelText(/Job title/));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(screen.getAllByText('Job title is required.').length).toBeGreaterThan(0);
        });

        expect(putRequests).toBe(0);
        expect(screen.queryByText('Your profile has been saved.')).not.toBeInTheDocument();
    });

    it('surfaces the server message when the save fails and does not claim success', async () => {
        const user = userEvent.setup();

        stubMe(meWithCustomFields, profileSchema);
        server.use(respond('put', '/users/me', () => httpError(500, 'Profile could not be saved')));

        renderSettingsGeneral();

        const input = await screen.findByLabelText(/Job title/);

        await user.type(input, ' II');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(screen.getByText('Profile could not be saved')).toBeInTheDocument();
        });

        expect(screen.queryByText('Your profile has been saved.')).not.toBeInTheDocument();
    });

    it('reverts edited fields when Discard is used', async () => {
        const user = userEvent.setup();

        stubMe(meWithCustomFields, profileSchema);

        renderSettingsGeneral();

        const input = await screen.findByLabelText(/Job title/);

        await user.type(input, ' II');
        expect(input).toHaveValue('Architect II');

        await user.click(screen.getByRole('button', { name: 'Discard' }));
        expect(input).toHaveValue('Architect');
    });
});

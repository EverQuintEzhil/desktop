import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DropdownMenuContent, DropdownMenuRoot, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { Role } from '@/types/store';

import {
    EditLauncherDialog,
    PublishToLauncherButton,
    PublishToLauncherDialog,
    PublishToLauncherMenuItem,
    useAgentLauncher,
    useLauncherControls,
} from '.';

const MENU = 'More agent actions';
const TRIGGER = 'Publish to launcher';
const EDIT = 'Edit launcher…';

const launcherRow = (over: object = {}) => ({
    _id: 'l-1',
    name: 'Design Practice',
    urlOrSlug: 'design-practice',
    description: 'Drafts specs',
    sortOrder: 0,
    isPublished: true,
    ...over,
});

const agent = (launcher: object | null) => ({
    _id: 'agent-1',
    name: 'Spec Writer',
    slug: 'spec-writer',
    description: 'Writes specs',
    launcher,
});

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

interface RenderOptions {
    role?: Role;
    hideCreateAgent?: boolean;
    getAgentDescription?: () => string;
}

/**
 * Mirrors how the builder topbar wires the parts: the query lives out here where it outlives the
 * menu, the state button sits in the header, and both dialogs are siblings of the menu.
 */
const Host = ({ getAgentDescription }: Pick<RenderOptions, 'getAgentDescription'>) => {
    const [publishOpen, setPublishOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const { isAllowed, state } = useAgentLauncher('agent-1');

    return (
        <>
            {isAllowed && state ? (
                <PublishToLauncherButton
                    agentId="agent-1"
                    launcher={state.launcher}
                    onPublish={() => setPublishOpen(true)}
                />
            ) : null}
            <DropdownMenuRoot>
                <DropdownMenuTrigger aria-label={MENU}>Actions</DropdownMenuTrigger>
                <DropdownMenuContent>
                    {isAllowed && state?.launcher ? (
                        <PublishToLauncherMenuItem isBusy={false} onEdit={() => setEditOpen(true)} />
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenuRoot>
            {publishOpen ? (
                <PublishToLauncherDialog
                    agentId="agent-1"
                    agentName="Spec Writer"
                    agentDescription={state?.agentDescription}
                    getAgentDescription={getAgentDescription}
                    onClose={() => setPublishOpen(false)}
                />
            ) : null}
            {editOpen && state?.launcher ? (
                <EditLauncherDialog
                    agentId="agent-1"
                    agentName="Spec Writer"
                    launcher={state.launcher}
                    onClose={() => setEditOpen(false)}
                />
            ) : null}
        </>
    );
};

const renderControl = ({ role = 'admin', hideCreateAgent = false, getAgentDescription }: RenderOptions = {}) =>
    renderWithProviders(
        <>
            <LocationProbe />
            <Routes>
                <Route path="/agent-builder/:id" element={<Host getAgentDescription={getAgentDescription} />} />
            </Routes>
        </>,
        {
            route: '/agent-builder/agent-1',
            preloadedState: {
                user: { _id: 'user-1', role },
                tenant: { hideCreateAgent },
            },
        },
    );

const openPublishDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: TRIGGER }));
    await screen.findByRole('dialog');
};

const openEditDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: MENU }));
    await user.click(await screen.findByRole('menuitem', { name: EDIT }));
    await screen.findByRole('dialog');
};

describe('PublishToLauncher', () => {
    it('offers publishing in the top bar when the agent has no launcher', async () => {
        server.use(respond('get', '/agents/agent-1', () => envelope(agent(null))));

        renderControl();

        expect(await screen.findByRole('button', { name: TRIGGER })).toBeInTheDocument();
    });

    it.each<Role>(['user', 'developer'])('stays absent for a %s who cannot create launchers', async (role) => {
        // Stubbed with the same launcher-less agent the happy path uses, so the button would render
        // but for the gate: without it the early return on missing data hides it anyway and the
        // assertion would pass with the permission check deleted.
        let answered = false;

        server.use(
            respond('get', '/agents/agent-1', () => {
                answered = true;

                return envelope(agent(null));
            }),
        );

        renderControl({ role });

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/agent-builder/agent-1'));
        expect(answered).toBe(false);
        expect(screen.queryByRole('button', { name: TRIGGER })).not.toBeInTheDocument();
    });

    it('stays absent when the tenant hides agent creation', async () => {
        let answered = false;

        server.use(
            respond('get', '/agents/agent-1', () => {
                answered = true;

                return envelope(agent(null));
            }),
        );

        renderControl({ hideCreateAgent: true });

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/agent-builder/agent-1'));
        expect(answered).toBe(false);
        expect(screen.queryByRole('button', { name: TRIGGER })).not.toBeInTheDocument();
    });

    it('becomes the launcher state, named, once published', async () => {
        server.use(respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))));

        renderControl();

        const state = await screen.findByRole('link', { name: /Open the Design Practice launcher, live/ });

        // By agent id, not the launcher slug: renaming the agent rewrites its slug and the launcher
        // URL drifts, but the id always resolves.
        expect(state).toHaveAttribute('href', '/agent/agent-1');
        expect(state).toHaveTextContent('On Design Practice');
        expect(screen.queryByRole('button', { name: TRIGGER })).not.toBeInTheDocument();
    });

    it('says hidden rather than claiming published when the launcher is unpublished', async () => {
        server.use(respond('get', '/agents/agent-1', () => envelope(agent(launcherRow({ isPublished: false })))));

        renderControl();

        expect(await screen.findByRole('link', { name: /Open the Design Practice launcher/ })).toHaveTextContent(
            'Hidden · Design Practice',
        );
    });

    it('hides itself when the launcher state cannot be read', async () => {
        let answered = false;

        server.use(
            respond('get', '/agents/agent-1', () => {
                answered = true;

                return httpError(404);
            }),
        );

        renderControl();

        // Absence only means something once the read has actually failed: asserted before that, it
        // passes on the loading state and would still pass with the error branch removed.
        await waitFor(() => expect(answered).toBe(true));

        expect(screen.queryByRole('button', { name: TRIGGER })).not.toBeInTheDocument();
    });

    it('creates a launcher bound to the agent and shows it as published', async () => {
        const user = userEvent.setup();
        let posted: Record<string, unknown> | null = null;
        let launcher: object | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcher))),
            // `respond` drops the resolver args, and the POST body is the whole point of this test.
            http.post(apiUrl('/launchers'), async ({ request }) => {
                posted = (await request.json()) as Record<string, unknown>;
                launcher = launcherRow({ name: 'Spec Writer', urlOrSlug: 'spec-writer' });

                return envelope(launcher);
            }),
        );

        renderControl();
        await openPublishDialog(user);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        await screen.findByRole('link', { name: /Open the Spec Writer launcher/ });

        expect(posted).toMatchObject({ type: 'agent', agentId: 'agent-1', urlOrSlug: 'spec-writer' });
        expect(posted).not.toHaveProperty('includeUserIds');
    });

    it('shows the published launcher from the cache the create patched, without a refetch', async () => {
        const user = userEvent.setup();

        server.use(
            // Frozen on `null` after the create on purpose: only the `setQueryData` patch in
            // `onSuccess` can produce the published state, so deleting it fails this test.
            respond('get', '/agents/agent-1', () => envelope(agent(null))),
            respond('post', '/launchers', () => envelope(launcherRow({ name: 'Spec Writer' }))),
        );

        renderControl();
        await openPublishDialog(user);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByRole('link', { name: /Open the Spec Writer launcher/ })).toBeInTheDocument();
    });

    it('sends the description the builder has saved since, not the cached one', async () => {
        const user = userEvent.setup();
        let posted: Record<string, unknown> | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(null))),
            http.post(apiUrl('/launchers'), async ({ request }) => {
                posted = (await request.json()) as Record<string, unknown>;

                return envelope(launcherRow());
            }),
        );

        renderControl({ getAgentDescription: () => 'Handles billing' });
        await openPublishDialog(user);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        await waitFor(() => expect(posted).toMatchObject({ description: 'Handles billing' }));
    });

    it('sends the prefilled sort order, a changed one, and omits it when cleared', async () => {
        const user = userEvent.setup();
        const bodies: Array<Record<string, unknown>> = [];

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(null))),
            http.post(apiUrl('/launchers'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return httpError(400, 'There is already a launcher with url/slug spec-writer.');
            }),
        );

        renderControl();
        await openPublishDialog(user);

        const field = screen.getByLabelText('Sort order');

        expect(field).toHaveValue(0);

        await user.click(screen.getByRole('button', { name: 'Publish' }));
        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ sortOrder: 0 });

        await user.clear(field);
        await user.type(field, '3');
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        await waitFor(() => expect(bodies).toHaveLength(2));
        expect(bodies[1]).toMatchObject({ sortOrder: 3 });

        // Cleared is not zero: the field can still be emptied to let the column default apply.
        await user.clear(field);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        await waitFor(() => expect(bodies).toHaveLength(3));
        expect(bodies[2]).not.toHaveProperty('sortOrder');
    });

    it('refuses a sort order that is not a whole number', async () => {
        const user = userEvent.setup();
        let posted = false;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(null))),
            respond('post', '/launchers', () => {
                posted = true;

                return envelope(null);
            }),
        );

        renderControl();
        await openPublishDialog(user);

        const field = screen.getByLabelText('Sort order');

        await user.clear(field);
        await user.type(field, '1.5');
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByText('Use a whole number, or leave it blank.')).toBeInTheDocument();
        expect(posted).toBe(false);
    });

    it('refetches rather than caching a created launcher that came back without an id', async () => {
        const user = userEvent.setup();
        let launcher: object | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcher))),
            respond('post', '/launchers', () => {
                launcher = launcherRow({ name: 'Spec Writer' });

                // Truthy but unidentified. Cached as-is it would later PUT /launchers/undefined.
                return envelope({ name: 'Spec Writer', urlOrSlug: 'spec-writer', isPublished: true });
            }),
        );

        renderControl();
        await openPublishDialog(user);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByRole('link', { name: /Open the Spec Writer launcher/ })).toBeInTheDocument();
    });

    it('cannot be dismissed while the launcher is being created', async () => {
        const user = userEvent.setup();
        let release: () => void = () => {};
        const inFlight = new Promise<void>((resolve) => {
            release = resolve;
        });

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(null))),
            http.post(apiUrl('/launchers'), async () => {
                await inFlight;

                return envelope(launcherRow());
            }),
        );

        renderControl();
        await openPublishDialog(user);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled());

        // The POST is already gone: closing here would create a launcher behind the user's back.
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        release();
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('flags the name field, not the URL, when the name is blank', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/agents/agent-1', () => envelope(agent(null))));

        renderControl();
        await openPublishDialog(user);

        const name = screen.getByLabelText('Launcher name');

        await user.clear(name);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByText('Give the launcher a name.')).toBeInTheDocument();
        expect(name).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('URL')).toHaveAttribute('aria-invalid', 'false');
    });

    it('reports a taken URL against the URL field', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(null))),
            respond('post', '/launchers', () =>
                httpError(400, 'There is already a launcher with url/slug spec-writer.'),
            ),
        );

        renderControl();
        await openPublishDialog(user);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByText('That URL is already taken. Try another.')).toBeInTheDocument();
    });

    it('swaps to the published state when the agent turns out to already have a launcher', async () => {
        const user = userEvent.setup();
        let launcher: object | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcher))),
            respond('post', '/launchers', () => {
                launcher = launcherRow();

                return httpError(400, 'There is already a launcher with agentId agent-1.');
            }),
        );

        renderControl();
        await openPublishDialog(user);
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        expect(await screen.findByText('This agent already has a launcher.')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(await screen.findByRole('link', { name: /Open the Design Practice launcher/ })).toBeInTheDocument();
    });

    it('rejects a URL the API would refuse before sending it', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/agents/agent-1', () => envelope(agent(null))));

        renderControl();
        await openPublishDialog(user);

        const url = screen.getByLabelText('URL');

        await user.clear(url);
        await user.type(url, 'Not A Slug!');
        await user.click(screen.getByRole('button', { name: 'Publish' }));

        const error = await screen.findByText('Use lowercase letters, numbers and dashes only.');

        expect(error).toBeInTheDocument();
        expect(url).toHaveAttribute('aria-invalid', 'true');
        expect(url).toHaveAccessibleDescription(expect.stringContaining('lowercase letters'));
    });
});

describe('EditLauncher', () => {
    it('is absent from the menu until a launcher exists', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/agents/agent-1', () => envelope(agent(null))));

        renderControl();
        await screen.findByRole('button', { name: TRIGGER });
        await user.click(screen.getByRole('button', { name: MENU }));

        expect(screen.queryByRole('menuitem', { name: EDIT })).not.toBeInTheDocument();
    });

    it('sends only the field that changed, never the untouched URL', async () => {
        const user = userEvent.setup();
        let put: Record<string, unknown> | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            http.put(apiUrl('/launchers/l-1'), async ({ request }) => {
                put = (await request.json()) as Record<string, unknown>;

                return envelope(launcherRow({ name: 'Design Studio' }));
            }),
        );

        renderControl();
        await openEditDialog(user);

        const name = screen.getByLabelText('Name on the tile');

        await user.clear(name);
        await user.type(name, 'Design Studio');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        // `PUT /launchers/:id` copies `urlOrSlug` onto the agent's own slug, so an unchanged one
        // resent from a stale form would revert a rename made elsewhere since it was seeded.
        await waitFor(() => expect(put).toEqual({ name: 'Design Studio' }));
    });

    it('does not resend a URL that changed underneath the open panel', async () => {
        const user = userEvent.setup();
        let slug = 'design-practice';
        let put: Record<string, unknown> | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow({ urlOrSlug: slug })))),
            http.put(apiUrl('/launchers/l-1'), async ({ request }) => {
                put = (await request.json()) as Record<string, unknown>;

                return envelope(launcherRow());
            }),
        );

        renderControl();
        await openEditDialog(user);

        // The agent is renamed elsewhere; the API copies that onto the launcher URL, and the topbar
        // query refetches while this panel is open. The form must not write its seed back over it.
        slug = 'billing-bot';
        await user.click(screen.getByLabelText('Show on the home screen'));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(put).toEqual({ isPublished: false }));
    });

    it('saves nothing and just closes when no field was touched', async () => {
        const user = userEvent.setup();
        let put = false;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            respond('put', '/launchers/l-1', () => {
                put = true;

                return envelope(launcherRow());
            }),
        );

        renderControl();
        await openEditDialog(user);
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(put).toBe(false);
    });

    it('leaves sort order alone when the field is cleared', async () => {
        const user = userEvent.setup();
        let put: Record<string, unknown> | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow({ sortOrder: 40 })))),
            http.put(apiUrl('/launchers/l-1'), async ({ request }) => {
                put = (await request.json()) as Record<string, unknown>;

                return envelope(launcherRow({ sortOrder: 40, name: 'Design Studio' }));
            }),
        );

        renderControl();
        await openEditDialog(user);

        await user.clear(screen.getByLabelText('Sort order'));

        const name = screen.getByLabelText('Name on the tile');

        await user.clear(name);
        await user.type(name, 'Design Studio');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        // Blank is not zero: clearing the box must not pin the tile to the front of every home screen.
        await waitFor(() => expect(put).toEqual({ name: 'Design Studio' }));
    });

    it('puts a duplicate-URL conflict on the URL field, not the form', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            respond('put', '/launchers/l-1', () =>
                httpError(
                    409,
                    'Something with these details already exists. Change the values that have to be unique and try again.',
                ),
            ),
        );

        renderControl();
        await openEditDialog(user);

        const link = screen.getByLabelText('Link');

        await user.clear(link);
        await user.type(link, 'taken-slug');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('That URL is already taken. Try another.')).toBeInTheDocument();
        expect(link).toHaveAttribute('aria-invalid', 'true');
    });

    it('hides the launcher without destroying it', async () => {
        const user = userEvent.setup();
        let put: Record<string, unknown> | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            http.put(apiUrl('/launchers/l-1'), async ({ request }) => {
                put = (await request.json()) as Record<string, unknown>;

                return envelope(launcherRow({ isPublished: false }));
            }),
        );

        renderControl();
        await openEditDialog(user);
        await user.click(screen.getByLabelText('Show on the home screen'));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        // Hidden, not deleted, and nothing else is touched — the row keeps its name, link and order.
        await waitFor(() => expect(put).toEqual({ isPublished: false }));
    });

    it('deletes the launcher only after the confirmation is taken', async () => {
        const user = userEvent.setup();
        let deleted = false;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            respond('delete', '/launchers/l-1', () => {
                deleted = true;

                return envelope(null);
            }),
        );

        renderControl();
        await openEditDialog(user);
        await user.click(screen.getByRole('button', { name: 'Delete launcher' }));

        const confirm = await screen.findByRole('alertdialog');

        expect(deleted).toBe(false);

        await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(deleted).toBe(true));
    });

    it('refuses a URL the API would reject before sending it', async () => {
        const user = userEvent.setup();
        let put = false;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            respond('put', '/launchers/l-1', () => {
                put = true;

                return envelope(launcherRow());
            }),
        );

        renderControl();
        await openEditDialog(user);

        const link = screen.getByLabelText('Link');

        await user.clear(link);
        await user.type(link, 'Not A Slug!');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('Use lowercase letters, numbers and dashes only.')).toBeInTheDocument();
        expect(put).toBe(false);
    });
});

/**
 * Drives the real hook rather than a hand-wired host: the visibility row exists to be reachable
 * from the menu, so a test that assembles the parts itself would pass with the wiring deleted.
 */
const ControlsHost = ({ agentId = 'agent-1' }: { agentId?: string }) => {
    const { button, menuItem, dialogs } = useLauncherControls({ agentId, agentName: 'Spec Writer' });

    return (
        <>
            {button}
            <DropdownMenuRoot>
                <DropdownMenuTrigger aria-label={MENU}>Actions</DropdownMenuTrigger>
                <DropdownMenuContent>{menuItem}</DropdownMenuContent>
            </DropdownMenuRoot>
            {dialogs}
        </>
    );
};

const renderControls = () =>
    renderWithProviders(
        <Routes>
            <Route path="/agent-builder/:id" element={<ControlsHost />} />
        </Routes>,
        {
            route: '/agent-builder/agent-1',
            preloadedState: { user: { _id: 'user-1', role: 'admin' }, tenant: { hideCreateAgent: false } },
        },
    );

describe('LauncherVisibility', () => {
    it('offers unpublishing straight from the menu, without opening the editor', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))));

        renderControls();
        await user.click(await screen.findByRole('button', { name: MENU }));

        expect(await screen.findByRole('menuitem', { name: 'Unpublish launcher' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: EDIT })).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('hides the launcher without destroying it', async () => {
        const user = userEvent.setup();
        let put: Record<string, unknown> | null = null;
        let deleted = false;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            http.put(apiUrl('/launchers/l-1'), async ({ request }) => {
                put = (await request.json()) as Record<string, unknown>;

                return envelope(launcherRow({ isPublished: false }));
            }),
            respond('delete', '/launchers/l-1', () => {
                deleted = true;

                return envelope(null);
            }),
        );

        renderControls();
        await user.click(await screen.findByRole('button', { name: MENU }));
        await user.click(await screen.findByRole('menuitem', { name: 'Unpublish launcher' }));

        await waitFor(() => expect(put).toEqual({ isPublished: false }));
        expect(deleted).toBe(false);
    });

    it('puts a hidden launcher back on the home screen', async () => {
        const user = userEvent.setup();
        let put: Record<string, unknown> | null = null;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow({ isPublished: false })))),
            http.put(apiUrl('/launchers/l-1'), async ({ request }) => {
                put = (await request.json()) as Record<string, unknown>;

                return envelope(launcherRow());
            }),
        );

        renderControls();
        await user.click(await screen.findByRole('button', { name: MENU }));
        await user.click(await screen.findByRole('menuitem', { name: 'Publish launcher' }));

        await waitFor(() => expect(put).toEqual({ isPublished: true }));
    });

    it('reflects the new state in the menu and the top bar once it lands', async () => {
        const user = userEvent.setup();
        let published = true;

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow({ isPublished: published })))),
            respond('put', '/launchers/l-1', () => {
                published = false;

                return envelope(launcherRow({ isPublished: false }));
            }),
        );

        renderControls();
        await user.click(await screen.findByRole('button', { name: MENU }));
        await user.click(await screen.findByRole('menuitem', { name: 'Unpublish launcher' }));

        expect(await screen.findByRole('menuitem', { name: 'Publish launcher' })).toBeInTheDocument();

        // Radix marks everything outside an open menu aria-hidden, so the pill is only queryable
        // once the menu is dismissed.
        await user.keyboard('{Escape}');

        expect(await screen.findByRole('link', { name: /hidden from the home screen/ })).toBeInTheDocument();
    });

    it('refetches the agent it was fired for, not the one on screen when it lands', async () => {
        const user = userEvent.setup();
        const refetched: string[] = [];
        let putSeen = false;
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        server.use(
            respond('get', '/agents/agent-1', () => {
                refetched.push('agent-1');

                return envelope(agent(launcherRow()));
            }),
            respond('get', '/agents/agent-2', () => {
                refetched.push('agent-2');

                return envelope(agent(launcherRow({ _id: 'l-2' })));
            }),
            http.put(apiUrl('/launchers/l-1'), async () => {
                putSeen = true;
                await gate;

                return envelope(launcherRow({ isPublished: false }));
            }),
        );

        const { rerender } = renderWithProviders(<ControlsHost agentId="agent-1" />, {
            route: '/agent-builder/agent-1',
            preloadedState: { user: { _id: 'user-1', role: 'admin' }, tenant: { hideCreateAgent: false } },
        });

        await user.click(await screen.findByRole('button', { name: MENU }));
        await user.click(await screen.findByRole('menuitem', { name: 'Unpublish launcher' }));
        await waitFor(() => expect(putSeen).toBe(true));

        // The builder swaps `:id` in place, so the hook re-renders under a different agent while
        // the PUT is still open. react-query re-points a pending mutation at the newest options.
        rerender(<ControlsHost agentId="agent-2" />);
        refetched.length = 0;
        release();

        // agent-1 is the discriminator: read from the closure the refetch keys off agent-2 and
        // agent-1 is never refreshed, leaving a stale entry fresh for the full five-minute
        // staleTime. agent-2 showing up too is just the newly selected agent's own query.
        await waitFor(() => expect(refetched).toContain('agent-1'));
    });

    it('will not open the editor while a visibility change is still in flight', async () => {
        const user = userEvent.setup();
        let putSeen = false;
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            http.put(apiUrl('/launchers/l-1'), async () => {
                putSeen = true;
                await gate;

                return envelope(launcherRow({ isPublished: false }));
            }),
        );

        renderControls();
        await user.click(await screen.findByRole('button', { name: MENU }));
        await user.click(await screen.findByRole('menuitem', { name: 'Unpublish launcher' }));
        await waitFor(() => expect(putSeen).toBe(true));

        // The row keeps the menu open, so Edit is one click away mid-request. Opening it here would
        // seed the form from a GET that can beat the PUT, leaving the toggle claiming a state the
        // server has already moved off.
        await user.click(screen.getByRole('menuitem', { name: EDIT }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        release();
        await waitFor(() => expect(screen.getByRole('menuitem', { name: EDIT })).not.toHaveAttribute('data-disabled'));
    });

    it('stays absent until the agent actually has a launcher', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/agents/agent-1', () => envelope(agent(null))));

        renderControls();
        await user.click(await screen.findByRole('button', { name: MENU }));

        expect(screen.queryByRole('menuitem', { name: 'Unpublish launcher' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Publish launcher' })).not.toBeInTheDocument();
    });

    it('keeps the launcher published when the API rejects the change', async () => {
        const user = userEvent.setup();

        server.use(
            respond('get', '/agents/agent-1', () => envelope(agent(launcherRow()))),
            respond('put', '/launchers/l-1', () => httpError(403, 'Forbidden')),
        );

        renderControls();
        await user.click(await screen.findByRole('button', { name: MENU }));
        await user.click(await screen.findByRole('menuitem', { name: 'Unpublish launcher' }));

        // Still the published wording: a rejected call must not leave the row claiming a state the
        // server never reached.
        expect(await screen.findByRole('menuitem', { name: 'Unpublish launcher' })).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(await screen.findByRole('link', { name: /live on the home screen/ })).toBeInTheDocument();
    });
});

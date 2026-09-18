import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Toaster } from '@/components/ui/sonner';
import { installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { apiUrl, envelope, httpError, pagedEnvelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import { ROUTINE_MAX_RECIPIENTS, type RoutineTriggerRecord, type RoutineType } from '@/types/routines';

import { RoutineFormModal } from './routine-form-modal';

installRichTextDomShims();
installScrollIntoViewShim();

const NO_MODEL_WARNING = /has no models to choose from/;

// The trigger's own text is its accessible name, so it reads out the chosen space.
const SPACE_TRIGGER = { name: /^Space/ };

const routine: RoutineType = {
    _id: 'routine-1',
    agentId: 'agent-1',
    name: 'Weekly competitor scan',
    prompt: 'Track announcements from our top five competitors',
    cron: '0 9 * * 1',
    timezone: 'UTC',
    runOnce: false,
    status: 'active',
    lastRunAt: null,
    agent: { _id: 'agent-1', name: 'Research', slug: 'research' },
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
};

const models = [
    { _id: 'model-1', label: 'GPT 5.4 mini' },
    { _id: 'model-2', label: 'Claude Opus 5' },
];

const stubAgent = (detail: Record<string, unknown>) => {
    const requests: string[] = [];

    server.use(
        http.get(apiUrl('/agents/agent-1'), ({ request }) => {
            requests.push(new URL(request.url).search);

            // Routines are chat-only, so every fixture is a chat agent unless it deliberately says otherwise.
            const uiConfig = (detail.uiConfig ?? {}) as Record<string, unknown>;

            return envelope({
                _id: 'agent-1',
                name: 'Research',
                ...detail,
                uiConfig: { componentType: 'chat', ...uiConfig },
            });
        }),
        http.get(apiUrl('/agents'), () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])),
        http.get(apiUrl('/routines/connector-health'), () => envelope({ connectors: [] })),
    );

    return requests;
};

const renderEditForm = () => renderWithProviders(<RoutineFormModal open onOpenChange={vi.fn()} routine={routine} />);

const ROUTINES_OFF_NOTICE = /does not have routines turned on/;

const makeTrigger = (overrides: Partial<RoutineTriggerRecord> = {}): RoutineTriggerRecord => ({
    _id: 'trigger-1',
    routineId: 'routine-1',
    type: 'cron',
    cron: '0 9 * * 1',
    runAt: null,
    timezone: 'UTC',
    eventSource: null,
    eventFilter: null,
    cooldownSeconds: 0,
    status: 'active',
    lastFiredAt: null,
    scheduleSyncedAt: null,
    synced: true,
    legacy: false,
    createdAt: null,
    updatedAt: null,
    ...overrides,
});

// Only the read is stubbed: the per-trigger write endpoints have no caller left, so a call to one would
// fail as an unhandled request.
const stubTriggers = (records: RoutineTriggerRecord[]) => {
    server.use(respond('get', '/routines/routine-1/triggers', () => envelope({ values: records })));
};

const stubEventSources = (sources: { id: string; name: string }[]) => {
    server.use(http.get(apiUrl('/routines/event-sources'), () => HttpResponse.json({ sources })));
};

// The api gates its event ingress behind a flag of its own, so an empty list is the everyday answer.
beforeEach(() => stubEventSources([]));

const WEEKLY_NINE = { type: 'cron', cron: '0 9 * * 1', timezone: 'UTC', status: 'active' };

const DAILY_NINE = { type: 'cron', cron: '0 9 * * *', timezone: 'UTC', status: 'active' };

describe('RoutineFormModal', () => {
    it('shows the model every run will use', async () => {
        stubAgent({ defaultModelId: 'model-1', models });
        stubTriggers([makeTrigger()]);

        renderEditForm();

        expect(await screen.findByRole('combobox', { name: 'Model' })).toHaveTextContent(
            'Agent default (GPT 5.4 mini)',
        );
    });

    it('warns that runs will fail when the agent has no models at all', async () => {
        stubAgent({ models: [] });
        stubTriggers([makeTrigger()]);

        renderEditForm();

        expect(await screen.findByText(NO_MODEL_WARNING)).toBeInTheDocument();
    });

    it('warns in the form when a connector the agent needs is already disconnected', async () => {
        stubAgent({ defaultModelId: 'model-1', models });
        stubTriggers([makeTrigger()]);
        // Overrides the healthy default the shared stub registers.
        server.use(
            http.get(apiUrl('/routines/connector-health'), () =>
                envelope({ connectors: [{ _id: 'conn-1', name: 'Microsoft 365 (PW)', health: 'needs_reconnect' }] }),
            ),
        );

        renderEditForm();

        // On the composer it warns about, as the chat banner is: a chip per connector, not a block.
        expect(await screen.findByRole('link', { name: 'Reconnect Microsoft 365 (PW)' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Needs reconnecting' })).toBeInTheDocument();
    });

    it('drops the connector warning for an agent whose routines are off, since that notice blocks first', async () => {
        stubAgent({ defaultModelId: 'model-1', models, uiConfig: { routines: { enabled: false } } });
        stubTriggers([makeTrigger()]);
        server.use(
            http.get(apiUrl('/routines/connector-health'), () =>
                envelope({ connectors: [{ _id: 'conn-1', name: 'Microsoft 365 (PW)', health: 'needs_reconnect' }] }),
            ),
        );

        renderEditForm();

        expect(await screen.findByText(ROUTINES_OFF_NOTICE)).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Needs reconnecting' })).not.toBeInTheDocument();
    });

    it('omits the model key when the user left it on the agent default', async () => {
        stubAgent({ defaultModelId: 'model-1', models });
        stubTriggers([makeTrigger()]);

        const bodies: Record<string, unknown>[] = [];

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        renderEditForm();

        await screen.findByRole('combobox', { name: 'Model' });
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ agentId: 'agent-1' });
        expect(bodies[0]).not.toHaveProperty('modelId');
    });

    it('blocks a routine for an agent that has routines turned off', async () => {
        stubAgent({ defaultModelId: 'model-1', models, uiConfig: { routines: { enabled: false } } });
        stubTriggers([makeTrigger()]);

        renderEditForm();

        expect(await screen.findByText(ROUTINES_OFF_NOTICE)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('allows a routine for an agent whose ui config omits routines', async () => {
        stubAgent({ defaultModelId: 'model-1', models, uiConfig: {} });
        stubTriggers([makeTrigger()]);

        renderEditForm();

        await screen.findByRole('combobox', { name: 'Model' });
        expect(screen.queryByText(ROUTINES_OFF_NOTICE)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    it('never blocks while the agent record is still unknown', async () => {
        server.use(
            http.get(apiUrl('/agents/agent-1'), () => new Response(null, { status: 500 })),
            http.get(apiUrl('/agents'), () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])),
            http.get(apiUrl('/routines/connector-health'), () => envelope({ connectors: [] })),
        );
        stubTriggers([makeTrigger()]);

        renderEditForm();

        expect(await screen.findByText(/models could not be loaded/)).toBeInTheDocument();
        expect(screen.queryByText(ROUTINES_OFF_NOTICE)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    it('blocks a routine when a recommended connector is not connected', async () => {
        stubAgent({
            defaultModelId: 'model-1',
            models,
            mcpServers: [
                {
                    _id: 'mcp-1',
                    name: 'Freshservice',
                    isRecommended: true,
                    status: 'active',
                    authType: 'oauth',
                    connection: null,
                    effectiveEnabled: true,
                },
            ],
        });
        stubTriggers([makeTrigger()]);

        renderEditForm();

        expect(await screen.findByText(/Freshservice/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('allows a routine once its recommended connector is connected', async () => {
        stubAgent({
            defaultModelId: 'model-1',
            models,
            mcpServers: [
                {
                    _id: 'mcp-1',
                    name: 'Freshservice',
                    isRecommended: true,
                    status: 'active',
                    authType: 'oauth',
                    connection: { status: 'connected', tokenExpiry: null },
                    effectiveEnabled: true,
                },
            ],
        });
        stubTriggers([makeTrigger()]);

        renderEditForm();

        await screen.findByRole('combobox', { name: 'Model' });
        expect(screen.queryByText(/Freshservice/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    it('starts the connect flow when the notice offers to fix a never-connected connector', async () => {
        const connectCalls: string[] = [];

        stubAgent({
            defaultModelId: 'model-1',
            models,
            mcpServers: [
                {
                    _id: 'mcp-1',
                    name: 'Freshservice',
                    isRecommended: true,
                    status: 'active',
                    authType: 'oauth',
                    connection: null,
                    effectiveEnabled: true,
                },
            ],
        });
        stubTriggers([makeTrigger()]);
        server.use(
            http.get(apiUrl('/mcpservers/:id/connect'), ({ params }) => {
                connectCalls.push(params.id as string);

                return envelope({ authorizationUrl: 'https://provider.test/authorize' });
            }),
        );

        renderEditForm();

        await userEvent.click(await screen.findByRole('button', { name: 'Connect Freshservice' }));

        await waitFor(() => expect(connectCalls).toEqual(['mcp-1']));
    });

    it('turns on a recommended connector that is only switched off, without an auth redirect', async () => {
        const preferenceWrites: { id: string; body: unknown }[] = [];
        const connectCalls: string[] = [];

        // Connected, so nothing to authorize — only the per-agent preference is off. That is the one
        // branch of the fix that must NOT leave the page.
        stubAgent({
            defaultModelId: 'model-1',
            models,
            mcpServers: [
                {
                    _id: 'mcp-1',
                    name: 'Freshservice',
                    isRecommended: true,
                    status: 'active',
                    authType: 'oauth',
                    connection: { status: 'connected', tokenExpiry: null },
                    effectiveEnabled: false,
                },
            ],
        });
        stubTriggers([makeTrigger()]);
        server.use(
            http.put(apiUrl('/mcpservers/:id/preferences'), async ({ params, request }) => {
                preferenceWrites.push({ id: params.id as string, body: await request.json() });

                return envelope({ mcpServerId: params.id, disabled: false });
            }),
            http.get(apiUrl('/mcpservers/:id/connect'), ({ params }) => {
                connectCalls.push(params.id as string);

                return envelope({ authorizationUrl: 'https://provider.test/authorize' });
            }),
        );

        renderEditForm();

        await userEvent.click(await screen.findByRole('button', { name: 'Enable Freshservice' }));

        await waitFor(() => expect(preferenceWrites).toHaveLength(1));
        expect(preferenceWrites[0]).toMatchObject({ id: 'mcp-1', body: { disabled: false } });
        expect(connectCalls).toEqual([]);
    });

    it('opens the form when the connector check itself fails with nothing to go on', async () => {
        // Connector state comes from its own endpoint, so fail that alone and leave the detail
        // record intact. With no readable connector list there is nothing to block on, and
        // blocking on nothing would strand the viewer over a service blip.
        server.use(
            http.get(apiUrl('/agents/agent-1'), () =>
                envelope({
                    _id: 'agent-1',
                    name: 'Research',
                    defaultModelId: 'model-1',
                    models,
                    uiConfig: { componentType: 'chat' },
                }),
            ),
            http.get(apiUrl('/agents'), () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])),
            http.get(apiUrl('/routines/connector-health'), () => httpError(500, 'boom')),
        );
        stubTriggers([makeTrigger()]);

        renderEditForm();

        await screen.findByRole('combobox', { name: 'Model' });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled());
        expect(screen.queryByText(/can't run a routine until/)).not.toBeInTheDocument();
    });

    it('keeps the edit-mode title and submit label', async () => {
        stubAgent({ defaultModelId: 'model-1', models });
        stubTriggers([makeTrigger()]);

        renderEditForm();

        expect(await screen.findByText('Edit routine')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });
});

describe('RoutineFormModal spaces', () => {
    const stubSpaces = () => {
        server.use(
            respond('get', '/projects', () =>
                pagedEnvelope([
                    { _id: 'project-1', name: 'Atlas' },
                    { _id: 'project-2', name: 'Borealis' },
                ]),
            ),
            respond('get', '/projects/project-1', () => envelope({ _id: 'project-1', name: 'Atlas' })),
            respond('get', '/projects/project-2', () => envelope({ _id: 'project-2', name: 'Borealis' })),
        );
    };

    const stubSpacesAgent = () =>
        stubAgent({ defaultModelId: 'model-1', models, uiConfig: { spaces: { enabled: true } } });

    const captureUpdates = () => {
        const bodies: Record<string, unknown>[] = [];

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        return bodies;
    };

    it('names both prompt toolbar controls for assistive tech', async () => {
        stubSpacesAgent();
        stubSpaces();
        stubTriggers([makeTrigger()]);

        renderEditForm();

        expect(await screen.findByRole('button', SPACE_TRIGGER)).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Model' })).toBeInTheDocument();
    });

    it('sends the chosen space', async () => {
        stubSpacesAgent();
        stubSpaces();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderEditForm();

        await userEvent.click(await screen.findByRole('button', SPACE_TRIGGER));
        await userEvent.click(await screen.findByText('Atlas'));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Clear space' })).toBeInTheDocument());
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ projectId: 'project-1' });
    });

    it('shows the space it just picked, not the one it started from', async () => {
        stubSpacesAgent();
        stubSpaces();
        stubTriggers([makeTrigger()]);
        captureUpdates();

        renderWithProviders(
            <RoutineFormModal
                open
                onOpenChange={vi.fn()}
                routine={{ ...routine, projectId: 'project-1', project: { _id: 'project-1', name: 'Atlas' } }}
            />,
        );

        await userEvent.click(await screen.findByRole('button', SPACE_TRIGGER));
        await userEvent.click(await screen.findByText('Borealis'));

        expect(await screen.findByRole('button', SPACE_TRIGGER)).toHaveTextContent('Borealis');
    });

    it('omits the space key when none is chosen', async () => {
        stubSpacesAgent();
        stubSpaces();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderEditForm();

        expect(await screen.findByRole('button', SPACE_TRIGGER)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('projectId');
    });

    it('hides the field for an agent that does not have spaces turned on', async () => {
        stubAgent({ defaultModelId: 'model-1', models });
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderEditForm();

        await screen.findByRole('combobox', { name: 'Model' });
        expect(screen.queryByRole('button', SPACE_TRIGGER)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('projectId');
    });

    it('clears a space the routine already had', async () => {
        stubSpacesAgent();
        stubSpaces();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderWithProviders(
            <RoutineFormModal
                open
                onOpenChange={vi.fn()}
                routine={{ ...routine, projectId: 'project-1', project: { _id: 'project-1', name: 'Atlas' } }}
            />,
        );

        await userEvent.click(await screen.findByRole('button', { name: 'Clear space' }));
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ projectId: null });
    });
});

describe('RoutineFormModal model, email and triggers', () => {
    const uiModels = [
        { name: 'GPT 5.4 mini', modelId: 'model-1' },
        { name: 'Claude Opus 5', modelId: 'model-2' },
    ];

    const stubNewBackendAgent = () => stubAgent({ defaultModelId: 'model-1', models, uiConfig: { models: uiModels } });

    const captureUpdates = () => {
        const bodies: Record<string, unknown>[] = [];

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        return bodies;
    };

    const renderRoutine = (overrides: Partial<RoutineType> = {}) =>
        renderWithProviders(<RoutineFormModal open onOpenChange={vi.fn()} routine={{ ...routine, ...overrides }} />);

    const save = async () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const pick = async (comboboxName: string, optionLabel: string) => {
        await userEvent.click(await screen.findByRole('combobox', { name: comboboxName }));
        await userEvent.click(await screen.findByText(optionLabel));
    };

    const setTime = async (hour: string, minute: string, meridiem: 'AM' | 'PM') => {
        await userEvent.click(await screen.findByRole('button', { name: 'Time of day' }));

        const hourField = await screen.findByLabelText('Hour');
        const minuteField = await screen.findByLabelText('Minute');

        await userEvent.clear(hourField);
        await userEvent.type(hourField, hour);
        await userEvent.clear(minuteField);
        await userEvent.type(minuteField, minute);
        await userEvent.click(screen.getByRole('button', { name: meridiem }));
        await userEvent.keyboard('{Escape}');
    };

    const stubDefaultlessAgent = () => stubAgent({ models, uiConfig: { models: uiModels } });

    it('preselects the first model when the agent has no default', async () => {
        stubDefaultlessAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        expect(await screen.findByRole('combobox', { name: 'Model' })).toHaveTextContent('GPT 5.4 mini');
        expect(screen.queryByText(NO_MODEL_WARNING)).not.toBeInTheDocument();

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ modelId: 'model-1' });
    });

    it('holds the save until the agent record decides the model', async () => {
        let releaseAgent: (() => void) | null = null;
        const agentLoaded = new Promise<void>((resolve) => {
            releaseAgent = resolve;
        });

        server.use(
            http.get(apiUrl('/routines/connector-health'), () => envelope({ connectors: [] })),
            http.get(apiUrl('/agents/agent-1'), async () => {
                await agentLoaded;

                return envelope({ _id: 'agent-1', name: 'Research', models, uiConfig: { models: uiModels } });
            }),
        );
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled());

        releaseAgent!();

        expect(await screen.findByRole('combobox', { name: 'Model' })).toHaveTextContent('GPT 5.4 mini');

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ modelId: 'model-1' });
    });

    it('leaves no way to fall back to a default the agent does not have', async () => {
        stubDefaultlessAgent();
        stubTriggers([makeTrigger()]);

        renderRoutine();

        await userEvent.click(await screen.findByRole('combobox', { name: 'Model' }));

        expect(await screen.findByText('Claude Opus 5')).toBeInTheDocument();
        expect(screen.queryByText(/Agent default/)).not.toBeInTheDocument();
    });

    it('sends the model the user picked', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await pick('Model', 'Claude Opus 5');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ modelId: 'model-2' });
    });

    it('sends null to fall back to the agent default', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine({ modelId: 'model-2', model: { _id: 'model-2', label: 'Claude Opus 5', model: 'opus-5' } });

        await pick('Model', 'Agent default (GPT 5.4 mini)');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ modelId: null });
    });

    it('keeps a model the agent no longer offers instead of resetting it', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine({ modelId: 'model-9', model: { _id: 'model-9', label: null, model: 'retired-sonnet' } });

        expect(await screen.findByText(/no longer one of Research/)).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent('retired-sonnet');

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('modelId');
    });

    it('sends the email-on-run choice, and only when it changed', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);
        // Choosing Email reveals the recipient picker, which resolves the pre-filled owner.
        server.use(respond('get', '/users/me', () => envelope({ _id: 'owner-1', email: 'ada@ex.com' })));

        const bodies = captureUpdates();

        renderRoutine();

        await userEvent.click(await screen.findByRole('combobox', { name: 'Notification' }));
        await userEvent.click(await screen.findByRole('option', { name: 'Email' }));
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ emailOnRun: true });
    });

    it('never writes email-on-run off just because the form defaulted it', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await userEvent.type(await screen.findByPlaceholderText('Weekly competitor scan'), '!');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('emailOnRun');
    });

    it('sends the deep-research choice, and only when it changed', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await userEvent.click(await screen.findByRole('button', { name: 'Deep research' }));
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ deepResearch: true });
    });

    it('never writes deep research off just because the form defaulted it', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await userEvent.type(await screen.findByPlaceholderText('Weekly competitor scan'), '!');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('deepResearch');
    });

    it('turns a scheduled trigger into a manual-only one when it is cleared', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await userEvent.click(await screen.findByRole('button', { name: 'Remove trigger' }));
        expect(screen.getByRole('button', { name: 'Add trigger' })).toBeInTheDocument();

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([{ type: 'manual', status: 'active' }]);
    });

    it('leads a schedule row with its frequency, not a trigger-type chip', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);
        captureUpdates();

        renderRoutine();

        expect(await screen.findByRole('combobox', { name: 'Frequency' })).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Trigger type' })).not.toBeInTheDocument();
    });

    it('seeds a menu-added hourly trigger with every day', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);
        captureUpdates();

        renderRoutine();

        await userEvent.click(await screen.findByRole('button', { name: 'Remove trigger' }));
        await userEvent.click(screen.getByRole('button', { name: 'Add trigger' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: /Hourly/ }));

        expect(await screen.findByRole('button', { name: 'Days of week' })).toHaveTextContent('Every day');
    });

    it('picks weekly days through the day circles', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        const dayChip = await screen.findByRole('button', { name: 'Days of week' });

        expect(dayChip).toHaveTextContent('Mon');

        await userEvent.click(dayChip);

        // The last selected day cannot be turned off.
        await userEvent.click(await screen.findByRole('button', { name: 'Monday' }));
        expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true');

        await userEvent.click(screen.getByRole('button', { name: 'Wednesday' }));
        await userEvent.keyboard('{Escape}');

        expect(dayChip).toHaveTextContent('Mon, Wed');

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([{ type: 'cron', cron: '0 9 * * 1,3', timezone: 'UTC', status: 'active' }]);
    });

    it('edits the hourly window through a single Between chip', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await pick('Frequency', 'Hourly');

        await userEvent.click(screen.getByRole('button', { name: 'Between 9:00 AM – 6:00 PM' }));
        await pick('To', '8:00 PM');
        await userEvent.keyboard('{Escape}');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([{ type: 'cron', cron: '0 9-20 * * *', timezone: 'UTC', status: 'active' }]);
    });

    // The form adds no triggers of its own, but a routine stored with several still has to survive an edit
    // to one of them: the set is written whole, so an untouched sibling has to come back out unchanged.
    it('sends back every trigger a routine already had when one of them is edited', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger(), makeTrigger({ _id: 'trigger-2', cron: '0 9 * * *' })]);

        const bodies = captureUpdates();

        renderRoutine();

        const frequencies = await screen.findAllByRole('combobox', { name: 'Frequency' });

        await userEvent.click(frequencies[0]);
        await userEvent.click(await screen.findByRole('option', { name: 'Daily' }));
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([DAILY_NINE, DAILY_NINE]);
    });

    it('offers no per-trigger pause, only the routine-level one', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);
        captureUpdates();

        renderRoutine();

        expect(await screen.findByRole('button', { name: 'Remove trigger' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pause trigger' })).not.toBeInTheDocument();
    });

    it('still offers Resume on a trigger stored as paused', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ status: 'paused' })]);

        const bodies = captureUpdates();

        renderRoutine();

        expect(await screen.findByText('Paused')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Resume trigger' }));
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([WEEKLY_NINE]);
    });

    it('writes a one-off as a wall clock in the trigger timezone', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ type: 'once', cron: null, runAt: '2028-12-25T09:00', timezone: 'Asia/Kolkata' })]);

        const bodies = captureUpdates();

        renderRoutine();

        await setTime('10', '30', 'AM');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([
            { type: 'once', runAt: '2028-12-25T10:30:00', timezone: 'Asia/Kolkata', status: 'active' },
        ]);
    });

    it('leaves a removed trigger out of the set it writes', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger(), makeTrigger({ _id: 'trigger-2', cron: '0 18 * * *' })]);

        const bodies = captureUpdates();

        renderRoutine();

        const removes = await screen.findAllByRole('button', { name: 'Remove trigger' });

        await userEvent.click(removes[1]);
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([WEEKLY_NINE]);
    });

    it('swaps the only trigger for a manual one when it is removed', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);
        captureUpdates();

        renderRoutine();

        // The api rejects an empty trigger set, so clearing the last row leaves a manual routine,
        // shown as the empty Add box.
        await userEvent.click(await screen.findByRole('button', { name: 'Remove trigger' }));

        expect(await screen.findByRole('button', { name: 'Add trigger' })).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Frequency' })).not.toBeInTheDocument();
    });

    // A legacy row is synthesised from the routine's own columns, so materialising it could leave the api
    // firing both it and the row it was synthesised from.
    it('never turns a synthesised legacy trigger into a real one', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ _id: null, legacy: true })]);

        const bodies = captureUpdates();

        renderRoutine();

        expect(await screen.findByText(/cannot rewrite/)).toBeInTheDocument();

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('triggers');
    });

    it('surfaces a schedule Temporal has not confirmed', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ synced: false })]);
        captureUpdates();

        renderRoutine();

        expect(await screen.findByText('Not scheduled yet')).toBeInTheDocument();
        expect(screen.getByText(/has not confirmed this schedule/)).toBeInTheDocument();
        // The screen may not promise a time it has just said will not arrive.
        expect(screen.queryByText(/Next run:/)).not.toBeInTheDocument();
    });

    it('leaves every trigger alone when only the name changed', async () => {
        stubNewBackendAgent();

        stubTriggers([makeTrigger()]);

        const bodies = captureUpdates();

        renderRoutine();

        await userEvent.type(await screen.findByPlaceholderText('Weekly competitor scan'), '!');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).toMatchObject({ name: 'Weekly competitor scan!' });
        expect(bodies[0]).not.toHaveProperty('triggers');
        expect(bodies[0]).not.toHaveProperty('cron');
    });

    it('carries an event trigger and a spent one-shot over unchanged when a sibling changes', async () => {
        stubNewBackendAgent();
        stubTriggers([
            makeTrigger({
                _id: 'trigger-event',
                type: 'event',
                cron: null,
                eventSource: 'file.uploaded',
                cooldownSeconds: 300,
            }),
            makeTrigger({ _id: 'trigger-spent', type: 'once', cron: null, runAt: '2026-01-01T09:00', status: 'spent' }),
            makeTrigger({ _id: 'trigger-cron' }),
        ]);

        const bodies = captureUpdates();

        renderRoutine();

        expect(await screen.findByText(/Runs on file.uploaded, at most once every 5 min/)).toBeInTheDocument();
        expect(screen.getByText('Already ran')).toBeInTheDocument();

        // The spent one-shot also shows a Frequency chip, so target the cron row's — the last one.
        const frequencies = screen.getAllByRole('combobox', { name: 'Frequency' });

        await userEvent.click(frequencies[frequencies.length - 1]);
        await userEvent.click(await screen.findByRole('option', { name: 'Daily' }));
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([
            {
                type: 'event',
                eventSource: 'file.uploaded',
                eventFilter: null,
                cooldownSeconds: 300,
                status: 'active',
            },
            { type: 'once', runAt: '2026-01-01T09:00:00', timezone: 'UTC', status: 'paused' },
            DAILY_NINE,
        ]);
    });

    it('saves the trigger set with the routine when creating one', async () => {
        stubNewBackendAgent();

        const bodies: Record<string, unknown>[] = [];

        server.use(
            http.post(apiUrl('/routines'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        renderWithProviders(
            <RoutineFormModal open onOpenChange={vi.fn()} agent={{ _id: 'agent-1', name: 'Research' }} />,
        );

        await userEvent.type(screen.getByPlaceholderText('Weekly competitor scan'), 'Daily scan');
        // The Instructions editor is a contenteditable without an accessible-name association.
        await userEvent.type(
            document.querySelector<HTMLElement>('.chat-editor__content[contenteditable="true"]')!,
            'Track competitor launches',
        );

        // A new routine starts manual: no trigger row yet, just the empty Add box.
        expect(screen.getByRole('button', { name: 'Add trigger' })).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Frequency' })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Create routine' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([{ type: 'manual', status: 'active' }]);
        expect(bodies[0]).not.toHaveProperty('cron');
    });

    it('still saves the rest of the form when the triggers cannot be loaded', async () => {
        stubNewBackendAgent();

        const bodies = captureUpdates();

        server.use(respond('get', '/routines/routine-1/triggers', () => new Response(null, { status: 500 })));

        renderRoutine();

        expect(await screen.findByText(/triggers could not be loaded/)).toBeInTheDocument();

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('triggers');
    });

    it('re-arms a one-shot that already fired when its date is changed', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ type: 'once', cron: null, runAt: '2028-12-25T09:00', status: 'spent' })]);

        const bodies = captureUpdates();

        renderRoutine();

        await setTime('11', '15', 'AM');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([
            { type: 'once', runAt: '2028-12-25T11:15:00', timezone: 'UTC', status: 'active' },
        ]);
    });

    it('repeats the identical set when a failed save is retried', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger(), makeTrigger({ _id: 'trigger-2', cron: '0 9 * * *' })]);

        const bodies: Record<string, unknown>[] = [];
        let attempts = 0;

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                attempts += 1;
                bodies.push((await request.json()) as Record<string, unknown>);

                if (attempts === 1) return new Response(null, { status: 500 });

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        renderRoutine();

        const frequencies = await screen.findAllByRole('combobox', { name: 'Frequency' });

        await userEvent.click(frequencies[0]);
        await userEvent.click(await screen.findByRole('option', { name: 'Daily' }));
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));

        await save();

        await waitFor(() => expect(bodies).toHaveLength(2));
        expect(bodies[1].triggers).toEqual(bodies[0].triggers);
        expect(bodies[0].triggers).toEqual([DAILY_NINE, DAILY_NINE]);
    });

    it('leaves the whole set alone when it holds a trigger this form cannot rewrite', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ type: 'once', cron: null, runAt: null })]);

        const bodies = captureUpdates();

        renderRoutine();

        expect(await screen.findByText(/cannot rewrite/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('triggers');
    });

    it('never offers an event trigger while the api reports no event sources', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);
        captureUpdates();

        renderRoutine();

        await userEvent.click(await screen.findByRole('button', { name: 'Remove trigger' }));
        await userEvent.click(screen.getByRole('button', { name: 'Add trigger' }));

        expect(await screen.findByText('Hourly')).toBeInTheDocument();
        expect(screen.queryByText('Events')).not.toBeInTheDocument();
    });

    it('leaves the set alone when a stored event trigger has a cooldown the api would reject', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ _id: 'trigger-event', type: 'event', cron: null, eventSource: 'file.uploaded' })]);

        const bodies = captureUpdates();

        renderRoutine();

        expect(await screen.findByText(/cannot rewrite/)).toBeInTheDocument();

        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('triggers');
    });

    it('never offers to resume a one-shot whose date has already gone by', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger({ type: 'once', cron: null, runAt: '2020-01-01T09:00', status: 'paused' })]);
        captureUpdates();

        renderRoutine();

        expect(await screen.findByText('Paused')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Resume trigger' })).not.toBeInTheDocument();
    });

    // A paused one-shot whose date has gone by has no Resume, so moving the date forward has to be the way
    // back to armed — otherwise the form takes a date it can never fire.
    it('offers Resume again once a paused one-shot is moved to a future date', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date('2026-08-28T12:00:00Z'));

        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        try {
            stubNewBackendAgent();
            stubTriggers([makeTrigger({ type: 'once', cron: null, runAt: '2026-08-01T09:00', status: 'paused' })]);

            const bodies = captureUpdates();

            renderRoutine();

            expect(await screen.findByText('Paused')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Resume trigger' })).not.toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Run date' }));
            await user.click(await screen.findByRole('button', { name: 'Sunday, August 30th, 2026' }));

            await user.click(await screen.findByRole('button', { name: 'Resume trigger' }));
            await user.click(screen.getByRole('button', { name: 'Save changes' }));

            await waitFor(() => expect(bodies).toHaveLength(1));
            expect(bodies[0].triggers).toEqual([
                { type: 'once', runAt: '2026-08-30T09:00:00', timezone: 'UTC', status: 'active' },
            ]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('writes an event trigger with the source and cooldown that were picked', async () => {
        stubNewBackendAgent();
        stubTriggers([makeTrigger()]);
        stubEventSources([{ id: 'file.uploaded', name: 'File uploaded' }]);

        const bodies = captureUpdates();

        renderRoutine();

        await userEvent.click(await screen.findByRole('button', { name: 'Remove trigger' }));
        await userEvent.click(screen.getByRole('button', { name: 'Add trigger' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: /File uploaded/ }));

        await pick('Cooldown', '15 min');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].triggers).toEqual([
            {
                type: 'event',
                eventSource: 'file.uploaded',
                eventFilter: null,
                cooldownSeconds: 900,
                status: 'active',
            },
        ]);
    });
});

describe('RoutineFormModal instructions mentions', () => {
    const agentCapabilities = {
        defaultModelId: 'model-1',
        models,
        skills: [{ _id: 'skill-1', name: 'Deep Research', description: 'Digs deep' }],
        mcpServers: [{ _id: 'mcp-1', name: 'Linear', authType: 'apiKey', serverUrl: 'https://linear.example.com' }],
        tools: [{ _id: 'tool-1', refName: 'web_search', name: 'Web Search' }],
    };

    const getEditor = (): HTMLElement => {
        const editor = document.querySelector<HTMLElement>('.chat-editor__content[contenteditable="true"]');

        if (!editor) throw new Error('instructions editor not mounted');

        return editor;
    };

    const getMentionMenu = (): HTMLElement => {
        const menu = document.querySelector<HTMLElement>('.chat-editor-suggestion');

        if (!menu) throw new Error('mention menu not open');

        return menu;
    };

    it('offers the agent tools, skills and connectors under "@" and stores the chat directive text', async () => {
        stubAgent(agentCapabilities);
        stubTriggers([makeTrigger()]);

        const bodies: Record<string, unknown>[] = [];

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        renderEditForm();

        await screen.findByRole('combobox', { name: 'Model' });
        await userEvent.type(getEditor(), '@');

        const menu = within(getMentionMenu());

        expect(await menu.findByText('Deep Research')).toBeInTheDocument();
        expect(menu.getByText('Linear')).toBeInTheDocument();
        expect(menu.getByText('Web Search')).toBeInTheDocument();

        // The menu selects on mousedown; jsdom never loads the stylesheet that restores
        // pointer-events over the dialog's scroll-lock, so user-event refuses a full click here.
        fireEvent.mouseDown(menu.getByText('Deep Research'));

        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].prompt).toContain(':skill[Deep%20Research]{name=skill-1}');
        expect(bodies[0].prompt).toContain('Track announcements from our top five competitors');
    });

    it('renders a stored directive as a chip and keeps the text intact on an untouched save', async () => {
        stubAgent(agentCapabilities);
        stubTriggers([makeTrigger()]);

        const promptWithDirective = 'Use :skill[Deep%20Research]{name=skill-1} weekly';
        const bodies: Record<string, unknown>[] = [];

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        renderWithProviders(
            <RoutineFormModal open onOpenChange={vi.fn()} routine={{ ...routine, prompt: promptWithDirective }} />,
        );

        await screen.findByRole('combobox', { name: 'Model' });

        const chip = getEditor().querySelector('.directive-highlight');

        expect(chip).not.toBeNull();
        expect(chip).toHaveTextContent('Deep Research');

        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].prompt).toBe(promptWithDirective);
    });

    it('never offers an agent whose surface it could not read, rather than refusing it later', async () => {
        server.use(
            http.get(apiUrl('/agents'), () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])),
            http.get(apiUrl('/agents/agent-1'), () => new Response(null, { status: 500 })),
        );

        renderWithProviders(<RoutineFormModal open onOpenChange={vi.fn()} />);

        await userEvent.click(await screen.findByText('Select an agent...'));

        expect(await screen.findByText('No option found.')).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Research' })).not.toBeInTheDocument();
        // The agent cannot be chosen, so there is nothing to explain away in a banner.
        expect(screen.queryByText(/could not confirm/)).not.toBeInTheDocument();
    });

    it('hints to pick an agent before any agent is chosen in the settings dialog', async () => {
        server.use(http.get(apiUrl('/agents'), () => pagedEnvelope([{ _id: 'agent-1', name: 'Research' }])));

        renderWithProviders(<RoutineFormModal open onOpenChange={vi.fn()} />);

        await userEvent.type(getEditor(), '@');

        expect(await within(getMentionMenu()).findByText('Pick an agent first')).toBeInTheDocument();
    });

    it('refreshes the "@" list when the settings dialog switches agents', async () => {
        server.use(
            http.get(apiUrl('/routines/connector-health'), () => envelope({ connectors: [] })),
            http.get(apiUrl('/agents'), () =>
                pagedEnvelope([
                    { _id: 'agent-1', name: 'Research' },
                    { _id: 'agent-2', name: 'Metrics' },
                ]),
            ),
            // The picker offers only agents whose record proves routines are available on them.
            http.get(apiUrl('/agents/agent-1'), () =>
                envelope({
                    _id: 'agent-1',
                    name: 'Research',
                    ...agentCapabilities,
                    uiConfig: { componentType: 'chat' },
                }),
            ),
            http.get(apiUrl('/agents/agent-2'), () =>
                envelope({
                    _id: 'agent-2',
                    name: 'Metrics',
                    defaultModelId: 'model-1',
                    models,
                    skills: [{ _id: 'skill-2', name: 'Metrics Digest' }],
                    uiConfig: { componentType: 'chat' },
                }),
            ),
        );

        renderWithProviders(<RoutineFormModal open onOpenChange={vi.fn()} />);

        await userEvent.click(await screen.findByText('Select an agent...'));
        await userEvent.click(await screen.findByRole('option', { name: 'Research' }));

        await userEvent.type(getEditor(), '@');
        expect(await within(getMentionMenu()).findByText('Deep Research')).toBeInTheDocument();

        fireEvent.mouseDown(within(getMentionMenu()).getByText('Deep Research'));

        await userEvent.click(screen.getByText('Research', { selector: 'button *, button' }));
        await userEvent.click(await screen.findByRole('option', { name: 'Metrics' }));

        await userEvent.type(getEditor(), '@');

        const menu = within(getMentionMenu());

        expect(await menu.findByText('Metrics Digest')).toBeInTheDocument();
        expect(menu.queryByText('Deep Research')).not.toBeInTheDocument();
    });
});

describe('RoutineFormModal recipients', () => {
    const uiModels = [{ name: 'GPT 5.4 mini', modelId: 'model-1' }];

    const stubPeople = () => {
        server.use(
            respond('get', '/users/me', () =>
                envelope({ _id: 'owner-1', name: { first: 'Ada', last: 'Lovelace' }, email: 'ada@ex.com' }),
            ),
            // A stored list that came back empty means the OWNER, resolved by id rather than assumed.
            respond('get', '/users/owner-1', () =>
                envelope({ _id: 'owner-1', name: { first: 'Ada', last: 'Lovelace' }, email: 'ada@ex.com' }),
            ),
            respond('get', '/users', () =>
                pagedEnvelope([
                    { _id: 'owner-1', name: { first: 'Ada', last: 'Lovelace' }, email: 'ada@ex.com' },
                    { _id: 'u2', name: { first: 'Grace', last: 'Hopper' }, email: 'grace@ex.com' },
                    { _id: 'u3', name: { first: 'Alan', last: 'Turing' }, email: 'alan@ex.com' },
                ]),
            ),
        );
    };

    const captureUpdates = () => {
        const bodies: Record<string, unknown>[] = [];

        server.use(
            http.put(apiUrl('/routines/routine-1'), async ({ request }) => {
                bodies.push((await request.json()) as Record<string, unknown>);

                return envelope(routine);
            }),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        return bodies;
    };

    const renderRoutine = (overrides: Partial<RoutineType> = {}) =>
        renderWithProviders(<RoutineFormModal open onOpenChange={vi.fn()} routine={{ ...routine, ...overrides }} />);

    const save = async () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const openPicker = async () => {
        await userEvent.click(await screen.findByRole('combobox', { name: 'Recipients' }));

        return screen.findByPlaceholderText('Search by name or email...');
    };

    // A pre-AMP-600 routine as the api projects it: the list is present and EMPTY, which means the
    // owner — `creatorId` is who the pre-fill resolves.
    const emailOn = { emailOnRun: true, creatorId: 'owner-1', recipients: [] };

    beforeEach(() => {
        stubAgent({ defaultModelId: 'model-1', models, uiConfig: { models: uiModels } });
        stubTriggers([makeTrigger()]);
        stubPeople();
    });

    it('pre-fills the owner', async () => {
        renderRoutine(emailOn);

        const picker = await screen.findByRole('combobox', { name: 'Recipients' });

        await waitFor(() => expect(picker).toHaveTextContent('Ada Lovelace'));
    });

    it('stays hidden until a run is set to email, since an empty list still emails the owner', async () => {
        renderRoutine({ emailOnRun: false });

        expect(await screen.findByRole('combobox', { name: 'Notification' })).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Recipients' })).not.toBeInTheDocument();
    });

    it('offers candidates with the address the routine response never carries', async () => {
        renderRoutine(emailOn);
        await openPicker();

        expect(await screen.findByText('grace@ex.com')).toBeInTheDocument();
    });

    it('sends user ids, not addresses', async () => {
        const bodies = captureUpdates();

        renderRoutine(emailOn);
        await openPicker();
        await userEvent.click(await screen.findByText('Grace Hopper'));
        // The picker stays open for a second pick, and a modal popover hides the footer from AT.
        await userEvent.keyboard('{Escape}');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].recipients).toEqual(['owner-1', 'u2']);
    });

    it('leaves the stored list alone when the picker was never touched', async () => {
        const bodies = captureUpdates();

        renderRoutine({
            ...emailOn,
            recipients: [{ userId: 'u2', user: { _id: 'u2', name: { first: 'Grace', last: 'Hopper' } } }],
        });

        await userEvent.type(await screen.findByPlaceholderText('Weekly competitor scan'), '!');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('recipients');
    });

    it('says what an empty list means rather than implying it silences the email', async () => {
        renderRoutine(emailOn);

        const picker = await screen.findByRole('combobox', { name: 'Recipients' });

        await waitFor(() => expect(picker).toHaveTextContent('Ada Lovelace'));
        await userEvent.click(screen.getByRole('button', { name: 'Remove Ada Lovelace' }));

        expect(await screen.findByText(/only the routine's owner is emailed/)).toBeInTheDocument();
    });

    it('shows the rejection message exactly as the api wrote it', async () => {
        const refusal = 'Grace Hopper cannot see the "Research" agent, so they cannot be a recipient.';

        server.use(
            http.put(apiUrl('/routines/routine-1'), () => httpError(400, refusal)),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        renderRoutine(emailOn);
        await openPicker();
        await userEvent.click(await screen.findByText('Grace Hopper'));
        await userEvent.keyboard('{Escape}');
        await save();

        expect(await screen.findByText(refusal)).toBeInTheDocument();
    });

    // put.js re-judges the STORED list on every edit, so this refusal arrives on saves that show
    // no picker to put it beside.
    it('toasts a recipient refusal when the picker is not on screen', async () => {
        const refusal = 'Grace Hopper cannot see the "Research" agent, so they cannot be a recipient.';

        server.use(
            http.put(apiUrl('/routines/routine-1'), () => httpError(400, refusal)),
            respond('get', '/routines', () => pagedEnvelope([routine])),
        );

        renderWithProviders(
            <>
                <Toaster />
                <RoutineFormModal open onOpenChange={vi.fn()} routine={{ ...routine, emailOnRun: false }} />
            </>,
        );

        await userEvent.type(await screen.findByPlaceholderText('Weekly competitor scan'), '!');
        await save();

        // The only place the sentence can appear here: with Notification off, no picker is rendered.
        expect(await screen.findByText(refusal)).toBeInTheDocument();
    });

    // `recipients` is optional in the read schema, and absent is not empty: replacing an unknown
    // list with the owner alone would destroy it.
    it('never replaces a list the response did not carry', async () => {
        const bodies = captureUpdates();
        // No `recipients` key at all, which `routineSchema` tolerates — not an empty list.
        const withoutRecipients: RoutineType = { ...routine, emailOnRun: true };

        renderWithProviders(<RoutineFormModal open onOpenChange={vi.fn()} routine={withoutRecipients} />);

        await userEvent.type(await screen.findByPlaceholderText('Weekly competitor scan'), '!');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('recipients');
    });

    // The stored empty list already means this person, so the baseline moves with the pre-fill.
    it('sends no recipients when only the pre-filled owner is on the list', async () => {
        const bodies = captureUpdates();

        renderRoutine(emailOn);

        const picker = await screen.findByRole('combobox', { name: 'Recipients' });

        await waitFor(() => expect(picker).toHaveTextContent('Ada Lovelace'));
        await userEvent.type(screen.getByPlaceholderText('Weekly competitor scan'), '!');
        await save();

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0]).not.toHaveProperty('recipients');
    });

    // A Space member can edit someone else's routine; the owner is resolved by id, never assumed.
    it('pre-fills the owner, not whoever is editing', async () => {
        server.use(
            respond('get', '/users/me', () =>
                envelope({ _id: 'bob-2', name: { first: 'Bob', last: 'Reed' }, email: 'bob@ex.com' }),
            ),
            respond('get', '/users/owner-1', () =>
                envelope({ _id: 'owner-1', name: { first: 'Ada', last: 'Lovelace' }, email: 'ada@ex.com' }),
            ),
        );

        renderRoutine(emailOn);

        const picker = await screen.findByRole('combobox', { name: 'Recipients' });

        await waitFor(() => expect(picker).toHaveTextContent('Ada Lovelace'));
        expect(picker).not.toHaveTextContent('Bob Reed');
    });

    it('stops the user at the cap instead of letting the api refuse the list', async () => {
        const people = Array.from({ length: ROUTINE_MAX_RECIPIENTS + 2 }, (_, i) => ({
            _id: `u${i}`,
            name: { first: 'Person', last: String(i) },
            email: `p${i}@ex.com`,
        }));

        server.use(respond('get', '/users', () => pagedEnvelope(people)));

        renderRoutine({
            ...emailOn,
            recipients: people.slice(0, ROUTINE_MAX_RECIPIENTS).map((user) => ({ userId: user._id, user })),
        });

        await openPicker();

        expect(await screen.findByText(/up to 25 people/)).toBeInTheDocument();
        expect(await screen.findByRole('option', { name: /Person 25/ })).toHaveAttribute('aria-disabled', 'true');
    });
});

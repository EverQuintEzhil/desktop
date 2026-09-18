import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installScrollIntoViewShim, installWebAnimationsShims } from '@/test/dom-shims';
import { renderWithProviders } from '@/test/test-utils';
import type { AgentType, AppType, ModelType } from '@/types/admin';

import { type AppUiConfig, type ChatUiConfig, type UiConfig } from './schema';
import UiConfigForm from './ui-config-form';

installWebAnimationsShims();
installPointerCaptureShims();
installScrollIntoViewShim();

/** The config Scout actually stores in production, dead access flags and all. */
const SCOUT_CONFIG_JSON =
    '{"componentType":"app","type":"app","app":{"refName":"scout-app","assistantLabel":"Scout Assistant","assistantDefaultOpen":true},"models":[{"name":"ChatGPT Instant","modelId":"6a7ba447c914fe008dbabb96","parameters":{"effort":{"type":"select","label":"Effort","default":{"label":"medium","value":"medium"},"options":[{"label":"low","value":"low"},{"label":"medium","value":"medium"},{"label":"high","value":"high"}]}}},{"name":"Claude Instant","modelId":"6a7c10796d73cc3f1863503f","parameters":{"effort":{"type":"select","label":"Effort","default":{"label":"medium","value":"medium"},"options":[{"label":"low","value":"low"},{"label":"medium","value":"medium"},{"label":"high","value":"high"}]}}}],"defaultModel":{"name":"ChatGPT Instant","modelId":"6a7ba447c914fe008dbabb96","parameters":{"effort":{"type":"select","label":"Effort","default":{"label":"medium","value":"medium"},"options":[{"label":"low","value":"low"},{"label":"medium","value":"medium"},{"label":"high","value":"high"}]}}},"home":{"title":"Scout","titleIncognito":"Scout","search":{"placeholder":"Ask Scout — pursuits, teams, win/loss, signals…","files":true,"showWebSearch":false,"isWebSearchEnabled":false,"isIncognitoEnabled":false},"questions":["How does our pipeline look?","Who should team up for aviation in the Middle East?","Which firms share NEOM as a client?","Show recent market signals","Should we bid on the NEOM logistics hub?","Why do we lose, and who should chase what we\'re losing?"]},"allowCustomConnectors":false,"allowCustomSkills":false,"promptLibrary":{"enabled":false,"filters":{"aimodelIds":[]}}}';

const effortSchema = {
    effort: { type: 'string', title: 'Effort', enum: ['low', 'medium', 'high'], default: 'medium' },
};

const agentModel = (id: string, name: string, parameters: object): ModelType =>
    ({ _id: id, model: name, provider: 'openai', parameters }) as ModelType;

const linkedApp = (refName: string, name: string): AppType => ({ _id: refName, refName, name }) as AppType;

const scoutAgent = {
    models: [
        agentModel('6a7ba447c914fe008dbabb96', 'ChatGPT Instant', effortSchema),
        agentModel('6a7c10796d73cc3f1863503f', 'Claude Instant', effortSchema),
    ],
    apps: [linkedApp('scout-app', 'Scout App')],
} as AgentType;

/** Key order differs between the stored document and a zod parse, so compare on sorted keys. */
const canonical = (value: unknown): string =>
    JSON.stringify(value, (_key, raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;

        return Object.fromEntries(
            Object.entries(raw as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        );
    });

interface RenderOptions {
    value: UiConfig;
    agent?: AgentType;
    onSave?: (next: UiConfig) => Promise<void>;
    disabled?: boolean;
}

const renderForm = ({ value, agent, onSave, disabled }: RenderOptions) => {
    const onChange = vi.fn();

    renderWithProviders(
        <UiConfigForm
            agent={agent}
            value={value}
            onChange={onChange}
            onSave={onSave}
            disabled={disabled}
            showGalleryQuotes={false}
            onShowGalleryQuotesChange={vi.fn()}
        />,
    );

    return { onChange };
};

const ControlledForm = ({
    initial,
    agent,
    onChange,
}: {
    initial: UiConfig;
    agent?: AgentType;
    onChange: (next: UiConfig) => void;
}) => {
    const [value, setValue] = useState(initial);

    return (
        <UiConfigForm
            agent={agent}
            value={value}
            onChange={(next) => {
                onChange(next);
                setValue(next);
            }}
            showGalleryQuotes={false}
            onShowGalleryQuotesChange={vi.fn()}
        />
    );
};

const verbositySchema = {
    verbosity: { type: 'string', title: 'Verbosity', enum: ['low', 'high'], default: 'low' },
};

/** Scout, after someone added a `verbosity` parameter to the first model the config already lists. */
const agentWithExtraParameter = {
    ...scoutAgent,
    models: [
        agentModel('6a7ba447c914fe008dbabb96', 'ChatGPT Instant', { ...effortSchema, ...verbositySchema }),
        agentModel('6a7c10796d73cc3f1863503f', 'Claude Instant', effortSchema),
    ],
} as AgentType;

const appPaneHeading = () => screen.queryByRole('button', { name: /App pane/i });

const includeCheckboxFor = (parameterKey: string) => document.getElementById(`parameter-${parameterKey}-include`);

const openFirstModelParameters = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Models/i }));
    await user.click((await screen.findAllByText('ChatGPT Instant'))[0]);
};

const switchComponentTypeTo = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(await screen.findByText(label));
    await user.click(await screen.findByRole('button', { name: 'Switch type' }));
};

describe('UiConfigForm — App pane section', () => {
    it('renders the App pane section for an app config', () => {
        renderForm({ value: JSON.parse(SCOUT_CONFIG_JSON) as UiConfig, agent: scoutAgent });

        expect(appPaneHeading()).toBeInTheDocument();
    });

    it('does not render the App pane section for chat, api or gallery configs', () => {
        const configs: UiConfig[] = [
            { componentType: 'chat', type: 'chat', home: {} },
            { componentType: 'api', type: 'jsonviewer', formSpec: [] },
            { componentType: 'gallery', type: 'image' },
        ];

        configs.forEach((value) => {
            const { unmount } = renderWithProviders(
                <UiConfigForm
                    value={value}
                    onChange={vi.fn()}
                    showGalleryQuotes={false}
                    onShowGalleryQuotesChange={vi.fn()}
                />,
            );

            expect(appPaneHeading()).not.toBeInTheDocument();
            unmount();
        });
    });

    it('offers the agent linked apps as the app-pane options', async () => {
        const user = userEvent.setup();
        const unpicked = JSON.parse(SCOUT_CONFIG_JSON) as UiConfig & { app: { refName: string } };

        unpicked.app.refName = '';
        renderForm({ value: unpicked, agent: scoutAgent });

        await user.click(appPaneHeading() as HTMLElement);
        await user.click((await screen.findAllByRole('combobox'))[2]);

        expect(await screen.findByText('Scout App')).toBeInTheDocument();
    });
});

describe('UiConfigForm — round trip', () => {
    it('saves the stored Scout config unchanged, access flags included', async () => {
        const user = userEvent.setup();
        const stored = JSON.parse(SCOUT_CONFIG_JSON) as Record<string, unknown>;
        const onSave = vi.fn((_next: UiConfig) => Promise.resolve());

        const { onChange } = renderForm({ value: stored as UiConfig, agent: scoutAgent, onSave });

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledTimes(1);
        });

        expect(canonical(onSave.mock.calls[0][0])).toBe(canonical(stored));
        expect(onChange).not.toHaveBeenCalled();
    });

    // api resolve_agent_ui_flags.js and ai load_agent_ui_flags.js read these out of the uiConfig blob
    // whenever agent.settings is empty, so a save must not strip them.
    it('keeps the legacy access flags a save round-trips through the schema', async () => {
        const user = userEvent.setup();
        const stored = JSON.parse(SCOUT_CONFIG_JSON) as Record<string, unknown>;

        stored.allowSharedSkills = true;
        stored.allowSharedConnectors = true;

        const onSave = vi.fn((_next: UiConfig) => Promise.resolve());

        renderForm({ value: stored as UiConfig, agent: scoutAgent, onSave });

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledTimes(1);
        });

        expect(onSave.mock.calls[0][0]).toMatchObject({
            allowCustomConnectors: false,
            allowCustomSkills: false,
            allowSharedSkills: true,
            allowSharedConnectors: true,
        });
    });

    it('drops a legacy home.models list, which nothing reads any more', async () => {
        const user = userEvent.setup();
        const stored = JSON.parse(SCOUT_CONFIG_JSON) as Record<string, unknown>;
        const home = stored.home as Record<string, unknown>;

        home.models = [{ name: 'Legacy Instant', modelId: '6a7ba447c914fe008dbabb96' }];
        const onSave = vi.fn((_next: UiConfig) => Promise.resolve());

        renderForm({ value: stored as UiConfig, agent: scoutAgent, onSave });

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledTimes(1);
        });

        expect((onSave.mock.calls[0][0] as ChatUiConfig).home).not.toHaveProperty('models');
    });

    it('does not emit a change on mount when the agent models carry a parameter the config lacks', () => {
        const { onChange } = renderForm({
            value: JSON.parse(SCOUT_CONFIG_JSON) as UiConfig,
            agent: agentWithExtraParameter,
        });

        expect(onChange).not.toHaveBeenCalled();
    });

    it('still sends the missing model parameter once the admin makes a real edit', async () => {
        const user = userEvent.setup();
        const { onChange } = renderForm({
            value: JSON.parse(SCOUT_CONFIG_JSON) as UiConfig,
            agent: agentWithExtraParameter,
        });

        await user.click(appPaneHeading() as HTMLElement);
        await user.type(await screen.findByPlaceholderText('Assistant'), '!');

        const next = onChange.mock.calls[0][0] as UiConfig & { models: { parameters?: object }[] };

        expect(next.models[0].parameters).toHaveProperty('verbosity');
    });
});

describe('UiConfigForm — agent-model parameter merge', () => {
    it('leaves a removed model parameter removed instead of merging it straight back in', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <ControlledForm
                initial={JSON.parse(SCOUT_CONFIG_JSON) as UiConfig}
                agent={agentWithExtraParameter}
                onChange={onChange}
            />,
        );

        await openFirstModelParameters(user);
        expect(includeCheckboxFor('verbosity')).not.toBeNull();

        await user.click(includeCheckboxFor('verbosity') as HTMLElement);

        await waitFor(() => {
            expect(includeCheckboxFor('verbosity')).toBeNull();
        });

        const next = onChange.mock.calls.at(-1)?.[0] as ChatUiConfig;

        expect(next.models?.[0].parameters).not.toHaveProperty('verbosity');
        expect(next.models?.[0].parameters).toHaveProperty('effort');
    });

    it('does not merge agent-model parameters into a read-only form', async () => {
        const user = userEvent.setup();

        renderForm({
            value: JSON.parse(SCOUT_CONFIG_JSON) as UiConfig,
            agent: agentWithExtraParameter,
            disabled: true,
        });

        await openFirstModelParameters(user);

        expect(includeCheckboxFor('effort')).not.toBeNull();
        expect(includeCheckboxFor('verbosity')).toBeNull();
    });
});

describe('UiConfigForm — component type switch', () => {
    it('keeps models, starter questions and parameters through chat → app → chat', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const initial: ChatUiConfig = {
            componentType: 'chat',
            type: 'chat',
            models: [{ name: 'ChatGPT Instant', modelId: '6a7ba447c914fe008dbabb96' }],
            defaultModel: { name: 'ChatGPT Instant', modelId: '6a7ba447c914fe008dbabb96' },
            home: { title: 'Scout', questions: ['How does our pipeline look?'] },
            parameters: {
                effort: {
                    type: 'select',
                    label: 'Effort',
                    default: { label: 'low', value: 'low' },
                    options: [{ label: 'low', value: 'low' }],
                },
            },
        };

        renderWithProviders(<ControlledForm initial={initial} agent={scoutAgent} onChange={onChange} />);

        await switchComponentTypeTo(user, 'App');

        const asApp = onChange.mock.calls[0][0] as AppUiConfig;

        expect(asApp.componentType).toBe('app');
        expect(asApp.models?.map((model) => model.modelId)).toEqual(['6a7ba447c914fe008dbabb96']);

        await switchComponentTypeTo(user, 'Chat');

        const backToChat = onChange.mock.calls[1][0] as ChatUiConfig;

        expect(backToChat.componentType).toBe('chat');
        expect(backToChat.models?.map((model) => model.name)).toEqual(['ChatGPT Instant']);
        expect(backToChat.defaultModel?.modelId).toBe('6a7ba447c914fe008dbabb96');
        expect(backToChat.home.questions).toEqual(['How does our pipeline look?']);
        expect(canonical(backToChat.parameters)).toBe(canonical(initial.parameters));
    });

    it('refuses to switch while the in-flight value is schema-invalid, instead of resetting it', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <ControlledForm
                initial={JSON.parse(SCOUT_CONFIG_JSON) as UiConfig}
                agent={scoutAgent}
                onChange={onChange}
            />,
        );

        await openFirstModelParameters(user);
        await user.clear(screen.getByPlaceholderText('ChatGPT Instant'));
        onChange.mockClear();

        await user.click(screen.getAllByRole('combobox')[0]);
        await user.click(await screen.findByText('Chat'));

        expect(screen.queryByRole('button', { name: 'Switch type' })).not.toBeInTheDocument();
        expect(screen.getByText(/before switching component type/i)).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
        expect(appPaneHeading()).toBeInTheDocument();
    });

    it('drops the app pane when switching away from an app config', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(
            <ControlledForm
                initial={JSON.parse(SCOUT_CONFIG_JSON) as UiConfig}
                agent={scoutAgent}
                onChange={onChange}
            />,
        );

        await switchComponentTypeTo(user, 'Chat');

        const backToChat = onChange.mock.calls[0][0] as ChatUiConfig;

        expect(backToChat).not.toHaveProperty('app');
        expect(backToChat.home.title).toBe('Scout');
    });
});

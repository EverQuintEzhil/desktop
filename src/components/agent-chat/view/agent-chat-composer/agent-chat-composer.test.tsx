import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ReactNode, type RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import type { AgentComposerContextValue, HomeSubmitPayload } from '@/components/agent-chat/types';
import { ChatHostProvider } from '@/components/chat-host';
import type { ChatHost } from '@/components/chat-host';
import type { TextAreaRef } from '@/components/text-area';
import { installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { getJson, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { AgentSettingsType, ChatAgentType } from '@/types/admin';
import type { FileType } from '@/types/chat';

import AgentChatComposer from './agent-chat-composer';

installRichTextDomShims();
installScrollIntoViewShim();

const chatHost = {
    session: { user: { id: 'user-1' }, tenant: { id: 'tenant-1' } },
    transport: {
        endpoint: '/chat',
        baseUrl: 'https://api.localhost',
        filesBaseUrl: 'https://files.localhost',
        fetch: globalThis.fetch,
    },
    navigation: { setConversationId: () => {}, startNewConversation: () => {} },
} as unknown as ChatHost;

const makeAgent = (options: AgentOptions = {}) =>
    ({
        _id: 'agent-1',
        slug: 'test-agent',
        name: 'Test Agent',
        tools: options.tools ?? [],
        memories: [],
        skills: [],
        mcpServers: [],
        settings: options.settings,
        uiConfig: {
            home: {
                search: { files: true, ...(options.defaultPrompt ? { defaultPrompt: options.defaultPrompt } : {}) },
            },
            allowCustomSkills: false,
            allowSharedSkills: false,
            allowCustomConnectors: false,
            allowSharedConnectors: false,
            ...options.uiConfigFlags,
        },
    }) as unknown as ChatAgentType;

const uploadedFile: FileType = {
    _id: 'file-1',
    name: 'notes.txt',
    url: 'https://files.localhost/notes.txt',
    type: 'file',
};

const failedFile: FileType = {
    tempId: 'temp-1',
    name: 'pasted-text.txt',
    url: '',
    type: 'file',
    isUploading: false,
    uploadError: true,
};

interface AgentOptions {
    defaultPrompt?: string;
    settings?: AgentSettingsType | null;
    uiConfigFlags?: AgentSettingsType;
    tools?: ChatAgentType['tools'];
}

interface HarnessOptions extends AgentOptions {
    showDeepSearch?: boolean;
    isDeepSearchEnabled?: boolean;
    setIsDeepSearchEnabled?: (enabled: boolean) => void;
    files?: FileType[];
    isUploading?: boolean;
    isEditingQueued?: boolean;
    addFiles?: (files: File[]) => void;
    value?: string;
    textAreaRef?: RefObject<TextAreaRef | null>;
}

const makeComposerContext = (options: HarnessOptions): AgentComposerContextValue => ({
    composer: {
        model: null,
        setModel: () => {},
        availableModels: [],
        parameters: {},
        setParameter: () => {},
        setParameters: () => {},
        removeParameter: () => {},
        isWebSearchEnabled: false,
        setIsWebSearchEnabled: () => {},
        isDeepSearchEnabled: options.isDeepSearchEnabled ?? false,
        setIsDeepSearchEnabled: options.setIsDeepSearchEnabled ?? (() => {}),
        showDeepSearch: options.showDeepSearch ?? false,
        isIncognitoMode: false,
        toggleIncognitoMode: () => {},
        isPublic: false,
        setIsPublic: () => {},
        plusDropdownOptions: [],
        handlePlusDropdownSelect: () => {},
        showPlusDropdown: false,
        setShowPlusDropdown: () => {},
        renderSelectedParameters: () => null,
        connectors: {
            connections: [],
            isLoading: false,
            enabledIds: [],
            disabledMap: {},
            toggleMcpServer: () => {},
            setConnectorEnabled: () => Promise.resolve(true),
            toggleDisconnectedConnector: () => Promise.resolve(),
            enablingId: null,
            mcpServers: [],
            nonOauthConnectors: [],
            disconnectedConnectors: [],
            connectorDescriptions: {},
            connectorServerUrls: {},
            reconnect: () => Promise.resolve(true),
            connectingId: null,
            cancelConnection: () => {},
            cancellingId: null,
        },
        customConnectorIds: [],
        sharedConnectorIds: [],
        skills: {
            skills: [],
            customIds: [],
            sharedIds: [],
            enabledIds: [],
            toggleSkill: () => {},
            skillArguments: [],
            disabledAgentSkills: [],
            enableSkill: () => Promise.resolve(true),
        },
        composerActionsRef: createRef(),
    },
    filesState: {
        files: options.files ?? [],
        isUploading: options.isUploading ?? false,
        fileInputRef: createRef<HTMLInputElement>(),
        setFiles: () => {},
        updateFileById: () => {},
        addFiles: options.addFiles ?? (() => {}),
        onChangeFile: () => {},
        clearFiles: () => {},
        retryUpload: () => {},
    },
});

const Harness = ({ children }: { children: ReactNode }) => {
    const runtime = useLocalRuntime({ run: async () => ({ content: [] }) });

    return (
        <ChatHostProvider value={chatHost}>
            <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
        </ChatHostProvider>
    );
};

const renderComposer = (options: HarnessOptions = {}) => {
    server.use(getJson('/users/me', { _id: 'user-1', preferences: {} }));

    const onSubmit = vi.fn<(payload: HomeSubmitPayload) => void>();

    renderWithProviders(
        <Harness>
            <AgentComposerContext.Provider value={makeComposerContext(options)}>
                <AgentChatComposer
                    agent={makeAgent(options)}
                    onSubmit={onSubmit}
                    isEditingQueued={options.isEditingQueued}
                    value={options.value}
                    textAreaRef={options.textAreaRef}
                />
            </AgentComposerContext.Provider>
        </Harness>,
    );

    return { onSubmit };
};

const dispatchPaste = (element: Element, text: string, html = '') => {
    // jsdom's ClipboardEvent constructor ignores `clipboardData`, so the handler's only
    // input has to be attached to a plain Event by hand.
    const event = new Event('paste', { bubbles: true, cancelable: true });
    const getData = (type: string) => (type === 'text/html' ? html : text);

    Object.defineProperty(event, 'clipboardData', { value: { getData } });

    act(() => {
        element.dispatchEvent(event);
    });
};

const getSendButton = async (): Promise<HTMLElement> => {
    return screen.findByRole('button', { name: 'Send message' });
};

const getComposerInput = (): HTMLElement => {
    return document.querySelector<HTMLElement>('.chat-editor__content')!;
};

const user = userEvent.setup({ delay: null });

const getDeepResearchButton = (): HTMLElement | null => screen.queryByRole('button', { name: /Deep Research/ });

describe('AgentChatComposer send enablement', () => {
    it('enables Send for an attachment with no text on an agent without a defaultPrompt', async () => {
        renderComposer({ files: [uploadedFile] });

        expect(await getSendButton()).toBeEnabled();
    });

    it('submits the attachment ids with an empty message', async () => {
        const { onSubmit } = renderComposer({ files: [uploadedFile] });

        await user.click(await getSendButton());

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

        const payload = onSubmit.mock.calls[0][0];

        expect(payload.message).toBe('');
        expect(payload.fileIds).toEqual(['file-1']);
        expect(payload.attachments).toHaveLength(1);
        expect(payload.attachments?.[0].name).toBe('notes.txt');
    });

    it('still substitutes the configured defaultPrompt for the empty message', async () => {
        const { onSubmit } = renderComposer({ files: [uploadedFile], defaultPrompt: 'Summarise this file' });

        await user.click(await getSendButton());

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].message).toBe('Summarise this file');
    });

    it('keeps Send disabled with neither text nor attachments', async () => {
        renderComposer();

        expect(await getSendButton()).toBeDisabled();
    });

    it('keeps Send disabled while an attachment is still uploading', async () => {
        renderComposer({ files: [uploadedFile], isUploading: true });

        expect(await getSendButton()).toBeDisabled();
    });

    it('keeps Send disabled when the only attachment failed to upload and there is no text', async () => {
        renderComposer({ files: [failedFile] });

        expect(await getSendButton()).toBeDisabled();
    });

    it('enables Send when one of two attachments failed to upload', async () => {
        renderComposer({ files: [failedFile, uploadedFile] });

        expect(await getSendButton()).toBeEnabled();
    });

    it('keeps Send enabled for typed text alongside a failed attachment', async () => {
        renderComposer({ files: [failedFile] });

        const sendButton = await getSendButton();

        await user.type(getComposerInput(), 'send this anyway');

        await waitFor(() => expect(sendButton).toBeEnabled());
    });

    it('submits the typed message when Enter is pressed', async () => {
        const { onSubmit } = renderComposer();

        const input = getComposerInput();

        await getSendButton();
        await user.type(input, 'hello world');
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].message).toBe('hello world');
    });
});

describe('AgentChatComposer unfilled variables', () => {
    it('blocks Send when a programmatically supplied prompt carries an unfilled variable', async () => {
        renderComposer({ defaultPrompt: 'ignored', value: 'Email {{name}} today' });

        await waitFor(async () => expect(await getSendButton()).toBeDisabled());
    });

    it('enables Send once the prompt has no variables left', async () => {
        renderComposer({ value: 'Email the team today' });

        await waitFor(async () => expect(await getSendButton()).toBeEnabled());
    });

    it('blocks Send when changeText fills the composer with an unfilled variable', async () => {
        const textAreaRef = createRef<TextAreaRef | null>();

        renderComposer({ textAreaRef });
        await user.type(getComposerInput(), 'typed by hand');
        await waitFor(async () => expect(await getSendButton()).toBeEnabled());

        act(() => textAreaRef.current?.changeText('Email {{name}} today'));

        await waitFor(async () => expect(await getSendButton()).toBeDisabled());
    });

    it('re-enables Send when changeText replaces a variable prompt with a plain one', async () => {
        const textAreaRef = createRef<TextAreaRef | null>();

        renderComposer({ textAreaRef });
        await user.type(getComposerInput(), 'typed by hand');

        act(() => textAreaRef.current?.changeText('Email {{name}} today'));
        await waitFor(async () => expect(await getSendButton()).toBeDisabled());

        act(() => textAreaRef.current?.changeText('Email the team today'));

        await waitFor(async () => expect(await getSendButton()).toBeEnabled());
    });
});

describe('AgentChatComposer paste-to-file', () => {
    const LONG_PASTE = 'a'.repeat(2000);

    it('attaches a long paste as a file when no queued message is being edited', async () => {
        const addFiles = vi.fn<(files: File[]) => void>();

        renderComposer({ addFiles });
        await getSendButton();

        dispatchPaste(getComposerInput(), LONG_PASTE);

        expect(addFiles).toHaveBeenCalledTimes(1);
        expect(addFiles.mock.calls[0][0][0].name).toBe('pasted-text.txt');
    });

    it("keeps a pasted table's separators instead of parsing the foreign HTML", async () => {
        const { onSubmit } = renderComposer();

        await getSendButton();
        const input = getComposerInput();

        await user.click(input);
        dispatchPaste(
            input,
            'A1\tB1\nA2\tB2',
            '<table><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></table>',
        );

        await waitFor(async () => expect(await getSendButton()).toBeEnabled());
        await user.click(await getSendButton());

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].message).toBe('A1\tB1\nA2\tB2');
    });

    it('leaves a long paste inline while a queued message is being edited', async () => {
        const addFiles = vi.fn<(files: File[]) => void>();

        renderComposer({ addFiles, isEditingQueued: true });
        await getSendButton();

        dispatchPaste(getComposerInput(), LONG_PASTE);

        expect(addFiles).not.toHaveBeenCalled();
    });
});

describe('AgentChatComposer capabilities', () => {
    it('passes the agent to the recommended banner, which surfaces its no-access items', async () => {
        renderComposer({ tools: [{ _id: 'tool-1', name: 'Cost lookup', noAccess: true }] as ChatAgentType['tools'] });
        await getSendButton();

        const row = within(screen.getByRole('group', { name: /capabilities you have no access to/i }));

        expect(row.getByText('Cost lookup')).toBeInTheDocument();
    });

    it('renders no banner when nothing on the agent is flagged', async () => {
        renderComposer();
        await getSendButton();

        expect(screen.queryByRole('group', { name: /capabilities you have no access to/i })).not.toBeInTheDocument();
    });
});

describe('AgentChatComposer access flags', () => {
    const getPlusButton = () => screen.queryByRole('button', { name: 'Add to message' });

    it('shows the plus menu when agent.settings allows custom skills and uiConfig does not', async () => {
        renderComposer({ settings: { allowCustomSkills: true } });
        await getSendButton();

        expect(getPlusButton()).not.toBeNull();
    });

    it('hides the plus menu when agent.settings denies what uiConfig allows', async () => {
        renderComposer({
            settings: {
                allowCustomSkills: false,
                allowSharedSkills: false,
                allowCustomConnectors: false,
                allowSharedConnectors: false,
            },
            uiConfigFlags: {
                allowCustomSkills: true,
                allowSharedSkills: true,
                allowCustomConnectors: true,
                allowSharedConnectors: true,
            },
        });
        await getSendButton();

        expect(getPlusButton()).toBeNull();
    });

    it('ignores uiConfig when agent.settings is absent', async () => {
        renderComposer({ uiConfigFlags: { allowSharedConnectors: true } });
        await getSendButton();

        expect(getPlusButton()).toBeNull();
    });
});

describe('AgentChatComposer deep research chip', () => {
    it('stays hidden when the agent does not show deep search', async () => {
        renderComposer();

        await waitFor(() => expect(getComposerInput()).toBeTruthy());

        expect(getDeepResearchButton()).toBeNull();
    });

    // The chip is Web Search's shape: absent until the mode is on, so the toolbar only ever
    // carries modes that are actually active. Turning it on is the plus dropdown's job.
    it('stays hidden while the mode is off, even when the agent allows it', async () => {
        renderComposer({ showDeepSearch: true });

        await waitFor(() => expect(getComposerInput()).toBeTruthy());

        expect(getDeepResearchButton()).toBeNull();
    });

    it('appears once the mode is on', async () => {
        renderComposer({ showDeepSearch: true, isDeepSearchEnabled: true });

        expect(await screen.findByRole('button', { name: 'Turn off Deep Research' })).toBeInTheDocument();
    });

    it('clears the mode when clicked', async () => {
        const setIsDeepSearchEnabled = vi.fn<(enabled: boolean) => void>();

        renderComposer({ showDeepSearch: true, isDeepSearchEnabled: true, setIsDeepSearchEnabled });

        await user.click(await screen.findByRole('button', { name: 'Turn off Deep Research' }));

        expect(setIsDeepSearchEnabled).toHaveBeenCalledWith(false);
    });

    it('activates with the keyboard', async () => {
        const setIsDeepSearchEnabled = vi.fn<(enabled: boolean) => void>();

        renderComposer({ showDeepSearch: true, isDeepSearchEnabled: true, setIsDeepSearchEnabled });

        const button = await screen.findByRole('button', { name: 'Turn off Deep Research' });

        button.focus();
        await user.keyboard('{Enter}');
        await user.keyboard(' ');

        expect(setIsDeepSearchEnabled.mock.calls).toEqual([[false], [false]]);
    });
});

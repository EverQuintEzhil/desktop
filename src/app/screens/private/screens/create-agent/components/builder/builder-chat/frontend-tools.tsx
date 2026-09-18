import { Tools, useAui, type Toolkit } from '@assistant-ui/react';
import { useMemo, useRef } from 'react';
import { z } from 'zod';

import { ToolFallback } from '@/components/assistant-ui/tool-fallback';
import {
    AskUserTool,
    askUserParameters,
    ConfirmActionTool,
    confirmActionParameters,
    PlanTool,
    RequestInputTool,
    requestInputParameters,
} from '@/components/chat/tools';

import {
    CollectDataStoreCredentialsTool,
    collectDataStoreCredentialsDescription,
    collectDataStoreCredentialsParameters,
} from '../builder-requests';

export interface BuilderToolHandlers {
    onOpenPreview: () => void;
    onClosePreview: () => void;
    onRefreshAgent: () => void;
    onOpenSettings: () => void;
}

const noParameters = z.object({});

export { HUMAN_TOOL_NAMES } from '../../../lib/human-tool-names';

const createBuilderToolkit = (handlers: BuilderToolHandlers): Toolkit => ({
    open_preview: {
        type: 'frontend',
        description: 'Open the agent preview panel so the user can test the agent in a live chat.',
        parameters: noParameters,
        execute: async () => {
            handlers.onOpenPreview();

            return { success: true };
        },
        render: ToolFallback,
    },
    close_preview: {
        type: 'frontend',
        description: 'Close the agent preview panel and return to the configuration view.',
        parameters: noParameters,
        execute: async () => {
            handlers.onClosePreview();

            return { success: true };
        },
        render: ToolFallback,
    },
    refresh_agent: {
        type: 'frontend',
        description: 'Reload the latest saved agent configuration from the server.',
        parameters: noParameters,
        execute: async () => {
            handlers.onRefreshAgent();

            return { success: true };
        },
        render: ToolFallback,
    },
    open_settings: {
        type: 'frontend',
        description: 'Open the agent settings dialog.',
        parameters: noParameters,
        execute: async () => {
            handlers.onOpenSettings();

            return { success: true };
        },
        render: ToolFallback,
    },
    update_plan: {
        type: 'backend',
        display: 'standalone',
        render: PlanTool,
    },
    ask_user: {
        type: 'human',
        description:
            'Ask the user a multiple-choice question with selectable options instead of asking in free-form prose. ' +
            'Use this whenever the next step depends on a decision that has a small set of discrete choices (2–5). ' +
            "Set `multiple: true` for 'select all that apply' questions, otherwise it is single-select. " +
            'The user picks in the UI and their selection is returned to you.',
        parameters: askUserParameters,
        render: AskUserTool,
    },
    request_input: {
        type: 'human',
        description:
            'Collect short typed values from the user in a small form: names, descriptions, base URLs, ' +
            'record counts and the like. Prefer this over asking in prose when you need exact values. ' +
            'NEVER use this for passwords, tokens, API keys, connection strings or any other secret — ' +
            'those go through collect_data_store_credentials, which keeps them out of the chat. ' +
            'Do NOT use it to set up a data store either (provider, engine, connection details): pick the provider ' +
            'with ask_user if it is unknown, create the store, then call collect_data_store_credentials — it renders ' +
            'the real form for that provider, so hand-building one here would only duplicate it worse.',
        parameters: requestInputParameters,
        render: RequestInputTool,
    },
    confirm_action: {
        type: 'human',
        description:
            'Ask the user to confirm before you do something consequential — publishing, deleting a data store, ' +
            'or replacing instructions they wrote. Use this instead of asking in prose and reading their reply, ' +
            'so the decision is unambiguous.',
        parameters: confirmActionParameters,
        render: ConfirmActionTool,
    },
    collect_data_store_credentials: {
        type: 'human',
        description: collectDataStoreCredentialsDescription,
        parameters: collectDataStoreCredentialsParameters,
        render: CollectDataStoreCredentialsTool,
    },
});

export const useBuilderTools = (handlers: BuilderToolHandlers) => {
    const handlersRef = useRef(handlers);

    handlersRef.current = handlers;

    const toolkit = useMemo(
        () =>
            createBuilderToolkit({
                onOpenPreview: () => handlersRef.current.onOpenPreview(),
                onClosePreview: () => handlersRef.current.onClosePreview(),
                onRefreshAgent: () => handlersRef.current.onRefreshAgent(),
                onOpenSettings: () => handlersRef.current.onOpenSettings(),
            }),
        [],
    );

    return useAui({ tools: Tools({ toolkit }) });
};

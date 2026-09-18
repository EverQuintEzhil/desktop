import type { Toolkit } from '@assistant-ui/react';
import { createContext, useContext } from 'react';

export interface ChatShellValue {
    isPreview: boolean;
    onExit?: () => void;
    /**
     * 'panel' embeds the chat as an assistant side panel (componentType "app"):
     * the conversations sidebar and mobile menu chrome are suppressed so the
     * chat fills a narrow column. Default ('full') is the standalone screen.
     */
    variant?: 'full' | 'panel';
    /**
     * Fires after each cleanly finished assistant turn. The app split view uses
     * it to refresh the traditional-app pane after the agent changes data.
     * Receives the finished assistant UIMessage (when available) so the host
     * can act on tool outputs — e.g. `app_navigate` directives that route the
     * app pane.
     */
    onTurnFinish?: (message?: unknown) => void;
    /**
     * Lets the host push a user message into this chat (e.g. "Ask assistant"
     * actions in the app pane). The chat registers its send function on mount;
     * the returned cleanup unregisters it.
     */
    registerExternalSend?: (send: (text: string) => void) => () => void;
    /**
     * Reports the open conversation (null on home) so a memory-routed host can
     * persist it and reopen the same conversation after a reload.
     */
    onConversationChange?: (conversationId: string | null) => void;
    /**
     * Escape the chat did not consume, for a host whose own chrome closes on it (the app agent's
     * assistant drawer). Returning true means the host handled it. It cannot be read from a DOM
     * event: prosemirror-view cancels Escape whether or not the chat consumed it, so
     * `defaultPrevented` is already set by the time the key leaves the chat box.
     */
    onEscape?: () => boolean;
    /**
     * Browser-executed tools the host exposes to the model for this chat. Their
     * schemas ride the request as `clientTools`; the run pauses on a call, the
     * browser executes it and the result resumes the turn.
     */
    clientToolkit?: Toolkit;
}

export const ChatShellContext = createContext<ChatShellValue>({ isPreview: false });

export const useChatShell = (): ChatShellValue => useContext(ChatShellContext);

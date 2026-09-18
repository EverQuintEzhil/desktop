import { createContext, useContext } from 'react';

/**
 * Routes GenUI widget `sendMessage` calls through the chat view's message
 * queue so a widget click during a streaming run queues behind it instead of
 * starting a second concurrent run (two SSE streams interleaving corrupts the
 * transcript view). Null on surfaces without the queue (admin preview) — the
 * bridge falls back to a direct thread append there.
 */
export type WidgetSendHandler = (text: string) => void;

export const WidgetSendContext = createContext<WidgetSendHandler | null>(null);

export const useWidgetSend = (): WidgetSendHandler | null => useContext(WidgetSendContext);

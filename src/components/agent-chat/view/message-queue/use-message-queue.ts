import { useCallback, useState } from 'react';

import type { HomeSubmitPayload } from '../../types';

export interface QueuedMessage {
    id: string;
    text: string;
    sendText: string;
    attachments: HomeSubmitPayload['attachments'];
    fileIds: string[];
}

export interface MessageQueue {
    queue: QueuedMessage[];
    enqueue: (item: Omit<QueuedMessage, 'id'>) => void;
    cancelQueued: (id: string) => void;
    promoteQueued: (id: string) => void;
    updateQueued: (id: string, patch: Partial<Omit<QueuedMessage, 'id'>>) => void;
    clearQueue: () => void;
}

export const useMessageQueue = (): MessageQueue => {
    const [queue, setQueue] = useState<QueuedMessage[]>([]);

    const enqueue = useCallback((item: Omit<QueuedMessage, 'id'>) => {
        setQueue((prev) => [...prev, { ...item, id: crypto.randomUUID() }]);
    }, []);

    const cancelQueued = useCallback((id: string) => {
        setQueue((prev) => prev.filter((message) => message.id !== id));
    }, []);

    const promoteQueued = useCallback((id: string) => {
        setQueue((prev) => {
            const item = prev.find((message) => message.id === id);

            if (!item) return prev;

            return [item, ...prev.filter((message) => message.id !== id)];
        });
    }, []);

    const updateQueued = useCallback((id: string, patch: Partial<Omit<QueuedMessage, 'id'>>) => {
        setQueue((prev) => prev.map((message) => (message.id === id ? { ...message, ...patch } : message)));
    }, []);

    const clearQueue = useCallback(() => {
        setQueue([]);
    }, []);

    return {
        queue,
        enqueue,
        cancelQueued,
        promoteQueued,
        updateQueued,
        clearQueue,
    };
};

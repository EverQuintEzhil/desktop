import { useAui } from '@assistant-ui/react';
import type { ThreadAssistantMessagePart } from '@assistant-ui/react';
import { useEffect, useRef } from 'react';

import { useNotificationPreference } from '@/hooks/use-notification-preference';
import { deliverNotification } from '@/utils/deliver-notification';

const NOTIFICATION_TAG = 'fluentmind-chat-completion';
const SNIPPET_MAX_LENGTH = 80;
const FALLBACK_BODY = 'Your chat response is ready.';

const isTabAway = (): boolean => {
    if (typeof document === 'undefined') {
        return false;
    }

    return document.visibilityState !== 'visible' || document.hasFocus() === false;
};

const getAssistantText = (parts: readonly ThreadAssistantMessagePart[]): string => {
    return parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(' ')
        .trim();
};

const extractAssistantText = (parts: readonly ThreadAssistantMessagePart[]): string => {
    const text = getAssistantText(parts);

    if (!text) {
        return FALLBACK_BODY;
    }

    if (text.length <= SNIPPET_MAX_LENGTH) {
        return text;
    }

    return `${text.slice(0, SNIPPET_MAX_LENGTH).trimEnd()}...`;
};

export const useCompletionNotification = (agentName: string): void => {
    const aui = useAui();
    const { enabled, isLoaded } = useNotificationPreference();
    const enabledRef = useRef(enabled);
    const isLoadedRef = useRef(isLoaded);

    useEffect(() => {
        enabledRef.current = enabled;
        isLoadedRef.current = isLoaded;
    }, [enabled, isLoaded]);

    useEffect(() => {
        let baselineAssistantId: string | null = null;
        let baselineAssistantCount = 0;
        let baselineAssistantText = '';
        let baselineAssistantPartCount = 0;

        const getLastAssistant = () => {
            const messages = aui.thread.getState().messages;

            return [...messages].reverse().find((message) => message.role === 'assistant');
        };

        const countAssistants = (): number =>
            aui.thread.getState().messages.filter((message) => message.role === 'assistant').length;

        const snapshotBaseline = (): void => {
            const lastAssistant = getLastAssistant();

            baselineAssistantId = lastAssistant?.id ?? null;
            baselineAssistantCount = countAssistants();
            baselineAssistantText = lastAssistant
                ? getAssistantText(lastAssistant.content as readonly ThreadAssistantMessagePart[])
                : '';
            baselineAssistantPartCount = lastAssistant?.content.length ?? 0;
        };

        const handleRunStart = (): void => {
            snapshotBaseline();
        };

        const handleRunEnd = (): void => {
            const shouldNotify = isLoadedRef.current && enabledRef.current && isTabAway();

            if (!shouldNotify) {
                return;
            }

            const lastAssistant = getLastAssistant();

            if (!lastAssistant) {
                return;
            }

            const assistantText = getAssistantText(lastAssistant.content as readonly ThreadAssistantMessagePart[]);
            const isNewAssistant =
                lastAssistant.id !== baselineAssistantId ||
                countAssistants() > baselineAssistantCount ||
                assistantText !== baselineAssistantText ||
                lastAssistant.content.length > baselineAssistantPartCount;

            if (!isNewAssistant) {
                return;
            }

            const body = extractAssistantText(lastAssistant.content as readonly ThreadAssistantMessagePart[]);
            const title = agentName || 'Response ready';

            void deliverNotification(title, { body, tag: NOTIFICATION_TAG, data: { url: window.location.href } });
        };

        if (aui.thread.getState().isRunning) {
            snapshotBaseline();
        }

        const unsubStart = aui.on('thread.runStart', handleRunStart);
        const unsubEnd = aui.on('thread.runEnd', handleRunEnd);

        return () => {
            unsubStart();
            unsubEnd();
        };
    }, [aui, agentName]);
};

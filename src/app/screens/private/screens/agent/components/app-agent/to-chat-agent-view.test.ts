import { describe, expect, it } from 'vitest';

import type { AppAgentType } from '@/types/admin';

import { toChatAgentView } from './to-chat-agent-view';

const appAgent = (routines?: { enabled?: boolean }) =>
    ({
        _id: 'app-agent-1',
        name: 'Scout',
        uiConfig: { componentType: 'app', type: 'app', app: { assistantDefaultOpen: true }, routines },
    }) as unknown as AppAgentType;

describe('toChatAgentView', () => {
    it('presents the app agent as a chat agent', () => {
        const view = toChatAgentView(appAgent());

        expect(view.uiConfig.componentType).toBe('chat');
        expect(view.uiConfig.type).toBe('chat');
        expect(view._id).toBe('app-agent-1');
    });

    it('leaves routines off, so the chat rewrite cannot carry an app agent past the routines gate', () => {
        expect(toChatAgentView(appAgent({ enabled: true })).uiConfig.routines?.enabled).toBe(false);
        expect(toChatAgentView(appAgent()).uiConfig.routines?.enabled).toBe(false);
    });
});

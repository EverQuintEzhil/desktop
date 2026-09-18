import type { AppAgentType, ChatAgentType } from '@/types/admin';

/**
 * The chat screens type-guard on `componentType: "chat"`; an app agent's uiConfig carries the same
 * chat fields, so its assistant panel is given a chat view of the same agent.
 *
 * Routines are switched off in that view rather than inherited: this is an app agent wearing a chat
 * view, and the componentType rewrite would otherwise pass the chat-only routines gate on its behalf.
 */
export const toChatAgentView = (agent: AppAgentType): ChatAgentType =>
    ({
        ...agent,
        uiConfig: {
            ...agent.uiConfig,
            componentType: 'chat',
            type: 'chat',
            routines: { ...agent.uiConfig?.routines, enabled: false },
        },
    }) as unknown as ChatAgentType;

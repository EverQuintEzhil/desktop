import type { FluentMindDataParts, MessageAiInfo } from '@/components/agent-chat/types';

type LooseMessagePart = { type: string; name?: string; data?: unknown };

export const extractMessageAiInfo = (parts: readonly LooseMessagePart[]): MessageAiInfo | undefined => {
    const aiInfoPart = [...parts].reverse().find((part) => part.type === 'data' && part.name === 'ai-info');

    if (!aiInfoPart) return undefined;

    const aiInfo = (aiInfoPart.data as FluentMindDataParts['ai-info'] | undefined)?.ai_info;

    if (!aiInfo) return undefined;

    return {
        ...(aiInfo.token_usage && { usage: aiInfo.token_usage }),
        ...(aiInfo.provider && { aiProvider: aiInfo.provider }),
        ...(aiInfo.model && { aiModel: aiInfo.model }),
    };
};

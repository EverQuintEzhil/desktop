import type { BridgeStatus } from '@thefluentmind/genui-sdk';

import type { ContentItemTool } from '../../chat-details';

export const getToolName = (item: ContentItemTool): string => {
    if (item.toolName) return item.toolName;
    if (item.type.startsWith('tool-')) return item.type.slice(5);

    return item.type;
};

export const getBridgeStatus = (item: ContentItemTool | undefined): BridgeStatus => {
    if (!item) return { type: 'complete' } as BridgeStatus;
    if (item.state === 'output-available') return { type: 'complete' } as BridgeStatus;
    if (item.state === 'output-error') {
        return {
            type: 'incomplete',
            reason: 'error',
            error: item.errorText || item.output,
        } as BridgeStatus;
    }

    return { type: 'running' } as BridgeStatus;
};

export const findToolForDataPart = (toolItems: ContentItemTool[], toolCallId: string): ContentItemTool | undefined =>
    toolItems.find((item) => item.toolCallId === toolCallId);

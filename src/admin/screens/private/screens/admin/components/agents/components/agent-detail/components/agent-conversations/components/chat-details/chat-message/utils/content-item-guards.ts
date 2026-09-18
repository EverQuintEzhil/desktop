import type {
    ContentItemDataConversation,
    ContentItemDataGenui,
    ContentItemDataMcpui,
    ContentItemStepStart,
    ContentItemTool,
} from '../../chat-details';

export const isToolContentItem = (item: { type: string }): item is ContentItemTool =>
    item.type === 'dynamic-tool' || item.type.startsWith('tool-');

export const isDataGenuiContentItem = (item: { type: string }): item is ContentItemDataGenui =>
    item.type === 'data-genui';

export const isDataMcpuiContentItem = (item: { type: string }): item is ContentItemDataMcpui =>
    item.type === 'data-mcpui';

export const isDataConversationContentItem = (item: { type: string }): item is ContentItemDataConversation =>
    item.type === 'data-conversation';

export const isStepStartContentItem = (item: { type: string }): item is ContentItemStepStart =>
    item.type === 'step-start';

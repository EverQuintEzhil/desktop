import type { ConversationMessage, FluentMindUIMessage } from '@/components/agent-chat/types';

import { mapHistoryToUIMessages } from './map-history-to-ui-messages';
import {
    sanitizeRepositoryMessage,
    toConversationMessagesRepository,
    type ConversationMessagesRepository,
} from './to-conversation-messages-repository';

interface BuildConversationRepositoryOptions {
    messages: ConversationMessage[];
    userId?: string;
    activeLeafMessageId?: string | null;
}

interface TreeNode {
    item: ConversationMessage;
    uiMessage: FluentMindUIMessage;
    depth: number;
}

const ROOT_KEY = '';

const compareByRecency = (a: ConversationMessage, b: ConversationMessage): number => {
    const createdA = a.created_at ?? '';
    const createdB = b.created_at ?? '';

    if (createdA !== createdB) return createdA < createdB ? -1 : 1;
    if (a._id === b._id) return 0;

    return a._id < b._id ? -1 : 1;
};

const groupChildrenByParent = (messages: ConversationMessage[]): Map<string, ConversationMessage[]> => {
    const messageIds = new Set(messages.map((message) => message._id));
    const childrenByParent = new Map<string, ConversationMessage[]>();

    messages.forEach((message) => {
        const parentKey = message.parent_id && messageIds.has(message.parent_id) ? message.parent_id : ROOT_KEY;
        const siblings = childrenByParent.get(parentKey) ?? [];

        childrenByParent.set(parentKey, [...siblings, message]);
    });

    childrenByParent.forEach((siblings) => siblings.sort(compareByRecency));

    return childrenByParent;
};

const flattenTree = (
    messages: ConversationMessage[],
    uiMessagesById: Map<string, FluentMindUIMessage>,
): Array<{ parentId: string | null; node: TreeNode }> => {
    const childrenByParent = groupChildrenByParent(messages);
    const visited = new Set<string>();
    const flattened: Array<{ parentId: string | null; node: TreeNode }> = [];
    const stack = (childrenByParent.get(ROOT_KEY) ?? [])
        .map((item) => ({ item, parentId: null as string | null, depth: 0 }))
        .reverse();

    while (stack.length > 0) {
        const { item, parentId, depth } = stack.pop()!;

        if (visited.has(item._id)) continue;
        visited.add(item._id);

        const uiMessage = uiMessagesById.get(item._id);

        if (uiMessage) flattened.push({ parentId, node: { item, uiMessage, depth } });

        const children = childrenByParent.get(item._id) ?? [];
        const childParentId = uiMessage ? item._id : parentId;
        const childDepth = uiMessage ? depth + 1 : depth;

        for (let index = children.length - 1; index >= 0; index -= 1) {
            stack.push({ item: children[index], parentId: childParentId, depth: childDepth });
        }
    }

    return flattened;
};

const descendToLeaf = (startId: string, childrenByParent: Map<string, TreeNode[]>): string => {
    let currentId = startId;
    let children = childrenByParent.get(currentId);

    while (children && children.length > 0) {
        const mostRecent = children.reduce((best, candidate) =>
            compareByRecency(candidate.item, best.item) > 0 ? candidate : best,
        );

        currentId = mostRecent.item._id;
        children = childrenByParent.get(currentId);
    }

    return currentId;
};

const resolveHeadId = (
    flattened: Array<{ parentId: string | null; node: TreeNode }>,
    activeLeafMessageId: string | null | undefined,
): string | undefined => {
    if (flattened.length === 0) return undefined;

    const ids = new Set(flattened.map(({ node }) => node.item._id));
    const childrenByParent = new Map<string, TreeNode[]>();

    flattened.forEach(({ parentId, node }) => {
        if (!parentId) return;

        const siblings = childrenByParent.get(parentId) ?? [];

        childrenByParent.set(parentId, [...siblings, node]);
    });

    if (activeLeafMessageId && ids.has(activeLeafMessageId)) {
        return descendToLeaf(activeLeafMessageId, childrenByParent);
    }

    const leaves = flattened.map(({ node }) => node).filter((node) => !childrenByParent.has(node.item._id));

    const deepestMostRecent = leaves.reduce((best, candidate) => {
        if (candidate.depth !== best.depth) return candidate.depth > best.depth ? candidate : best;

        return compareByRecency(candidate.item, best.item) > 0 ? candidate : best;
    });

    return deepestMostRecent.item._id;
};

export const buildConversationRepository = ({
    messages,
    userId,
    activeLeafMessageId,
}: BuildConversationRepositoryOptions): ConversationMessagesRepository => {
    const uiMessages = mapHistoryToUIMessages(messages, userId);
    const hasTreeInfo = messages.some((message) => typeof message.parent_id === 'string');

    if (!hasTreeInfo) return toConversationMessagesRepository(uiMessages);

    const uiMessagesById = new Map(uiMessages.map((uiMessage) => [uiMessage.id, uiMessage]));
    const flattened = flattenTree(messages, uiMessagesById);
    const reachedIds = new Set(flattened.map(({ node }) => node.item._id));
    const droppedIds = messages
        .filter((message) => !reachedIds.has(message._id) && uiMessagesById.has(message._id))
        .map((message) => message._id);

    if (droppedIds.length > 0) {
        console.error(`Dropped ${droppedIds.length} unreachable conversation message(s):`, {
            conversationId: messages[0]?.conversation_id,
            droppedIds,
        });
    }

    const headId = resolveHeadId(flattened, activeLeafMessageId);

    return {
        ...(headId !== undefined && { headId }),
        messages: flattened.map(({ parentId, node }) => ({
            parentId,
            message: sanitizeRepositoryMessage(node.uiMessage),
        })),
    };
};

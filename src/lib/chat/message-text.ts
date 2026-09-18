type TextLikePart = {
    type?: string;
    text?: string;
};

interface MessageLike {
    role?: string;
    content?: unknown;
    parts?: unknown[];
}

export const extractMessageText = (message: MessageLike | undefined): string => {
    if (!message) {
        return '';
    }

    if (typeof message.content === 'string') {
        return message.content;
    }

    let rawParts: unknown[] = [];

    if (Array.isArray(message.parts)) {
        rawParts = message.parts;
    } else if (Array.isArray(message.content)) {
        rawParts = message.content;
    }

    return (rawParts as TextLikePart[])
        .filter((part) => part.type === 'text')
        .map((part) => part.text ?? '')
        .join('');
};

export const findLastUserMessage = <T extends { role?: string }>(messages: readonly T[]): T | undefined =>
    [...messages].reverse().find((message) => message.role === 'user');

export const getLastUserMessageText = (messages: readonly MessageLike[]): string =>
    extractMessageText(findLastUserMessage(messages));

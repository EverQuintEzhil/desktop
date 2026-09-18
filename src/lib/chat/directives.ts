import {
    // BotIcon,
    // CpuIcon,
    // DatabaseIcon,
    BlocksIcon,
    WrenchIcon,
    ZapIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Directive {
    type: string;
    label: string;
    id: string;
}

export type DirectiveSegment =
    | {
          type: 'text';
          text: string;
      }
    | {
          type: 'directive';
          text: string;
          directive: Directive;
      };

const DIRECTIVE_REGEX = /:([\w-]+)\[([^\]]+)\](?:\{name=([^}]+)\})?/g;
const DIRECTIVE_ELEMENT_CLASS = 'directive-highlight';

const safeDecodeDirectiveValue = (value: string) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

export const formatDirectiveText = (type: string, label: string, id: string) => {
    const encodedLabel = encodeURIComponent(label);
    const encodedId = encodeURIComponent(id);

    if (encodedLabel === encodedId) {
        return `:${type}[${encodedLabel}]`;
    }

    return `:${type}[${encodedLabel}]{name=${encodedId}}`;
};

export const parseDirectiveText = (text: string): DirectiveSegment[] => {
    const segments: DirectiveSegment[] = [];
    let lastIndex = 0;
    let match;

    while ((match = DIRECTIVE_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({
                type: 'text',
                text: text.slice(lastIndex, match.index),
            });
        }

        segments.push({
            type: 'directive',
            text: match[0],
            directive: {
                type: safeDecodeDirectiveValue(match[1]),
                label: safeDecodeDirectiveValue(match[2]),
                id: safeDecodeDirectiveValue(match[3] ?? match[2]),
            },
        });

        lastIndex = DIRECTIVE_REGEX.lastIndex;
    }

    if (lastIndex < text.length) {
        segments.push({
            type: 'text',
            text: text.slice(lastIndex),
        });
    }

    return segments;
};

const getDirectiveFromElement = (element: HTMLElement) => {
    const type = element.dataset.directiveType || '';
    const label = element.dataset.directiveLabel || element.textContent || '';
    const id = element.dataset.directiveId || label;

    return formatDirectiveText(type, label, id);
};

export const serializeDirectiveEditableText = (element: HTMLElement): string => {
    const serializeNode = (node: ChildNode): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const elementNode = node as HTMLElement;

        if (elementNode.classList.contains(DIRECTIVE_ELEMENT_CLASS)) {
            return getDirectiveFromElement(elementNode);
        }

        let serialized = '';

        elementNode.childNodes.forEach((child) => {
            serialized += serializeNode(child);
        });

        return serialized;
    };

    let output = '';

    element.childNodes.forEach((child) => {
        output += serializeNode(child);
    });

    return output;
};

export const getSerializedTextPosition = (
    element: HTMLElement,
    offset: number,
): { node: Node; offset: number } | null => {
    let currentOffset = 0;

    const visitNode = (node: ChildNode): { node: Node; offset: number } | null => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const elementNode = node as HTMLElement;

            if (elementNode.classList.contains(DIRECTIVE_ELEMENT_CLASS)) {
                const directiveLength = getDirectiveFromElement(elementNode).length;

                if (currentOffset + directiveLength >= offset) {
                    return { node: elementNode, offset: directiveLength === 0 || offset <= currentOffset ? 0 : 1 };
                }

                currentOffset += directiveLength;

                return null;
            }

            for (const child of Array.from(elementNode.childNodes)) {
                const result = visitNode(child);

                if (result) return result;
            }

            return null;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const nodeLength = node.textContent?.length || 0;

            if (currentOffset + nodeLength >= offset) {
                return {
                    node,
                    offset: Math.min(offset - currentOffset, nodeLength),
                };
            }

            currentOffset += nodeLength;
        }

        return null;
    };

    for (const child of Array.from(element.childNodes)) {
        const result = visitNode(child);

        if (result) return result;
    }

    return null;
};

export const getSerializedTextOffset = (element: HTMLElement): number | null => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);

    if (!element.contains(range.commonAncestorContainer) && element !== range.commonAncestorContainer) {
        return null;
    }

    const measureNode = (node: ChildNode): number => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent?.length || 0;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return 0;
        }

        const elementNode = node as HTMLElement;

        if (elementNode.classList.contains(DIRECTIVE_ELEMENT_CLASS)) {
            return getDirectiveFromElement(elementNode).length;
        }

        let length = 0;

        elementNode.childNodes.forEach((child) => {
            length += measureNode(child);
        });

        return length;
    };

    const measureUntil = (node: Node): number | null => {
        if (node === range.startContainer) {
            if (node.nodeType === Node.TEXT_NODE) {
                return range.startOffset;
            }

            let length = 0;
            const elementNode = node as HTMLElement;

            Array.from(elementNode.childNodes)
                .slice(0, range.startOffset)
                .forEach((child) => {
                    length += measureNode(child);
                });

            return length;
        }

        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains(DIRECTIVE_ELEMENT_CLASS)) {
            return null;
        }

        let length = 0;

        for (const child of Array.from(node.childNodes)) {
            const childLength = measureUntil(child);

            if (childLength !== null) {
                return length + childLength;
            }

            length += measureNode(child);
        }

        return null;
    };

    return measureUntil(element);
};

export const setSerializedTextOffset = (element: HTMLElement, offset: number): boolean => {
    const selection = window.getSelection();

    if (!selection) return false;

    try {
        const range = document.createRange();
        const position = getSerializedTextPosition(element, offset);

        if (!position) {
            range.selectNodeContents(element);
            range.collapse(false);
        } else if (position.node.nodeType === Node.ELEMENT_NODE) {
            const elementNode = position.node as HTMLElement;

            if (position.offset === 0) {
                range.setStartBefore(elementNode);
            } else {
                range.setStartAfter(elementNode);
            }

            range.collapse(true);
        } else {
            range.setStart(position.node, position.offset);
            range.collapse(true);
        }

        selection.removeAllRanges();
        selection.addRange(range);

        return true;
    } catch {
        return false;
    }
};

export interface DirectiveSuggestionBase {
    id: string;
    label: string;
    description?: string;
    type: string;
    icon: LucideIcon;
    serverUrl?: string;
}

interface RestrictableItem {
    noAccess?: boolean;
}

export interface AgentWithDirectives {
    tools?: ({ _id: string; refName?: string; name?: string; description?: string } & RestrictableItem)[];
    skills?: ({ _id: string; name: string; description?: string } & RestrictableItem)[];
    dataStores?: ({ _id: string; refName?: string; name?: string; description?: string } & RestrictableItem)[];
    mcpServers?: ({ _id: string; name: string; description?: string; serverUrl?: string } & RestrictableItem)[];
    models?: { _id: string; refName?: string; model?: string; description?: string }[];
    agents?: ({ _id: string; slug?: string; name: string; description?: string } & RestrictableItem)[];
}

// The agent payload now carries capabilities the viewer cannot access instead of omitting
// them; a directive naming one would be rejected by the backend, so it is never suggested.
const usable = <T extends RestrictableItem>(items: T[] | undefined): T[] =>
    (items ?? []).filter((item) => item.noAccess !== true);

export const buildDirectiveSuggestions = (agent: AgentWithDirectives): DirectiveSuggestionBase[] => {
    const suggestions: DirectiveSuggestionBase[] = [];

    usable(agent.tools).forEach((tool) => {
        suggestions.push({
            id: tool.refName || tool._id,
            label: tool.name || tool.refName || tool._id,
            description: tool.description,
            type: 'tool',
            icon: WrenchIcon,
        });
    });

    usable(agent.skills).forEach((skill) => {
        suggestions.push({
            id: skill._id,
            label: skill.name,
            description: skill.description,
            type: 'skill',
            icon: ZapIcon,
        });
    });

    // agent.dataStores?.forEach((dataStore) => {
    //     suggestions.push({
    //         id: dataStore.refName || dataStore._id,
    //         label: dataStore.name || dataStore.refName || dataStore._id,
    //         description: dataStore.description,
    //         type: 'datastore',
    //         icon: DatabaseIcon,
    //     });
    // });

    usable(agent.mcpServers).forEach((mcpServer) => {
        suggestions.push({
            id: mcpServer.name || mcpServer._id,
            label: mcpServer.name,
            description: mcpServer.description,
            type: 'mcp',
            icon: BlocksIcon,
            serverUrl: mcpServer.serverUrl,
        });
    });

    // agent.models?.forEach((model) => {
    //     suggestions.push({
    //         id: model.refName || model._id,
    //         label: model.model || model.refName || model._id,
    //         description: model.description,
    //         type: 'model',
    //         icon: CpuIcon,
    //     });
    // });

    // agent.agents?.forEach((linkedAgent) => {
    //     suggestions.push({
    //         id: linkedAgent.slug || linkedAgent._id,
    //         label: linkedAgent.name,
    //         description: linkedAgent.description,
    //         type: 'agent',
    //         icon: BotIcon,
    //     });
    // });

    return suggestions;
};

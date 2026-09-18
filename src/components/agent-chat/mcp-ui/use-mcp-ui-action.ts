import { useAui } from '@assistant-ui/react';
import type { AppRendererProps } from '@mcp-ui/client';
import { useMemo } from 'react';

type McpUiActionHandlers = Pick<AppRendererProps, 'onMessage' | 'onOpenLink' | 'onCallTool'>;

type TextPart = { type: 'text'; text: string };

type McpUiMessageContent = Parameters<NonNullable<AppRendererProps['onMessage']>>[0]['content'];

const toTextParts = (content: McpUiMessageContent): TextPart[] =>
    content
        .filter(
            (block): block is { type: 'text'; text: string } => block.type === 'text' && typeof block.text === 'string',
        )
        .map((block) => ({ type: 'text', text: block.text }));

/**
 * Security contract for AppRenderer host callbacks on external (untrusted) MCP
 * Apps content: `onMessage` appends a user turn (guest content normalized to
 * text parts, non-text blocks dropped); `onOpenLink` is gated behind an explicit
 * confirm; `onCallTool` rejects guest-initiated tool calls.
 */
export const useMcpUiAction = (): McpUiActionHandlers => {
    const aui = useAui();

    return useMemo<McpUiActionHandlers>(
        () => ({
            onMessage: async (params) => {
                const content = toTextParts(params.content);

                if (content.length > 0) {
                    await aui.thread.append({ role: 'user', content });
                }

                return {};
            },
            onOpenLink: async (params) => {
                const { url } = params;
                const confirmed = typeof window !== 'undefined' && window.confirm(`Open external link?\n\n${url}`);

                if (confirmed) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }

                return {};
            },
            onCallTool: async () => {
                // Display-only v1: no in-browser MCP socket to proxy guest tool calls, so reject explicitly.
                throw new Error('Tool calls from external app content are not yet supported.');
            },
        }),
        [aui],
    );
};

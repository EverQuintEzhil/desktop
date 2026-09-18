import type { ToolLabelResolver } from '@/components/assistant-ui/tool-label';
import type { ChatAgentType } from '@/types/admin';

export const WEB_SEARCH_TOOL_NAMES = new Set(['openai.web_search_preview', 'web_search', 'web_search_firecrawl']);

export const WEB_SEARCH_LABELS = {
    starting: 'Searching the Web',
    ending: 'Searched the Web',
};

export const createToolLabelResolver =
    (agent: ChatAgentType): ToolLabelResolver =>
    (toolName, phase) => {
        if (WEB_SEARCH_TOOL_NAMES.has(toolName)) {
            return phase === 'running' ? WEB_SEARCH_LABELS.starting : WEB_SEARCH_LABELS.ending;
        }

        const tool = agent.tools.find((t) => t.refName === toolName);
        const authored = phase === 'running' ? tool?.descriptionDuringExecution : tool?.descriptionPostExecution;

        return authored || undefined;
    };

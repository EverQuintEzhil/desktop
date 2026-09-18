import type { FloatingAssistantConfig } from '@/admin/components/floating-assistant';
import type { CodeLangEnum, CodeTypeEnum } from '@/types/admin';

const devHost = import.meta.env.VITE_DEV_HOST as string;
const AGENT_BUILDER_API = `https://api.${devHost}/agent-builder`;

const TOOL_BUILDER_API = `${AGENT_BUILDER_API}/tool-builder`;

export const pickCodeManagerConfig = (
    lang: CodeLangEnum,
    _type?: CodeTypeEnum,
    toolId?: string,
): FloatingAssistantConfig | null => {
    if (lang === 'lua') {
        return {
            api: TOOL_BUILDER_API,
            mode: 'lua',
            label: 'Lua Assistant',
            toolId,
        };
    }

    return null;
};

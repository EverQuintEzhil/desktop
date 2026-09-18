import type { AgentSettingsType } from '@/types/admin';

export interface AgentAccessFlagsSource {
    settings?: AgentSettingsType | null;
}

// The four access flags live only on `agent.settings` (mirrors api/helpers/resolve_agent_ui_flags.js).
// The legacy `uiConfig` copies are stale and are no longer read — every agent payload that gates
// these features must carry `settings`.
export const resolveAgentAccessFlags = (agent: AgentAccessFlagsSource): Required<AgentSettingsType> => {
    const source: AgentSettingsType = agent.settings ?? {};

    return {
        allowCustomSkills: source.allowCustomSkills === true,
        allowSharedSkills: source.allowSharedSkills === true,
        allowCustomConnectors: source.allowCustomConnectors === true,
        allowSharedConnectors: source.allowSharedConnectors === true,
    };
};

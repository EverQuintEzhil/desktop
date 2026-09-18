import { useMemo } from 'react';

import { usePermissions } from '@/hooks';
import type { AgentType, CapabilityListEntry } from '@/types/admin';

import { CapabilitiesEdit } from '../../../../../capabilities-edit';

import { AgentAccessFlags } from './components';
import { useAgentAccessFlags } from './use-agent-access-flags';

interface Props {
    agent: AgentType;
    canUserEdit: boolean;
    onSubmit: (value: AgentType) => void;
}

const AgentCapabilities = (props: Props) => {
    const { agent, onSubmit, canUserEdit } = props;

    const accessFlags = useAgentAccessFlags(agent, onSubmit);
    const { hasAdminPrivileges } = usePermissions();

    // Also mounted in the app bundle, at /agent-builder/:id/advanced-settings/capabilities, where the
    // viewer may hold the `user` role and so has no /admin route to land on.
    const adminTagTo = (getTo: (capability: CapabilityListEntry) => string) => (hasAdminPrivileges ? getTo : undefined);

    const defaultMcpIds = useMemo(() => {
        return agent.mcpServers ? agent.mcpServers.filter((mcp) => mcp.isRecommended).map((mcp) => mcp._id) : [];
    }, [agent.mcpServers]);

    const defaultSkillIds = useMemo(() => {
        return agent.skills ? agent.skills.filter((skill) => skill.isRecommended).map((skill) => skill._id) : [];
    }, [agent.skills]);

    return (
        <>
            <div className="tab-content agent-tab agent-border flex flex-col gap-4">
                <CapabilitiesEdit
                    capabilities={agent.models || []}
                    capabilitiesType="models"
                    title="Models"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="modelIds"
                    isMultiSelect={true}
                    getTagTo={adminTagTo((model) => `/admin/models/${model._id}`)}
                    defaultCapabilityId={agent.defaultModelId}
                    showDefaultCapabilityStar={true}
                    getDefaultCapabilitySubmitData={(defaultModelId) => ({ defaultModelId: defaultModelId ?? null })}
                    onSubmit={onSubmit}
                />
                <CapabilitiesEdit
                    capabilities={agent.apps || []}
                    capabilitiesType="apps"
                    title="Apps"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="appIds"
                    isMultiSelect={true}
                    getTagTo={adminTagTo((app) => `/admin/apps/${app._id}`)}
                    onSubmit={onSubmit}
                />
                <CapabilitiesEdit
                    capabilities={agent.agents || []}
                    capabilitiesType="agents"
                    title="Agents"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="agentIds"
                    isMultiSelect={true}
                    notAllowedOptionIds={[agent._id]}
                    getTagTo={adminTagTo((linkedAgent) => `/admin/agents/${(linkedAgent as AgentType).slug?.trim()}`)}
                    onSubmit={onSubmit}
                />
                <CapabilitiesEdit
                    capabilities={agent.skills || []}
                    capabilitiesType="skills"
                    title="Skills"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="skills"
                    isMultiSelect={true}
                    notAllowedOptionIds={[agent._id]}
                    getTagTo={adminTagTo((skill) => `/admin/skills/${skill._id}`)}
                    defaultCapabilityId={defaultSkillIds}
                    showDefaultCapabilityStar={true}
                    defaultCapabilityNoteText="Select skills to mark them as recommended for this agent."
                    formatCapabilitiesForSubmit={(ids, defaultIds) => ({
                        skills: ids.map((id) => ({
                            skillId: id,
                            isRecommended: Array.isArray(defaultIds) ? defaultIds.includes(id) : id === defaultIds,
                        })),
                    })}
                    headerSlot={
                        <AgentAccessFlags
                            settings={accessFlags.settings}
                            canUserEdit={canUserEdit}
                            flagKeys={['allowCustomSkills', 'allowSharedSkills']}
                            onToggle={accessFlags.onToggle}
                        />
                    }
                    onSubmit={onSubmit}
                />
                <CapabilitiesEdit
                    capabilities={agent.mcpServers || []}
                    capabilitiesType="mcpservers"
                    title="Connectors"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="mcpServers"
                    isMultiSelect={true}
                    getTagTo={adminTagTo((mcp) => `/admin/mcps/${mcp._id}`)}
                    defaultCapabilityId={defaultMcpIds}
                    showDefaultCapabilityStar={true}
                    defaultCapabilityNoteText="Select connectors to mark them as recommended for this agent."
                    formatCapabilitiesForSubmit={(ids, defaultIds) => ({
                        mcpServers: ids.map((id) => ({
                            mcpServerId: id,
                            isRecommended: Array.isArray(defaultIds) ? defaultIds.includes(id) : id === defaultIds,
                        })),
                    })}
                    headerSlot={
                        <AgentAccessFlags
                            settings={accessFlags.settings}
                            canUserEdit={canUserEdit}
                            flagKeys={['allowCustomConnectors', 'allowSharedConnectors']}
                            onToggle={accessFlags.onToggle}
                        />
                    }
                    onSubmit={onSubmit}
                />
                <CapabilitiesEdit
                    capabilities={agent.dataStores || []}
                    capabilitiesType="datastores"
                    title="Data Stores"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="dataStoreIds"
                    isMultiSelect={true}
                    getTagTo={adminTagTo((store) => `/admin/data-stores/${store._id}`)}
                    onSubmit={onSubmit}
                />
                <CapabilitiesEdit
                    capabilities={agent.tools || []}
                    capabilitiesType="tools"
                    title="Tools"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="toolIds"
                    isMultiSelect={true}
                    getTagTo={adminTagTo((tool) => `/admin/tools/${tool._id}`)}
                    onSubmit={onSubmit}
                />
                <CapabilitiesEdit
                    capabilities={agent.memories || []}
                    capabilitiesType="memories"
                    title="Memories"
                    id={agent._id}
                    type={'agents'}
                    canUserEdit={canUserEdit}
                    field="memoryIds"
                    isMultiSelect={true}
                    getTagTo={adminTagTo((memory) => `/admin/memories/${memory._id}`)}
                    onSubmit={onSubmit}
                />
            </div>
        </>
    );
};

export default AgentCapabilities;

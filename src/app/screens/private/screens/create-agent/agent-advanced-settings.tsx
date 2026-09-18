import { Routes, Route, useParams } from 'react-router-dom';

import AgentDetail from '@/admin/screens/private/screens/admin/components/agents/components/agent-detail';

interface AgentAdvancedSettingsProps {
    agentName: string;
    onBack: () => void;
}

const AgentAdvancedSettings = ({ agentName, onBack }: AgentAdvancedSettingsProps) => {
    const { id } = useParams<{ id: string }>();

    return (
        <Routes>
            <Route
                path="advanced-settings/*"
                element={
                    <AgentDetail
                        basePath={`/agent-builder/${id}/advanced-settings`}
                        parentBreadcrumbs={[]}
                        isAppView={true}
                        agentName={agentName}
                        onBack={onBack}
                        // We grant full permissions here because this route is only reachable
                        // from the builder view, which strictly enforces agent ownership.
                        appPermissions={{
                            canEdit: true,
                            canDelete: true,
                            canClone: true,
                            canViewConfigs: true,
                            canEditConfigs: true,
                            canViewHistories: false,
                        }}
                    />
                }
            />
        </Routes>
    );
};

export default AgentAdvancedSettings;

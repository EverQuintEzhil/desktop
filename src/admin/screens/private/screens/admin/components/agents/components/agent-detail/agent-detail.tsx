import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { usePermissions } from '@/hooks';
import { AGENTS_QUERY_KEY, useAgentBySlugOrIdQuery } from '@/lib/api/admin/agents';
import { cn } from '@/lib/utils';
import type { AgentType, LauncherType, ModelType } from '@/types/admin';
import { hasAppUi, hasChatUi } from '@/types/ui';

import { BuilderConversationsLegacyRedirect } from '../../../builder-conversations';
import CodeManager from '../../../code-manager';
import Header from '../../../header';

import './agent-detail.scss';
import ParametersSchema from '../../../parameters-schema';

import {
    AgentPlayground,
    AgentConversations,
    AgentInfo,
    AgentHistory,
    AgentCapabilities,
    AgentAccess,
} from './components';
import AgentActions from './components/agent-actions';
import AgentMeta from './components/agent-meta';

interface AgentDetailProps {
    basePath?: string;
    parentBreadcrumbs?: { to?: string; title: string }[];
    isAppView?: boolean;
    onBack?: () => void;
    agentName?: string;
    appPermissions?: {
        canEdit?: boolean;
        canDelete?: boolean;
        canClone?: boolean;
        canViewConfigs?: boolean;
        canEditConfigs?: boolean;
        canViewHistories?: boolean;
    };
}

const AgentDetail = ({
    basePath = '/admin/agents',
    parentBreadcrumbs = [{ to: '/admin/agents', title: 'Agents' }],
    isAppView = false,
    onBack,
    agentName,
    appPermissions,
}: AgentDetailProps = {}) => {
    const { checkMultiplePermissions } = usePermissions();
    const queryClient = useQueryClient();
    const params = useParams();
    const slugOrId = params.agentId || params.id!;

    const { data, isLoading, refetch } = useAgentBySlugOrIdQuery(slugOrId);

    const adminUserIds = (data?.admins?.map((user) => (typeof user === 'string' ? user : user._id)) as string[]) ?? [];

    const [
        canUserEditAdmin,
        canUserDeleteAdmin,
        canUserCloneAdmin,
        canUserViewConfigsAdmin,
        canUserEditConfigsAdmin,
        canUserViewHistoriesAdmin,
    ] = checkMultiplePermissions([
        {
            module: 'agents',
            action: 'put',
            resourceContext: { adminIds: adminUserIds },
        },
        {
            module: 'agents',
            action: 'delete',
            resourceContext: { adminIds: adminUserIds },
        },
        {
            module: 'agents',
            action: 'clone',
            resourceContext: { adminIds: adminUserIds },
        },
        {
            module: 'agentConfigs',
            action: 'get',
            resourceContext: { adminIds: adminUserIds },
        },
        {
            module: 'agentConfigs',
            action: 'put',
            resourceContext: { adminIds: adminUserIds },
        },
        {
            module: 'agentHistories',
            action: 'get',
            resourceContext: { adminIds: adminUserIds },
        },
    ]);

    const canUserEdit = appPermissions?.canEdit || canUserEditAdmin;
    const canUserDelete = appPermissions?.canDelete || canUserDeleteAdmin;
    const canUserClone = appPermissions?.canClone || canUserCloneAdmin;
    const canUserViewConfigs = appPermissions?.canViewConfigs || canUserViewConfigsAdmin;
    const canUserEditConfigs = appPermissions?.canEditConfigs || canUserEditConfigsAdmin;
    const canUserViewHistories = appPermissions?.canViewHistories || canUserViewHistoriesAdmin;

    const renderTabs = (agent: AgentType) => {
        const activeSubTab = params['*']?.split('/').shift();
        const resolvedBasePath = isAppView ? basePath : `${basePath}/${agent.slug}`;

        return (
            <ul className="tab-list scrollbar-controller scrollbar-horizontal flex items-center gap-1 border-b border-border-secondary bg-card px-2 xl:gap-2">
                {canUserViewConfigs && (
                    <li className={`tab-list-item ${activeSubTab === '' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}`}>
                            <span className="text-sm font-medium text-text-secondary">Info</span>
                        </Link>
                    </li>
                )}
                {canUserViewConfigs && (
                    <li className={`tab-list-item ${activeSubTab === 'capabilities' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/capabilities`}>
                            <span className="text-sm font-medium text-text-secondary">Agent Capabilities</span>
                        </Link>
                    </li>
                )}
                {canUserEditConfigs && (
                    <li className={`tab-list-item ${activeSubTab === 'access' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/access`}>
                            <span className="text-sm font-medium text-text-secondary">Access</span>
                        </Link>
                    </li>
                )}
                {canUserViewConfigs && (
                    <li className={`tab-list-item ${activeSubTab === 'parameters' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/parameters`}>
                            <span className="text-sm font-medium text-text-secondary">Parameters</span>
                        </Link>
                    </li>
                )}
                {canUserViewConfigs && (
                    <li className={`tab-list-item ${activeSubTab === 'system-prompt' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/system-prompt`}>
                            <span className="text-sm font-medium text-text-secondary">System Prompt</span>
                        </Link>
                    </li>
                )}
                {canUserViewConfigs && (
                    <li className={`tab-list-item ${activeSubTab === 'ui-config' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/ui-config`}>
                            <span className="text-sm font-medium text-text-secondary">UI Config</span>
                        </Link>
                    </li>
                )}
                {canUserViewConfigs && (
                    <li className={`tab-list-item ${activeSubTab === 'model-config' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/model-config`}>
                            <span className="text-sm font-medium text-text-secondary">Model Config</span>
                        </Link>
                    </li>
                )}
                {canUserViewHistories && agent.conversationsEnabled && (hasChatUi(agent) || hasAppUi(agent)) && (
                    <li className={`tab-list-item ${activeSubTab === 'conversations' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/conversations`}>
                            <span className="text-sm font-medium text-text-secondary">Conversations</span>
                        </Link>
                    </li>
                )}
                {canUserViewHistories && agent.historyEnabled && (
                    <li className={`tab-list-item ${activeSubTab === 'history' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/history`}>
                            <span className="text-sm font-medium text-text-secondary">History</span>
                        </Link>
                    </li>
                )}
                {
                    <li className={`tab-list-item ${activeSubTab === 'playground' ? 'active' : ''}`}>
                        <Link to={`${resolvedBasePath}/playground`}>
                            <span className="text-sm font-medium text-text-secondary">Playground</span>
                        </Link>
                    </li>
                }
            </ul>
        );
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="loading-state-wrapper flex min-h-[calc(100svh-138px)] items-center justify-center p-6 px-4">
                    <div className="loading-state-inner flex flex-col items-center justify-center gap-4">
                        <Spinner className="scale-150" />
                        <div className="flex flex-col items-center justify-center gap-2 text-center">
                            <h3 className="font-medium">Loading Agent Details</h3>
                            <span className="text-sm text-text-secondary">Fetching information...</span>
                        </div>
                    </div>
                </div>
            );
        }

        // Only a cold failure is an error screen. A background refetch that fails must
        // degrade to the stale agent rather than replacing the tab the user is working in.
        if (!data) {
            return (
                <div className="flex items-center justify-center px-4 py-6">
                    <div className="error-state-wrapper flex flex-col items-center justify-center gap-4 text-center">
                        <div className="error-icon-wrap flex items-center justify-center rounded-circle">
                            <svg className="size-5 stroke-red-500" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="error-title">Failed to Load Agent</h3>
                            <span className="text-sm">Network issue or agent doesn&apos;t exist</span>
                            <button
                                type="button"
                                className="retry-button rounded-md px-3 py-[6px]"
                                onClick={() => refetch()}
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        const updateAgentData = (value: AgentType | LauncherType | ModelType) => {
            queryClient.setQueryData<AgentType>([...AGENTS_QUERY_KEY, 'detail', slugOrId], (prev) =>
                prev ? { ...prev, ...(value as AgentType), dynamicFields: prev.dynamicFields } : prev,
            );
            // The PUT response is the raw agent document: its skills/mcpServers/memories
            // entries carry no `effectiveEnabled`, the per-user folded preference the GET
            // adds. Writing it straight into the cache would read back as "everything
            // enabled" in the playground, so refetch the folded shape. Scoped to the
            // whole `detail` prefix because `setAgentDetailCaches` writes the raw agent
            // under the id, the slug and the route key alike.
            void queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, 'detail'] }).then(() => {
                // A silently failed refetch leaves the raw shape in place, so the
                // playground would keep reading every skill as enabled with nothing
                // on screen to say why. react-query swallows the refetch error, so
                // read it back off the query state.
                if (queryClient.getQueryState([...AGENTS_QUERY_KEY, 'detail', slugOrId])?.status === 'error') {
                    toast.error("Saved, but the agent couldn't be refreshed. Reload the page to see the latest.");
                }
            });
        };

        return (
            <>
                <div
                    className={`secondary-header flex flex-col ${isAppView ? 'advanced-view-header mt-2' : 'admin-view-header'}`}
                >
                    {!isAppView && <AgentMeta agent={data} />}
                    {renderTabs(data)}
                </div>
                <main className="tab-content-area agent-tab-content-area flex h-full flex-1 flex-col">
                    <Routes>
                        {canUserViewConfigs && (
                            <>
                                <Route
                                    path=""
                                    element={
                                        <AgentInfo
                                            agent={data}
                                            canUserEdit={canUserEditConfigs}
                                            onSubmit={updateAgentData}
                                            isAppView={isAppView}
                                        />
                                    }
                                />
                                <Route
                                    path="capabilities"
                                    element={
                                        <AgentCapabilities
                                            agent={data}
                                            canUserEdit={canUserEditConfigs}
                                            onSubmit={updateAgentData}
                                        />
                                    }
                                />
                                {/* Read-only viewers are kept out: everything the tab reports is a gap
                                    only someone who can edit the agent can close. */}
                                {canUserEditConfigs && (
                                    <Route
                                        path="access"
                                        element={<AgentAccess agent={data} canUserEdit={canUserEditConfigs} />}
                                    />
                                )}
                                <Route
                                    path="parameters"
                                    element={
                                        <ParametersSchema
                                            data={data}
                                            canUserEdit={canUserEditConfigs}
                                            onSubmit={updateAgentData}
                                            dataType="agents"
                                        />
                                    }
                                />
                                <Route
                                    path="system-prompt"
                                    element={
                                        <CodeManager
                                            key={'agent_system_prompt'}
                                            type="agent_system_prompt"
                                            lang={['markdown', 'plain_text']}
                                            category="agents"
                                            categoryId={data._id}
                                            categoryIdFieldName="agentId"
                                            categoryFieldName="systemPromptCodeId"
                                            selectedToolCodeId={data.systemPromptCodeId}
                                            canUserEdit={canUserEditConfigs}
                                            onSubmit={(value) => updateAgentData(value as AgentType)}
                                        />
                                    }
                                />
                                <Route
                                    path="ui-config"
                                    element={
                                        <CodeManager
                                            key={'agent_ui_config'}
                                            type="agent_ui_config"
                                            lang={['json']}
                                            agent={data}
                                            category="agents"
                                            categoryId={data._id}
                                            categoryIdFieldName="agentId"
                                            categoryFieldName="uiConfigCodeId"
                                            selectedToolCodeId={data.uiConfigCodeId}
                                            canUserEdit={canUserEditConfigs}
                                            onSubmit={(value) => updateAgentData(value as AgentType)}
                                        />
                                    }
                                />
                                <Route
                                    path="model-config"
                                    element={
                                        <CodeManager
                                            key={'agent_model_config'}
                                            type="agent_model_config"
                                            lang={['json']}
                                            agent={data}
                                            category="agents"
                                            categoryId={data._id}
                                            categoryIdFieldName="agentId"
                                            categoryFieldName="modelConfigCodeId"
                                            selectedToolCodeId={data.modelConfigCodeId}
                                            canUserEdit={canUserEditConfigs}
                                            onSubmit={(value) => updateAgentData(value as AgentType)}
                                        />
                                    }
                                />
                            </>
                        )}
                        {canUserViewHistories && (
                            <>
                                <Route
                                    path="playground/*"
                                    element={
                                        <AgentPlayground
                                            agent={data}
                                            basePath={isAppView ? basePath : `${basePath}/${data.slug}`}
                                        />
                                    }
                                />
                                <Route path="conversations/*" element={<AgentConversations agent={data} />} />
                                <Route path="history/*" element={<AgentHistory agent={data} />} />
                            </>
                        )}
                        {!isAppView && (
                            <Route
                                path="builder-conversations/*"
                                element={<BuilderConversationsLegacyRedirect agentSlug={data.slug} />}
                            />
                        )}
                        <Route path="*" element={<Navigate to={isAppView ? basePath : '/'} />} />
                    </Routes>
                </main>
            </>
        );
    };

    const breadcrumbTitle = isLoading ? 'Loading' : (data?.name ?? 'Loading');
    const resolvedBreadcrumbPath = isAppView ? basePath : `${basePath}/${data?.slug ?? slugOrId}`;

    return (
        <div
            className={cn(
                'agent-details-page flex h-full flex-col',
                isAppView
                    ? 'advanced-view bg-card [&_.agent-tab]:p-4! [&_.agent-tab>div]:border! [&_.history-list]:bg-card! [&_.tab-content-area]:bg-card!'
                    : 'admin-view',
            )}
        >
            {isAppView ? (
                <header className="config-topbar z-10 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
                    <div className="flex min-w-0 items-center gap-2" aria-live="polite">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onBack}
                            className="hover:text-text-primary h-6 w-6 shrink-0 rounded-md text-text-secondary"
                            aria-label="Back to builder"
                        >
                            <ChevronLeft className="size-5" />
                        </Button>
                        <h1 className="m-0 flex min-w-0 items-center gap-2 text-sm">
                            <span className="truncate font-medium text-text-secondary">{agentName}</span>
                            <span className="shrink-0 font-normal text-text-secondary">/</span>
                            <span className="shrink-0 truncate text-base font-medium text-text-secondary">
                                Advanced Settings
                            </span>
                        </h1>
                    </div>
                </header>
            ) : (
                <Header
                    breadcrumbs={[
                        ...parentBreadcrumbs,
                        {
                            to: resolvedBreadcrumbPath,
                            title: breadcrumbTitle,
                        },
                    ]}
                    actions={
                        data && (
                            <AgentActions
                                agent={data}
                                canUserEdit={canUserEdit}
                                canUserDelete={canUserDelete}
                                canUserClone={canUserClone}
                            />
                        )
                    }
                />
            )}
            {renderContent()}
        </div>
    );
};

export default AgentDetail;

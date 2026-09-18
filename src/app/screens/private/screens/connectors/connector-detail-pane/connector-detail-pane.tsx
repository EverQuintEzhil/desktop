import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { ChevronLeftIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { AddConnectorPanel } from '@/app/components/add-connector-panel';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getConnectorStatus, useConnectAction, useConnectResultNotice, useDisconnectAction } from '@/hooks';
import type { McpServer } from '@/lib/api';
import { useDeleteMcpMutation } from '@/lib/api/admin/mcps';
import { invalidateConnectorSurfaces } from '@/lib/api/common/mcp-servers';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';

import ConnectorTools from '../connector-tools';
import { useConnectorEnablement } from '../hooks/use-connector-enablement';
import { useConnectorDetailQuery } from '../hooks/use-connector-queries';

import ConnectorDetailErrorState from './components/connector-detail-error-state';
import ConnectorDetailHeader from './components/connector-detail-header';
import ConnectorDetailInfo from './components/connector-detail-info';
import ConnectorDetailLoading from './components/connector-detail-loading';
import ConnectorDetailPlaceholder from './components/connector-detail-placeholder';
import { useConnectorDetailMutations } from './hooks/use-connector-detail-mutations';

interface ConnectorDetailPaneProps {
    connectorId?: string;
    className?: string;
}

const ConnectorDetailPane = ({ connectorId, className }: ConnectorDetailPaneProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentUser = useSelector(selectUser);
    const deleteMutation = useDeleteMcpMutation();
    const { connect, connectingId } = useConnectAction();
    const { disconnect, disconnectingId } = useDisconnectAction();
    const { handleRefreshTools, handleRetryLoad } = useConnectorDetailMutations(connectorId);
    const [showDisconnect, setShowDisconnect] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const isFetchingTools = useIsFetching({ queryKey: ['connectors', 'tools', connectorId] }) > 0;

    const { data: server, isLoading: isServerLoading, isError: isServerError } = useConnectorDetailQuery(connectorId);

    const isOAuth = server?.authType === 'oauth';
    const {
        isEnabled,
        toggle,
        isPending: isEnablementPending,
        isEnablementLoading,
    } = useConnectorEnablement(connectorId, !!server && !isOAuth, server);

    const connectResultSources = useMemo(() => (server ? [server] : undefined), [server]);

    useConnectResultNotice(connectResultSources, !isServerLoading);

    const rawStatus = server ? getConnectorStatus(server, server.connection) : undefined;

    const actionStatus = rawStatus;

    const isPending = rawStatus === 'pending' || connectingId === server?._id;
    const serverName = server?.name ?? 'this connector';
    const isOwner = !!server?.creator?._id && server.creator._id === currentUser._id;
    const disconnectMessage = isPending
        ? `Cancel the connection attempt for ${serverName}? You can start over anytime.`
        : `Disconnect ${serverName}? You'll need to reconnect and authorize again to use it.`;
    const isLoading = isServerLoading;
    const isError = isServerError;

    if (!connectorId) {
        return <ConnectorDetailPlaceholder className={className} />;
    }

    const handleConfirmDisconnect = async () => {
        if (!server) {
            return;
        }

        await disconnect(
            server,
            isPending
                ? { successMessage: 'Connection cancelled.', errorMessage: 'Failed to cancel connection.' }
                : undefined,
        );
        setShowDisconnect(false);
    };

    const handleConfirmDelete = async () => {
        if (!server) {
            return;
        }

        await deleteMutation.mutateAsync(server._id);
        // Drop this connector's own caches first: the broad invalidation below prefix-matches
        // them, and refetching a deleted id just fires 404s (the tools call proxies to the
        // live MCP server) before the pane unmounts.
        queryClient.removeQueries({ queryKey: ['connectors', 'detail', server._id] });
        queryClient.removeQueries({ queryKey: ['connectors', 'tools', server._id] });
        queryClient.removeQueries({ queryKey: ['connectors', 'tool-preferences', server._id] });
        invalidateConnectorSurfaces(queryClient);
        setShowDelete(false);
        navigate('/settings/connectors');
    };

    const renderBackButton = () => (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit lg:hidden"
            onClick={() => navigate('/settings/connectors')}
        >
            <ChevronLeftIcon className="size-4" />
            Connectors
        </Button>
    );

    const renderContent = (currentServer: McpServer) => (
        <div className="mx-auto flex w-full max-w-4xl flex-col">
            <ConnectorDetailHeader
                server={currentServer}
                isOwner={isOwner}
                actionStatus={actionStatus}
                connectingId={connectingId}
                disconnectingId={disconnectingId}
                isEnabled={isEnabled}
                isEnablementPending={isEnablementPending}
                isEnablementLoading={isEnablementLoading}
                isFetchingTools={isFetchingTools}
                onConnect={connect}
                onRequestDisconnect={() => setShowDisconnect(true)}
                onToggleEnablement={() => toggle()}
                onRefreshTools={() => {
                    void handleRefreshTools();
                }}
                onEditRequest={() => setShowEdit(true)}
                onDeleteRequest={() => setShowDelete(true)}
            />
            <ConnectorDetailInfo server={currentServer} />
            <ConnectorTools serverId={currentServer._id} status={actionStatus || 'not_connected'} />
        </div>
    );

    const renderBody = () => {
        if (isLoading) {
            return <ConnectorDetailLoading />;
        }
        if (isError || !server) {
            return (
                <ConnectorDetailErrorState
                    onRetry={() => {
                        void handleRetryLoad();
                    }}
                    onBackToConnectors={() => navigate('/settings/connectors')}
                />
            );
        }

        return renderContent(server);
    };

    return (
        <div className={cn('flex flex-col gap-4 bg-background', className)}>
            {renderBackButton()}
            {renderBody()}
            <ConfirmationModal
                isOpen={showDisconnect}
                title={isPending ? 'Cancel connection' : 'Disconnect connector'}
                message={disconnectMessage}
                confirmButtonText={isPending ? 'Cancel connection' : 'Disconnect'}
                isButtonLoading={disconnectingId === server?._id}
                onConfirm={handleConfirmDisconnect}
                onClose={() => setShowDisconnect(false)}
            />
            <ConfirmationModal
                isOpen={showDelete}
                title="Delete connector"
                message={`Delete ${serverName}? This permanently removes the connector for everyone. This can't be undone.`}
                confirmButtonText="Delete"
                isButtonLoading={deleteMutation.isPending}
                onConfirm={handleConfirmDelete}
                onClose={() => setShowDelete(false)}
            />
            {server && (
                <Dialog
                    open={showEdit}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) setShowEdit(false);
                    }}
                >
                    <DialogContent className="flex h-[min(640px,calc(100vh-64px))]! w-full flex-col overflow-hidden p-0 sm:max-w-[520px]!">
                        <AddConnectorPanel
                            server={server}
                            onBack={() => setShowEdit(false)}
                            onClose={() => setShowEdit(false)}
                            onSuccess={() => {
                                setShowEdit(false);
                                invalidateConnectorSurfaces(queryClient);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

export default ConnectorDetailPane;

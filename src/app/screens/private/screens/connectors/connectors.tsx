import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AddConnectorPanel } from '@/app/components/add-connector-panel';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getConnectorStatus, useInfiniteScroll } from '@/hooks';
import type { McpServer } from '@/lib/api';
import {
    CONNECTED_CONNECTORS_QUERY_KEY,
    invalidateConnectorSurfaces,
    NOT_CONNECTED_CONNECTORS_QUERY_KEY,
} from '@/lib/api/common/mcp-servers';
import { cn } from '@/lib/utils';

import ConnectorDetailPane from './connector-detail-pane';
import ConnectorsListPane, { type ConnectorGroup, type ConnectorListItem } from './connectors-list-pane';
import { useConnectedConnectorsQuery, useNotConnectedConnectorsQuery } from './hooks/use-connector-queries';

const Connectors = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { connectorId } = useParams<{ connectorId: string }>();
    const [search, setSearch] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);

    const {
        data,
        isLoading: isNotConnectedLoading,
        isError: isNotConnectedError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useNotConnectedConnectorsQuery(search);

    const {
        data: connectedData,
        isLoading: isConnectedLoading,
        isError: isConnectedError,
    } = useConnectedConnectorsQuery(search);

    const notConnectedServers = useMemo(() => data?.pages.flatMap((p) => p.values) ?? [], [data]);

    const isLoading = isNotConnectedLoading || isConnectedLoading;
    const isError = isNotConnectedError || isConnectedError;

    const groups = useMemo<ConnectorGroup[]>(() => {
        const toItem = (server: McpServer): ConnectorListItem => ({
            server,
            status: getConnectorStatus(server, server.connection),
        });

        const connectedServers = connectedData?.values ?? [];
        const connectedIds = new Set(connectedServers.map((server) => server._id));

        return [
            { label: 'Connected', items: connectedServers.map(toItem) },
            {
                label: 'Not connected',
                items: notConnectedServers.filter((server) => !connectedIds.has(server._id)).map(toItem),
                count: data?.pages[0]?.pageInfo.totalCount,
            },
        ].filter((group) => group.items.length > 0);
    }, [connectedData, notConnectedServers, data]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: notConnectedServers.length,
        onLoadMore: fetchNextPage,
    });

    const onSelect = (id: string) => navigate(`/settings/connectors/${id}`);
    const onRetryList = async () => {
        await Promise.all([
            queryClient.refetchQueries({ queryKey: [...NOT_CONNECTED_CONNECTORS_QUERY_KEY, search] }),
            queryClient.refetchQueries({ queryKey: [...CONNECTED_CONNECTORS_QUERY_KEY, search] }),
        ]);
    };

    return (
        <div className="flex flex-col bg-muted/30 lg:-mx-8 lg:-my-6 lg:h-svh lg:min-h-0 lg:flex-row lg:overflow-hidden">
            <ConnectorsListPane
                groups={groups}
                selectedId={connectorId}
                onSelect={onSelect}
                search={search}
                onSearchChange={setSearch}
                isLoading={isLoading}
                isError={isError}
                loadMoreRef={loadMoreRef}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onRetry={() => void onRetryList()}
                onAddConnector={() => setIsAddOpen(true)}
                className={cn('w-full lg:w-80 lg:shrink-0', connectorId && 'hidden lg:flex')}
            />
            <ConnectorDetailPane
                connectorId={connectorId}
                className={cn('w-full min-w-0 flex-1 lg:overflow-y-auto lg:p-4', !connectorId && 'hidden lg:flex')}
            />
            <Dialog
                open={isAddOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setIsAddOpen(false);
                }}
            >
                <DialogContent className="flex h-[min(640px,calc(100vh-64px))]! w-full flex-col overflow-hidden p-0 sm:max-w-[520px]!">
                    <AddConnectorPanel
                        onBack={() => setIsAddOpen(false)}
                        onClose={() => setIsAddOpen(false)}
                        onSuccess={(connector) => {
                            setIsAddOpen(false);
                            invalidateConnectorSurfaces(queryClient);
                            navigate(`/settings/connectors/${connector._id}`);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Connectors;

import { MoreVertical, PencilIcon, RefreshCw, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConnectorStatus } from '@/hooks';
import type { McpServer } from '@/lib/api';
import { cn } from '@/lib/utils';

import ConnectorAvatar from '../../components/connector-avatar';

import ConnectorActionButtons from './connector-action-buttons';

interface Props {
    server: McpServer;
    isOwner: boolean;
    actionStatus: ConnectorStatus | undefined;
    connectingId: string | null;
    disconnectingId: string | null;
    isEnabled: boolean;
    isEnablementPending: boolean;
    isEnablementLoading: boolean;
    isFetchingTools: boolean;
    onConnect: (server: McpServer) => void;
    onRequestDisconnect: () => void;
    onToggleEnablement: () => void;
    onRefreshTools: () => void;
    onEditRequest: () => void;
    onDeleteRequest: () => void;
}

const ConnectorDetailHeader = ({
    server,
    isOwner,
    actionStatus,
    connectingId,
    disconnectingId,
    isEnabled,
    isEnablementPending,
    isEnablementLoading,
    isFetchingTools,
    onConnect,
    onRequestDisconnect,
    onToggleEnablement,
    onRefreshTools,
    onEditRequest,
    onDeleteRequest,
}: Props) => {
    const isConnected = server.authType === 'oauth' ? actionStatus === 'connected' : false;

    return (
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
                <ConnectorAvatar
                    name={server.name}
                    serverUrl={server.serverUrl}
                    className={cn(
                        'size-13 rounded-xl border border-border bg-card text-base font-semibold text-foreground',
                        isConnected &&
                            'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400',
                    )}
                />
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-semibold tracking-tight">{server.name}</h2>
                        <Badge
                            variant="secondary"
                            className="w-fit rounded-full border-transparent bg-primary/10 text-primary"
                        >
                            {isOwner ? 'Custom' : 'Firmwide'}
                        </Badge>
                    </div>
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                        {server.description?.trim() ||
                            'Manage authorization, connector metadata, and available tool permissions.'}
                    </span>
                </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0 [&>*:not(:last-child)]:flex-1 sm:[&>*:not(:last-child)]:flex-none">
                {actionStatus && (
                    <ConnectorActionButtons
                        server={server}
                        status={actionStatus}
                        connectingId={connectingId}
                        disconnectingId={disconnectingId}
                        onConnect={onConnect}
                        onRequestDisconnect={onRequestDisconnect}
                        isEnabled={isEnabled}
                        isEnablementPending={isEnablementPending}
                        isEnablementLoading={isEnablementLoading}
                        onToggleEnablement={onToggleEnablement}
                    />
                )}
                <DropdownMenuRoot modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Connector actions"
                            className="shrink-0 text-muted-foreground shadow-none hover:text-foreground"
                        >
                            <MoreVertical className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={isFetchingTools}
                            onSelect={onRefreshTools}
                        >
                            <RefreshCw className={cn('size-4', isFetchingTools && 'animate-spin')} aria-hidden="true" />
                            Refresh tools list
                        </DropdownMenuItem>
                        {isOwner && (
                            <>
                                <DropdownMenuItem className="cursor-pointer" onSelect={onEditRequest}>
                                    <PencilIcon className="size-4" />
                                    Edit connector
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    className="cursor-pointer"
                                    onSelect={onDeleteRequest}
                                >
                                    <Trash2 className="size-4" />
                                    Delete connector
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenuRoot>
            </div>
        </header>
    );
};

export default ConnectorDetailHeader;

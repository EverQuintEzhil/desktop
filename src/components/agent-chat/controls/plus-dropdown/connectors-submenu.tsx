import { Blocks, Globe, Plug, RotateCw, SettingsIcon, UserRoundIcon, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedLabel } from '@/components/ui/truncated-label';
import { isTokenExpired } from '@/hooks';
import type { McpConnection } from '@/lib/api';

import type { DisconnectedConnector, NonOauthConnector } from '../../types';

import { INDICATOR_BOX_CLASS, STATIC_ROW_CLASS, toggleRowKeyDown } from './constants';
import SubmenuSearchInput from './submenu-search-input';

const SEARCH_THRESHOLD = 10;

export interface ConnectorsSubmenuProps {
    connections: McpConnection[];
    nonOauthConnectors: NonOauthConnector[];
    disconnectedConnectors: DisconnectedConnector[];
    isLoading: boolean;
    disabledMap: Record<string, boolean>;
    customIds?: string[];
    sharedIds?: string[];
    onToggle: (mcpServerId: string) => void;
    renderManageAction?: (children: ReactNode) => ReactNode;
    onReconnect: (mcpServerId: string) => void;
    /** Enables a logged-out OAuth connector and continues into its auth flow, or disables it. */
    onToggleDisconnected: (mcpServerId: string) => void;
    connectingId: string | null;
    enablingId?: string | null;
    onCancel: (mcpServerId: string) => void;
    cancellingId: string | null;
    align?: 'start' | 'end';
}

const ConnectorsSubmenu = ({
    connections,
    nonOauthConnectors,
    disconnectedConnectors,
    isLoading,
    disabledMap,
    customIds = [],
    sharedIds = [],
    onToggle,
    renderManageAction,
    onReconnect,
    onToggleDisconnected,
    connectingId,
    enablingId = null,
    onCancel,
    cancellingId,
    align = 'start',
}: ConnectorsSubmenuProps) => {
    const [search, setSearch] = useState('');
    const showSearch =
        connections.length + nonOauthConnectors.length + disconnectedConnectors.length > SEARCH_THRESHOLD;

    const query = search.trim().toLowerCase();
    const filteredConnections = useMemo(
        () => (query ? connections.filter((c) => (c.mcpServerName ?? '').toLowerCase().includes(query)) : connections),
        [connections, query],
    );
    const filteredNonOauth = useMemo(
        () => (query ? nonOauthConnectors.filter((c) => c.name.toLowerCase().includes(query)) : nonOauthConnectors),
        [nonOauthConnectors, query],
    );
    const filteredDisconnected = useMemo(
        () =>
            query ? disconnectedConnectors.filter((c) => c.name.toLowerCase().includes(query)) : disconnectedConnectors,
        [disconnectedConnectors, query],
    );

    const renderCustomIndicator = (id: string) => {
        if (!customIds.includes(id)) {
            return null;
        }

        return (
            <TooltipProvider>
                <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                        <span className={INDICATOR_BOX_CLASS}>
                            <UserRoundIcon className="size-3.5 text-primary" aria-label="Your custom connector" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">Your custom connector</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderSharedIndicator = (id: string) => {
        if (!sharedIds.includes(id)) {
            return null;
        }

        return (
            <TooltipProvider>
                <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                        <span className={INDICATOR_BOX_CLASS}>
                            <Globe className="size-3.5 text-primary" aria-label="Enterprise connector" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">Enterprise</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderReconnectIcon = (isReconnecting: boolean) => {
        if (isReconnecting) {
            return <Spinner className="size-3.5 text-primary" />;
        }

        return <RotateCw className="size-3.5 text-primary" />;
    };

    const renderReconnectButton = (connection: McpConnection) => {
        const isReconnecting = connectingId === connection.mcpServerId;
        const label = isReconnecting ? 'Reconnecting…' : 'Reconnect';

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-xs"
                            variant="secondary"
                            disabled={isReconnecting}
                            aria-label={label}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onReconnect(connection.mcpServerId);
                            }}
                        >
                            {renderReconnectIcon(isReconnecting)}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderToggleRow = (connection: McpConnection) => {
        const needsReconnect = connection.status !== 'connected' || isTokenExpired(connection.tokenExpiry);
        const showReconnect = needsReconnect && !disabledMap[connection.mcpServerId];

        return (
            <DropdownMenuItem
                key={connection.mcpServerId}
                onSelect={(e) => e.preventDefault()}
                onKeyDown={toggleRowKeyDown(() => onToggle(connection.mcpServerId))}
                data-static-row
                className={STATIC_ROW_CLASS}
            >
                <TruncatedLabel text={connection.mcpServerName ?? 'Unknown server'} />
                <span className="flex shrink-0 items-center gap-2">
                    {renderCustomIndicator(connection.mcpServerId)}
                    {renderSharedIndicator(connection.mcpServerId)}
                    {showReconnect ? renderReconnectButton(connection) : null}
                    <ToggleSwitch
                        checked={!disabledMap[connection.mcpServerId]}
                        onCheckedChange={() => onToggle(connection.mcpServerId)}
                        aria-label={`Toggle ${connection.mcpServerName ?? 'connector'}`}
                    />
                </span>
            </DropdownMenuItem>
        );
    };

    const renderNonOauthRow = (connector: NonOauthConnector) => (
        <DropdownMenuItem
            key={connector._id}
            onSelect={(e) => e.preventDefault()}
            onKeyDown={toggleRowKeyDown(() => onToggle(connector._id))}
            data-static-row
            className={STATIC_ROW_CLASS}
        >
            <TruncatedLabel text={connector.name} />
            <span className="flex shrink-0 items-center gap-2">
                {renderCustomIndicator(connector._id)}
                {renderSharedIndicator(connector._id)}
                <ToggleSwitch
                    checked={!disabledMap[connector._id]}
                    onCheckedChange={() => onToggle(connector._id)}
                    aria-label={`Toggle ${connector.name}`}
                />
            </span>
        </DropdownMenuItem>
    );

    const renderConnectIcon = (isConnecting: boolean) => {
        if (isConnecting) {
            return <Spinner className="size-3.5 text-primary" />;
        }

        return <Plug className="size-3.5 text-primary" />;
    };

    const renderConnectButton = (connector: DisconnectedConnector) => {
        const isConnecting = connectingId === connector._id;
        // The row goes enabled optimistically, so this button appears while the preference
        // save is still in flight; connecting now would unload the page and abort it.
        const isPending = isConnecting || enablingId === connector._id;
        const label = isConnecting ? 'Connecting…' : 'Connect';

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-xs"
                            variant="secondary"
                            disabled={isPending}
                            aria-label={label}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onReconnect(connector._id);
                            }}
                        >
                            {renderConnectIcon(isConnecting)}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderConnectRow = (connector: DisconnectedConnector) => {
        const isEnabled = !disabledMap[connector._id];

        return (
            <DropdownMenuItem
                key={connector._id}
                onSelect={(e) => e.preventDefault()}
                onKeyDown={toggleRowKeyDown(() => onToggleDisconnected(connector._id))}
                data-static-row
                className={STATIC_ROW_CLASS}
            >
                <TruncatedLabel text={connector.name} className="text-muted-foreground" />
                <span className="flex shrink-0 items-center gap-2">
                    {renderCustomIndicator(connector._id)}
                    {renderSharedIndicator(connector._id)}
                    {isEnabled ? renderConnectButton(connector) : null}
                    <ToggleSwitch
                        checked={isEnabled}
                        onCheckedChange={() => onToggleDisconnected(connector._id)}
                        aria-label={`Toggle ${connector.name}`}
                    />
                </span>
            </DropdownMenuItem>
        );
    };

    const renderCancelIcon = (isCancelling: boolean) => {
        if (isCancelling) {
            return <Spinner className="size-3.5 text-primary" />;
        }

        return <X className="size-3.5 text-primary" />;
    };

    const renderCancelButton = (connection: McpConnection) => {
        const isCancelling = cancellingId === connection.mcpServerId;
        const label = isCancelling ? 'Cancelling…' : 'Cancel connection';

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={isCancelling}
                            aria-label={label}
                            onClick={() => onCancel(connection.mcpServerId)}
                        >
                            {renderCancelIcon(isCancelling)}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderPendingRow = (connection: McpConnection) => (
        <DropdownMenuItem
            key={connection.mcpServerId}
            onSelect={(e) => e.preventDefault()}
            data-static-row
            className={STATIC_ROW_CLASS}
        >
            <TruncatedLabel text={connection.mcpServerName ?? 'Unknown server'} />
            {renderCancelButton(connection)}
        </DropdownMenuItem>
    );

    const renderConnection = (connection: McpConnection) => {
        if (connection.status === 'pending') {
            return renderPendingRow(connection);
        }

        return renderToggleRow(connection);
    };

    // The agent's own connectors lead; the user's custom/shared ones merged in follow.
    const isExtra = (id: string) => customIds.includes(id) || sharedIds.includes(id);

    const renderGroup = (extra: boolean) => (
        <>
            {filteredConnections.filter((c) => isExtra(c.mcpServerId) === extra).map(renderConnection)}
            {filteredNonOauth.filter((c) => isExtra(c._id) === extra).map(renderNonOauthRow)}
            {filteredDisconnected.filter((c) => isExtra(c._id) === extra).map(renderConnectRow)}
        </>
    );

    const renderConnections = () => {
        if (isLoading) {
            return <DropdownMenuItem disabled>Loading…</DropdownMenuItem>;
        }

        if (connections.length === 0 && nonOauthConnectors.length === 0 && disconnectedConnectors.length === 0) {
            return <DropdownMenuItem disabled>No connectors available</DropdownMenuItem>;
        }

        if (filteredConnections.length === 0 && filteredNonOauth.length === 0 && filteredDisconnected.length === 0) {
            return <DropdownMenuItem disabled>No connectors found</DropdownMenuItem>;
        }

        return (
            <>
                {renderGroup(false)}
                {renderGroup(true)}
            </>
        );
    };

    const renderManageRow = () => {
        if (!renderManageAction) {
            return null;
        }

        return (
            <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                    {renderManageAction(
                        <>
                            <SettingsIcon className="h-4 w-4" />
                            <span>Manage connectors</span>
                        </>,
                    )}
                </DropdownMenuItem>
            </>
        );
    };

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <Blocks className="h-4 w-4" />
                <span>Connectors</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent align={align} className="w-[240px] p-0">
                {showSearch ? (
                    <div className="border-b border-border p-2">
                        <SubmenuSearchInput search={search} setSearch={setSearch} placeholder="Search connectors" />
                    </div>
                ) : null}
                <div className="scrollbar-vertical scrollbar-controller max-h-[240px] py-1">{renderConnections()}</div>
                {renderManageRow()}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
};

export default ConnectorsSubmenu;

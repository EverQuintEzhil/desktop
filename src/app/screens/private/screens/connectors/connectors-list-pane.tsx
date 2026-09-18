import { ChevronDown, CircleAlert, Plus, RefreshCw } from 'lucide-react';
import type { Ref } from 'react';
import { useSelector } from 'react-redux';

import { PickerListEmpty } from '@/app/components/picker/picker-list-empty';
import { InfiniteScrollTrigger, SearchInput } from '@/components';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ConnectorStatus } from '@/hooks';
import type { McpServer } from '@/lib/api';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';

import ConnectorAvatar from './components/connector-avatar';
import { isConnectorEnabled } from './utils/is-connector-enabled';
import { isConnectorOwnedBy } from './utils/is-connector-owned-by';

export interface ConnectorListItem {
    server: McpServer;
    status: ConnectorStatus;
}

export interface ConnectorGroup {
    label: string;
    items: ConnectorListItem[];
    count?: number;
}

interface ConnectorsListPaneProps {
    groups: ConnectorGroup[];
    selectedId?: string;
    onSelect: (id: string) => void;
    search: string;
    onSearchChange: (value: string) => void;
    isLoading: boolean;
    isError: boolean;
    loadMoreRef: Ref<HTMLDivElement | null>;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onRetry?: () => void;
    onAddConnector?: () => void;
    className?: string;
}

const SKELETON_COUNT = 6;

const getStatusLabel = (status: ConnectorStatus): string => {
    if (status === 'connected') {
        return 'Connected';
    }
    if (status === 'available') {
        return 'Ready';
    }
    if (status === 'expired') {
        return 'Reconnect';
    }
    if (status === 'pending') {
        return 'Connecting';
    }

    return 'Not connected';
};

const getStatusClassName = (status: ConnectorStatus): string => {
    if (status === 'connected') {
        return 'bg-emerald-500';
    }
    if (status === 'available') {
        return 'bg-primary';
    }
    if (status === 'expired') {
        return 'bg-amber-500';
    }
    if (status === 'pending') {
        return 'bg-amber-500 animate-pulse';
    }

    return 'bg-muted-foreground/40';
};

const ConnectorsListPane = ({
    groups,
    selectedId,
    onSelect,
    search,
    onSearchChange,
    isLoading,
    isError,
    loadMoreRef,
    hasNextPage,
    isFetchingNextPage,
    onRetry,
    onAddConnector,
    className,
}: ConnectorsListPaneProps) => {
    const currentUser = useSelector(selectUser);

    const renderItem = (item: ConnectorListItem) => {
        const { server } = item;
        const isSelected = server._id === selectedId;
        const isConnected = item.status === 'connected';
        const isEnabled = isConnectorEnabled(server);
        const isCustom = isConnectorOwnedBy(server, currentUser._id);

        const renderDescription = () => {
            if (!server.description) {
                return null;
            }

            return (
                <DescriptionHoverCard name={server.name} description={server.description}>
                    <span className="truncate text-xs text-muted-foreground">{server.description}</span>
                </DescriptionHoverCard>
            );
        };

        const renderStatus = () => {
            const statusClassName = isEnabled ? getStatusClassName(item.status) : 'bg-muted-foreground/40';
            const statusLabel = isEnabled ? getStatusLabel(item.status) : 'Disabled';

            return (
                <div className="status-badge flex items-center gap-1.5 text-xs text-muted-foreground transition-colors">
                    <span
                        className={cn('size-1.5 rounded-full transition-colors', statusClassName)}
                        aria-hidden="true"
                    />
                    {statusLabel}
                </div>
            );
        };

        const button = (
            <Button
                type="button"
                variant="ghost"
                onClick={() => onSelect(server._id)}
                className={cn(
                    'group h-auto w-full justify-start gap-3 rounded-none px-4 py-2 text-left whitespace-normal transition-colors',
                    isSelected
                        ? 'bg-primary/10 text-primary hover:bg-primary/10'
                        : 'text-foreground hover:bg-primary/10 active:bg-primary/10',
                )}
                aria-current={isSelected ? 'page' : undefined}
            >
                <ConnectorAvatar
                    name={server.name}
                    serverUrl={server.serverUrl}
                    className={cn(
                        'size-10 rounded-xl bg-primary/10 text-xs font-semibold text-primary transition-colors',
                        isConnected && isEnabled && 'ring-2 ring-emerald-500/50',
                    )}
                />
                <div className="connector-item-content flex min-w-0 flex-1 flex-col">
                    <div className="connector-item-name flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{server.name}</span>
                        <Badge
                            variant="secondary"
                            className="ml-auto h-4 shrink-0 rounded-full border-transparent bg-primary/10 px-1.5 text-[10px] leading-none font-medium text-primary"
                        >
                            {isCustom ? 'Custom' : 'Firmwide'}
                        </Badge>
                    </div>
                    {renderDescription()}
                    {renderStatus()}
                </div>
            </Button>
        );

        return <li key={server._id}>{button}</li>;
    };

    const renderGroup = (group: ConnectorGroup) => (
        <li key={group.label} className="connectors-list-pane-group flex flex-col gap-2">
            <span className="flex items-center justify-between px-4 pt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
                <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                    {group.count ?? group.items.length}
                </Badge>
            </span>
            <ul className="connectors-list-pane-group-items flex flex-col gap-1">{group.items.map(renderItem)}</ul>
        </li>
    );

    const renderLoading = () => (
        <ul className="connectors-list-pane-groups flex flex-col">
            <li className="connectors-list-pane-group flex flex-col gap-2">
                <span className="flex items-center justify-between px-2 pt-3 pb-1">
                    <Skeleton className="h-3 w-20 rounded-sm" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                </span>
                <ul className="connectors-list-pane-group-items flex flex-col gap-1">
                    {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                        <li
                            key={`list-skeleton-${index}`}
                            className="flex items-center gap-3 border border-transparent px-3 py-3"
                        >
                            <Skeleton className="size-10 shrink-0 rounded-xl" />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <Skeleton className={cn('h-3.5 rounded-sm', index % 2 === 0 ? 'w-3/5' : 'w-4/5')} />
                                <span className="flex items-center gap-1.5">
                                    <Skeleton className="size-1.5 shrink-0 rounded-full" />
                                    <Skeleton className="h-3 w-20 rounded-sm" />
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </li>
        </ul>
    );

    const renderError = () => (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <span
                className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-[14px]',
                    'bg-[color-mix(in_srgb,var(--destructive)_8%,var(--surface))] text-destructive',
                    'border border-[color-mix(in_srgb,var(--destructive)_14%,var(--border))]',
                )}
            >
                <CircleAlert size={18} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-(--text-primary)">Failed to load connectors</span>
                <span className="max-w-[220px] text-xs leading-normal text-text-secondary">
                    Check your connection and try loading the connector list again.
                </span>
            </div>
            {onRetry && (
                <Button type="button" variant="secondary" size="sm" className="rounded-[10px]" onClick={onRetry}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Retry
                </Button>
            )}
        </div>
    );

    const renderEmpty = () => (
        <PickerListEmpty label="connectors" search={search} onClearSearch={() => onSearchChange('')} />
    );

    const renderGroups = () => <ul className="connectors-list-pane-groups flex flex-col">{groups.map(renderGroup)}</ul>;

    const renderBody = () => {
        if (isLoading) {
            return renderLoading();
        }
        if (isError) {
            return renderError();
        }
        if (groups.length === 0) {
            return renderEmpty();
        }

        return renderGroups();
    };

    return (
        <div
            className={cn('connectors-list-pane flex min-h-[calc(100svh-80px)] flex-col bg-card lg:min-h-0', className)}
        >
            <div className="connectors-list-pane-header flex flex-col gap-3 border-b border-border/70 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                        <h1 className="text-lg font-semibold">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-pointer">Connectors</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[260px]">
                                    Connect external apps and services to read data and perform actions.
                                </TooltipContent>
                            </Tooltip>
                        </h1>
                        <span className="text-xs text-muted-foreground">
                            Connect services and manage their tool access.
                        </span>
                    </div>
                    {onAddConnector && (
                        <DropdownMenuRoot modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
                                    Add
                                    <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem className="cursor-pointer" onSelect={onAddConnector}>
                                    <Plus className="size-4" aria-hidden="true" />
                                    Add custom connector
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenuRoot>
                    )}
                </div>
                <SearchInput
                    search={search}
                    searchOnChange
                    onChange={onSearchChange}
                    placeholder="Search connectors"
                    className="max-w-full"
                />
            </div>
            <div className="connectors-list-pane-content scrollbar-controller scrollbar-vertical min-h-0 flex-1 lg:pb-6">
                {renderBody()}
                <InfiniteScrollTrigger isLoading={isFetchingNextPage} hasMore={hasNextPage} loadMoreRef={loadMoreRef} />
            </div>
        </div>
    );
};

export default ConnectorsListPane;

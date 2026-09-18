import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, MoreVertical, PencilIcon, RefreshCw, Trash2Icon, XIcon } from 'lucide-react';
import { useSelector } from 'react-redux';

import { PickerDetailSkeleton } from '@/app/components/picker/picker-detail-skeleton';
import {
    actionBase,
    actionRemove,
    getItemAbbr,
    getItemColor,
    panelBtnCls,
    pickerFormWrapCls,
    type PickerItem,
} from '@/app/components/picker/picker-shared';
import { RecommendedActionButton } from '@/app/components/picker/recommended-action-button';
import ConnectorTools from '@/app/screens/private/screens/connectors/connector-tools';
import { useConnectorDetailQuery } from '@/app/screens/private/screens/connectors/hooks/use-connector-queries';
import { CopyButton } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getConnectorStatus } from '@/hooks';
import { useMcpConnectionsQuery } from '@/lib/api';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';
import { showErrorToast } from '@/utils';

interface McpDetailPanelProps {
    item: PickerItem;
    isEnabled: boolean;
    isRecommended?: boolean;
    onToggle: () => void;
    onUpdate?: (isRecommended: boolean) => void;
    onBack: () => void;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export const McpDetailPanel = ({
    item,
    isEnabled,
    isRecommended,
    onToggle,
    onUpdate,
    onBack,
    onClose,
    onEdit,
    onDelete,
}: McpDetailPanelProps) => {
    const currentUser = useSelector(selectUser);
    const queryClient = useQueryClient();
    const { data: server, isLoading: isServerLoading } = useConnectorDetailQuery(item._id);
    const { data: connData, isLoading: isConnectionLoading } = useMcpConnectionsQuery(true, item._id);
    const isFetchingTools = useIsFetching({ queryKey: ['connectors', 'tools', item._id] }) > 0;

    const connection = (connData?.values ?? []).find((c) => c.mcpServerId === item._id);
    const status = server ? getConnectorStatus(server, connection) : 'not_connected';
    const canManage = !!server?.creator?._id && server.creator._id === currentUser._id;
    const isLoading = isServerLoading || isConnectionLoading;

    const abbr = getItemAbbr(item.name);
    const color = getItemColor(item._id);
    const description = server?.description ?? item.description;
    const serverUrl = server?.serverUrl ?? item.serverUrl;
    const subLine = description ? 'Connector' : 'Connected Connector';

    const handleRefreshTools = async () => {
        try {
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ['connectors', 'tools', item._id] }),
                queryClient.refetchQueries({ queryKey: ['connectors', 'tool-preferences', item._id] }),
            ]);

            const toolsState = queryClient.getQueryState(['connectors', 'tools', item._id]);

            if (toolsState?.status === 'error') {
                throw toolsState.error;
            }
        } catch (error: unknown) {
            showErrorToast(error instanceof Error ? error.message : "Couldn't refresh the tools list.");
        }
    };

    const renderMenu = () => (
        <DropdownMenuRoot modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Connector actions"
                    className={panelBtnCls}
                >
                    <MoreVertical size={17} aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={isFetchingTools}
                    onSelect={() => {
                        void handleRefreshTools();
                    }}
                >
                    <RefreshCw className={cn('size-4', isFetchingTools && 'animate-spin')} aria-hidden="true" />
                    Refresh tools list
                </DropdownMenuItem>
                {canManage && (
                    <>
                        <DropdownMenuItem className="cursor-pointer" onSelect={onEdit}>
                            <PencilIcon className="size-4" aria-hidden="true" />
                            Edit connector
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" className="cursor-pointer" onSelect={onDelete}>
                            <Trash2Icon className="size-4" aria-hidden="true" />
                            Delete connector
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );

    const renderContent = () => {
        if (isLoading) {
            return <PickerDetailSkeleton hasServerUrl />;
        }

        return (
            <>
                <p className="m-0 text-sm leading-[1.6] text-text-secondary">
                    {description ||
                        'No description has been provided for this item yet. You can still add it and configure how your agent uses it.'}
                </p>

                <div className="mt-3 flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs font-semibold tracking-[0.06em] text-text-secondary uppercase">
                        Server URL
                    </span>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                        <span title={serverUrl ?? undefined} className="min-w-0 truncate text-sm text-foreground">
                            {serverUrl ?? 'N/A'}
                        </span>
                        {!!serverUrl && (
                            <CopyButton
                                text={serverUrl}
                                className="ml-0! shrink-0 text-muted-foreground hover:text-foreground"
                                ariaLabel="Copy server URL"
                                tooltipContent="Copy server URL"
                            />
                        )}
                    </div>
                </div>

                <ConnectorTools serverId={item._id} status={status} className="[&>*]:p-0" />
            </>
        );
    };

    const renderRecommendedAction = () => {
        if (!isEnabled || !onUpdate) {
            return null;
        }

        return <RecommendedActionButton isRecommended={!!isRecommended} onChange={onUpdate} />;
    };

    return (
        <>
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', panelBtnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-h4 font-bold text-white"
                    style={{ background: color }}
                >
                    {abbr}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate text-lg font-medium tracking-[-0.02em]">{item.name}</h3>
                        <Badge
                            variant="secondary"
                            className="h-4 shrink-0 rounded-full border-transparent bg-primary/10 px-1.5 text-[10px] leading-none font-medium text-primary"
                        >
                            {canManage ? 'Custom' : 'Firmwide'}
                        </Badge>
                    </div>
                    <span className="text-sm text-text-secondary">{subLine}</span>
                </div>
                {renderMenu()}
                <Button variant="ghost" size="icon" className={panelBtnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>
            <div className={cn('modal-agent-content w-full px-4 py-6', pickerFormWrapCls)}>{renderContent()}</div>
            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <div className={cn(pickerFormWrapCls, 'flex flex-col items-stretch gap-2')}>
                    {renderRecommendedAction()}
                    <button className={cn(actionBase, isEnabled && actionRemove)} onClick={onToggle}>
                        {isEnabled ? 'Remove' : 'Enable'}
                    </button>
                </div>
            </div>
        </>
    );
};

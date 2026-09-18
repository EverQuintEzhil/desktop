import { Plug, Plus, XIcon } from 'lucide-react';
import { useState } from 'react';

import { useConnectorEnablement } from '@/app/screens/private/screens/connectors/hooks/use-connector-enablement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useConnectAction, useDisconnectAction, type ConnectorStatus } from '@/hooks';
import type { McpServer } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ConnectorReconnectModalProps {
    server: McpServer | null;
    status: ConnectorStatus | undefined;
    isOpen: boolean;
    onClose: () => void;
    onAddConnector?: () => void;
}

const STATUS_BADGE: Record<ConnectorStatus, { label: string; className: string }> = {
    connected: {
        label: 'Connected',
        className: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    },
    available: { label: 'Ready to use', className: 'border-transparent bg-muted text-muted-foreground' },
    pending: { label: 'Connecting…', className: 'border-transparent bg-muted text-muted-foreground' },
    expired: {
        label: 'Reconnect needed',
        className: 'border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    },
    not_connected: { label: 'Not connected', className: 'border-transparent bg-destructive/10 text-destructive' },
};

export const ConnectorReconnectModal = ({
    server,
    status,
    isOpen,
    onClose,
    onAddConnector,
}: ConnectorReconnectModalProps) => {
    const { connect, connectingId } = useConnectAction();
    const { disconnect, disconnectingId } = useDisconnectAction();
    const [showDisconnect, setShowDisconnect] = useState(false);

    const isOAuth = server?.authType === 'oauth';
    const {
        isEnabled,
        toggle,
        isPending: isEnablementPending,
        isEnablementLoading,
    } = useConnectorEnablement(server?._id, !!server && !isOAuth, server);

    if (!server) return null;

    let badgeStatus = status;

    if (connectingId === server._id) {
        badgeStatus = 'pending';
    }

    const actionStatus = status;

    const isPending = status === 'pending' || connectingId === server._id;
    const serverName = server?.name ?? 'this connector';
    const disconnectMessage = isPending
        ? `Cancel the connection attempt for ${serverName}? You can start over anytime.`
        : `Disconnect ${serverName}? You'll need to reconnect and authorize again to use it.`;

    const handleConfirmDisconnect = async () => {
        if (!server) return;
        await disconnect(server);
        setShowDisconnect(false);
    };

    const renderConnectButton = (currentServer: McpServer, label: string) => {
        if (connectingId === currentServer._id) {
            return (
                <Button size="sm" className="rounded-xl px-4" disabled>
                    <Spinner className="size-4" />
                    Connecting…
                </Button>
            );
        }

        return (
            <Button size="sm" className="rounded-xl px-4" onClick={() => connect(currentServer)}>
                {label}
            </Button>
        );
    };

    const renderDisconnectButton = (currentServer: McpServer, variant: 'outline' | 'ghost' = 'outline') => {
        if (disconnectingId === currentServer._id) {
            return (
                <Button size="sm" variant={variant} className="rounded-xl px-4" disabled>
                    <Spinner className="size-4" />
                    Disconnecting…
                </Button>
            );
        }

        return (
            <Button size="sm" variant={variant} className="rounded-xl px-4" onClick={() => setShowDisconnect(true)}>
                Disconnect
            </Button>
        );
    };

    const renderEnablementButton = () => {
        if (isEnablementLoading) {
            return (
                <Button size="sm" className="rounded-xl px-4" disabled>
                    <Spinner className="size-4" />
                    Loading…
                </Button>
            );
        }

        if (isEnabled) {
            return (
                <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl px-4"
                    disabled={isEnablementPending}
                    onClick={() => toggle()}
                >
                    {isEnablementPending && <Spinner className="size-4" />}
                    Disable
                </Button>
            );
        }

        return (
            <Button size="sm" className="rounded-xl px-4" disabled={isEnablementPending} onClick={() => toggle()}>
                {isEnablementPending && <Spinner className="size-4" />}
                Enable
            </Button>
        );
    };

    const renderAction = (currentServer: McpServer, currentStatus: ConnectorStatus | undefined) => {
        if (!isOAuth) {
            return renderEnablementButton();
        }

        switch (currentStatus) {
            case 'connected':
                return renderDisconnectButton(currentServer, 'outline');
            case 'available':
                return null;
            case 'pending':
                if (disconnectingId === currentServer._id) {
                    return (
                        <Button size="sm" variant="outline" className="rounded-xl px-4" disabled>
                            <Spinner className="size-4" />
                            Cancelling…
                        </Button>
                    );
                }

                return (
                    <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl px-4"
                        onClick={() => setShowDisconnect(true)}
                    >
                        Cancel connection
                    </Button>
                );
            case 'expired':
                return (
                    <div className="flex w-full items-center gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                        {renderConnectButton(currentServer, 'Reconnect')}
                        {renderDisconnectButton(currentServer, 'ghost')}
                    </div>
                );
            case 'not_connected':
            default:
                return renderConnectButton(currentServer, 'Connect');
        }
    };

    return (
        <>
            <Dialog open={isOpen && !showDisconnect} onOpenChange={(open) => !open && !showDisconnect && onClose()}>
                <DialogContent className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[460px]">
                    <DialogHeader className="flex-row items-center justify-between gap-3 px-5 py-4">
                        <DialogTitle className="text-lg font-medium tracking-[-0.03em] text-(--text-primary)">
                            Manage Connection
                        </DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Close"
                            onClick={onClose}
                            className="-mr-1.5 shrink-0 rounded-xl text-text-secondary hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))] hover:text-primary"
                        >
                            <XIcon size={17} aria-hidden="true" />
                        </Button>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-4 px-4 py-8">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-(--shadow-sm)">
                            <Plug className="size-6" aria-hidden="true" />
                        </div>

                        <div className="flex flex-col items-center gap-2 text-center">
                            <h3 className="text-base font-medium tracking-[-0.02em] text-(--text-primary)">
                                {server.name}
                            </h3>
                            {badgeStatus && isOAuth && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        'pointer-events-none h-6 rounded-full px-2.5 text-[11px] font-medium',
                                        STATUS_BADGE[badgeStatus]?.className,
                                    )}
                                >
                                    {STATUS_BADGE[badgeStatus]?.label || badgeStatus}
                                </Badge>
                            )}
                            {!isOAuth && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        'pointer-events-none h-6 rounded-full px-2.5 text-[11px] font-medium',
                                        isEnabled
                                            ? 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                            : 'border-transparent bg-muted text-muted-foreground',
                                    )}
                                >
                                    {isEnabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                            )}
                        </div>

                        {server.serverUrl && (
                            <div className="mt-1 flex w-full flex-col gap-1 rounded-[14px] border border-border bg-[color-mix(in_srgb,var(--muted)_45%,var(--surface))] px-4 py-3.5">
                                <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">
                                    Server URL
                                </span>
                                <span className="text-[13px] leading-snug break-all text-(--text-primary)">
                                    {server.serverUrl}
                                </span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="justify-end gap-2 border-t border-border px-5 py-4">
                        {onAddConnector && (
                            <Button size="sm" variant="outline" className="rounded-xl px-4" onClick={onAddConnector}>
                                <Plus className="size-4" aria-hidden="true" />
                                Add other connectors
                            </Button>
                        )}
                        {renderAction(server, actionStatus)}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {showDisconnect && (
                <ConfirmationModal
                    isOpen={showDisconnect}
                    onClose={() => setShowDisconnect(false)}
                    onConfirm={handleConfirmDisconnect}
                    isButtonLoading={disconnectingId === server._id}
                    title={isPending ? 'Cancel connection?' : 'Disconnect integration?'}
                    confirmButtonText={isPending ? 'Cancel connection' : 'Disconnect'}
                    cancelButtonText={isPending ? 'Keep trying' : 'Cancel'}
                >
                    <p className="text-sm text-muted-foreground">{disconnectMessage}</p>
                </ConfirmationModal>
            )}
        </>
    );
};

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import type { ConnectorStatus } from '@/hooks';
import type { McpServer } from '@/lib/api';

interface Props {
    server: McpServer;
    status: ConnectorStatus;
    connectingId: string | null;
    disconnectingId: string | null;
    onConnect: (server: McpServer) => void;
    onRequestDisconnect: () => void;
    isEnabled: boolean;
    isEnablementPending: boolean;
    isEnablementLoading: boolean;
    onToggleEnablement: () => void;
}

const ConnectorActionButtons = ({
    server,
    status,
    connectingId,
    disconnectingId,
    onConnect,
    onRequestDisconnect,
    isEnabled,
    isEnablementPending,
    isEnablementLoading,
    onToggleEnablement,
}: Props) => {
    const renderConnectButton = (label: string) => {
        if (connectingId === server._id) {
            return (
                <Button size="sm" disabled>
                    <Spinner className="size-4" />
                    Connecting…
                </Button>
            );
        }

        return (
            <Button size="sm" onClick={() => onConnect(server)}>
                {label}
            </Button>
        );
    };

    const renderDisconnectButton = (variant: 'outline' | 'ghost' = 'outline') => {
        if (disconnectingId === server._id) {
            return (
                <Button size="sm" variant={variant} disabled>
                    <Spinner className="size-4" />
                    Disconnecting…
                </Button>
            );
        }

        return (
            <Button size="sm" variant={variant} onClick={onRequestDisconnect}>
                Disconnect
            </Button>
        );
    };

    const renderEnablementButton = () => {
        if (isEnablementLoading) {
            return <Skeleton className="h-8 w-20 rounded-md" />;
        }

        if (isEnabled) {
            return (
                <Button size="sm" variant="outline" disabled={isEnablementPending} onClick={onToggleEnablement}>
                    {isEnablementPending && <Spinner className="size-4" />}
                    Disable
                </Button>
            );
        }

        return (
            <Button size="sm" disabled={isEnablementPending} onClick={onToggleEnablement}>
                {isEnablementPending && <Spinner className="size-4" />}
                Enable
            </Button>
        );
    };

    if (server.authType !== 'oauth') {
        return renderEnablementButton();
    }

    switch (status) {
        case 'connected':
            return renderDisconnectButton('outline');
        case 'available':
            return null;
        case 'pending':
            if (disconnectingId === server._id) {
                return (
                    <Button size="sm" variant="outline" disabled>
                        <Spinner className="size-4" />
                        Cancelling…
                    </Button>
                );
            }

            return (
                <Button size="sm" variant="outline" onClick={onRequestDisconnect}>
                    Cancel connection
                </Button>
            );
        case 'expired':
            return (
                <div className="flex min-w-0 items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                    {renderConnectButton('Reconnect')}
                    {renderDisconnectButton('ghost')}
                </div>
            );
        case 'not_connected':
        default:
            return renderConnectButton('Connect');
    }
};

export default ConnectorActionButtons;

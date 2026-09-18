import { useState } from 'react';

import { buildConnectorFaviconUrl } from '@/lib/chat/connector-favicon';
import { cn } from '@/lib/utils';

const getInitial = (name: string): string => (name.trim().charAt(0) || '?').toUpperCase();

interface ConnectorAvatarProps {
    name: string;
    serverUrl?: string | null;
    className?: string;
}

export const ConnectorAvatar = ({ name, serverUrl, className }: ConnectorAvatarProps) => {
    const [hasError, setHasError] = useState(false);
    const faviconUrl = buildConnectorFaviconUrl(serverUrl);
    const showFavicon = !!faviconUrl && !hasError;

    return (
        <div
            className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden p-1',
                className,
                showFavicon && 'border border-border bg-card',
            )}
        >
            {showFavicon ? (
                <img src={faviconUrl} alt="" className="size-full object-contain" onError={() => setHasError(true)} />
            ) : (
                getInitial(name)
            )}
        </div>
    );
};

export default ConnectorAvatar;

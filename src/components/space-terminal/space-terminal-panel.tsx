import { useRef } from 'react';

import { useTerminalSession } from './use-terminal-session';

interface Props {
    folderPath: string;
}

const SpaceTerminalPanel = ({ folderPath }: Props) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { status, error } = useTerminalSession(folderPath, containerRef);

    return (
        <div className="flex h-full min-h-0 flex-col">
            {status === 'error' && (
                <div className="px-3 py-2 text-xs text-destructive" role="alert">
                    Terminal unavailable: {error}
                </div>
            )}
            {status === 'exited' && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                    Shell exited — close and reopen the terminal to start a new one.
                </div>
            )}
            <div ref={containerRef} className="min-h-0 flex-1 bg-[#1e1e1e] px-1 [&_.xterm]:h-full" />
        </div>
    );
};

export default SpaceTerminalPanel;

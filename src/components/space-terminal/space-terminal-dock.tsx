import { TerminalIcon, XIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { isDesktopRuntime } from '@/lib/local-tools';

import SpaceTerminalPanel from './space-terminal-panel';
import { closeTerminalPanel, getTerminalState, openTerminalPanel, subscribeToTerminal } from './terminal-store';

interface Props {
    folderPath: string | null;
}

/**
 * Desktop-only dock: a Terminal toggle plus a bottom panel showing the Space's
 * shared PTY session — the same session the agent's `terminal` tool drives, so
 * the user watches agent commands live. Gated exactly like the local tools:
 * no folder path on the Space → no terminal.
 */
const SpaceTerminalDock = ({ folderPath }: Props) => {
    const state = useSyncExternalStore(subscribeToTerminal, getTerminalState);

    if (!isDesktopRuntime() || !folderPath?.trim()) {
        return null;
    }

    if (!state.isOpen) {
        return (
            <Button
                variant="outline"
                size="icon"
                aria-label="Open terminal"
                className="fixed bottom-24 right-4 z-40 rounded-full shadow-md"
                onClick={() => openTerminalPanel(folderPath)}
            >
                <TerminalIcon className="size-4" />
            </Button>
        );
    }

    const activeFolder = state.folderPath ?? folderPath;

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 flex h-[40svh] flex-col border-t border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="truncate font-mono text-xs text-muted-foreground">{activeFolder}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Close terminal" onClick={closeTerminalPanel}>
                    <XIcon className="size-4" />
                </Button>
            </div>
            <SpaceTerminalPanel folderPath={activeFolder} />
        </div>
    );
};

export default SpaceTerminalDock;

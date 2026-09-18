import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { ensureTerminalSession, markSessionExited } from './terminal-store';

import '@xterm/xterm/css/xterm.css';

interface TerminalEventPayload {
    id: string;
    data: string;
}

export type TerminalStatus = 'connecting' | 'open' | 'exited' | 'error';

/** Mounts an xterm bound to the shared PTY session inside `container`. */
export const useTerminalSession = (folderPath: string, container: RefObject<HTMLDivElement | null>) => {
    const [status, setStatus] = useState<TerminalStatus>('connecting');
    const [error, setError] = useState<string | null>(null);
    const epochRef = useRef(0);

    useEffect(() => {
        const epoch = ++epochRef.current;
        const element = container.current;

        if (!element) {
            return undefined;
        }

        setStatus('connecting');
        setError(null);

        const term = new Terminal({ fontSize: 12, cursorBlink: true, scrollback: 5000 });
        const fit = new FitAddon();

        term.loadAddon(fit);
        term.open(element);

        let disposed = false;
        const cleanups: Array<() => void> = [];

        const connect = async () => {
            try {
                const id = await ensureTerminalSession(folderPath);

                if (disposed || epoch !== epochRef.current) {
                    return;
                }

                setStatus('open');
                fit.fit();
                void invoke('terminal_resize', { id, cols: term.cols, rows: term.rows }).catch(() => undefined);

                const dataSub = term.onData((data) => {
                    void invoke('terminal_write', { id, data }).catch(() => undefined);
                });

                cleanups.push(() => dataSub.dispose());

                const unlistenOutput = await listen<TerminalEventPayload>('terminal-output', (event) => {
                    if (event.payload.id === id) {
                        term.write(event.payload.data);
                    }
                });

                cleanups.push(unlistenOutput);

                const unlistenExit = await listen<TerminalEventPayload>('terminal-exit', (event) => {
                    if (event.payload.id === id) {
                        markSessionExited(id);
                        setStatus('exited');
                    }
                });

                cleanups.push(unlistenExit);

                const observer = new ResizeObserver(() => {
                    try {
                        fit.fit();
                    } catch {
                        return;
                    }
                    void invoke('terminal_resize', { id, cols: term.cols, rows: term.rows }).catch(() => undefined);
                });

                observer.observe(element);
                cleanups.push(() => observer.disconnect());
            } catch (connectError) {
                if (disposed || epoch !== epochRef.current) {
                    return;
                }
                setStatus('error');
                setError(connectError instanceof Error ? connectError.message : String(connectError));
            }
        };

        void connect();

        return () => {
            // The PTY session deliberately survives (shared with the agent);
            // only this xterm view is torn down.
            disposed = true;
            cleanups.forEach((cleanup) => cleanup());
            term.dispose();
        };
    }, [folderPath, container]);

    return { status, error };
};

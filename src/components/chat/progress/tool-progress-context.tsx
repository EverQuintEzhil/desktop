import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

import { createToolProgressStore, type ToolProgressSnapshot, type ToolProgressStore } from './tool-progress-store';

// Shared always-empty store for consumers without a provider (floating
// assistant, builder, external SDK) — every lookup misses and the default
// tool-group label renders unchanged.
const NOOP_STORE = createToolProgressStore();

const ToolProgressContext = createContext<ToolProgressStore>(NOOP_STORE);

interface ToolProgressProviderProps {
    store: ToolProgressStore;
    children: ReactNode;
}

export const ToolProgressProvider = ({ store, children }: ToolProgressProviderProps) => (
    <ToolProgressContext.Provider value={store}>{children}</ToolProgressContext.Provider>
);

// Subscribes to the active tool-progress snapshot. Without a provider this is
// the stable empty snapshot, so rendering is unchanged.
export const useToolProgressSnapshot = (): ToolProgressSnapshot => {
    const store = useContext(ToolProgressContext);

    return useSyncExternalStore(store.subscribe, store.getSnapshot);
};

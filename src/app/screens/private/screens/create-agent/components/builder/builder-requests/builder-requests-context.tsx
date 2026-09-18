import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { cancelledReceipt, type BuilderRequest, type BuilderRequestReceipt } from './types';

interface BuilderRequestsContextValue {
    pending: BuilderRequest | null;
    open: (request: BuilderRequest) => Promise<BuilderRequestReceipt>;
    resolve: (receipt: BuilderRequestReceipt) => void;
    cancel: (summary?: string) => void;
}

const BuilderRequestsContext = createContext<BuilderRequestsContextValue | null>(null);

interface BuilderRequestsProviderProps {
    // Runs before the request goes pending; the surfaces that answer it must be mounted first.
    onBeforeOpen?: (request: BuilderRequest) => void;
    children: ReactNode;
}

export const BuilderRequestsProvider = ({ onBeforeOpen, children }: BuilderRequestsProviderProps) => {
    const [pending, setPending] = useState<BuilderRequest | null>(null);
    const resolverRef = useRef<((receipt: BuilderRequestReceipt) => void) | null>(null);
    // Ref-forwarded so the context value stays stable when the host passes an inline handler —
    // consumers key state-writing effects on it.
    const onBeforeOpenRef = useRef(onBeforeOpen);

    onBeforeOpenRef.current = onBeforeOpen;

    const settle = useCallback((receipt: BuilderRequestReceipt) => {
        const resolver = resolverRef.current;

        resolverRef.current = null;
        setPending(null);
        resolver?.(receipt);
    }, []);

    const open = useCallback((request: BuilderRequest) => {
        resolverRef.current?.(cancelledReceipt('Superseded by another request.'));

        onBeforeOpenRef.current?.(request);

        return new Promise<BuilderRequestReceipt>((resolve) => {
            resolverRef.current = resolve;
            setPending(request);
        });
    }, []);

    const cancel = useCallback(
        (summary = 'The user closed the form without saving.') => settle(cancelledReceipt(summary)),
        [settle],
    );

    const value = useMemo<BuilderRequestsContextValue>(
        () => ({
            pending,
            open,
            resolve: settle,
            cancel,
        }),
        [pending, open, settle, cancel],
    );

    return <BuilderRequestsContext.Provider value={value}>{children}</BuilderRequestsContext.Provider>;
};

// For the chat tools that raise requests; they only ever render inside the builder.
export const useBuilderRequests = (): BuilderRequestsContextValue => {
    const context = useContext(BuilderRequestsContext);

    if (!context) {
        throw new Error('useBuilderRequests must be used inside a BuilderRequestsProvider.');
    }

    return context;
};

const NOOP_HOST: BuilderRequestsContextValue = {
    pending: null,
    open: () => Promise.resolve(cancelledReceipt('No builder request host is mounted.')),
    resolve: () => {},
    cancel: () => {},
};

// For the surfaces that answer requests; they also render standalone, so no provider is not an error.
export const useBuilderRequestHost = (): BuilderRequestsContextValue => useContext(BuilderRequestsContext) ?? NOOP_HOST;

export const usePendingBuilderRequest = (...kinds: BuilderRequest['kind'][]): BuilderRequest | null => {
    const { pending } = useBuilderRequestHost();

    if (!pending || !kinds.includes(pending.kind)) {
        return null;
    }

    return pending;
};

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { ToolApprovalContextValue } from '@/components/agent-chat/types';

const ToolApprovalContext = createContext<ToolApprovalContextValue | null>(null);

export function useToolApproval(): ToolApprovalContextValue {
    const ctx = useContext(ToolApprovalContext);

    if (!ctx) throw new Error('useToolApproval must be used inside ToolApprovalProvider');

    return ctx;
}

interface ToolApprovalProviderProps {
    children: ReactNode;
}

export function ToolApprovalProvider({ children }: ToolApprovalProviderProps) {
    const [alwaysAllowed, setAlwaysAllowed] = useState<Set<string>>(() => new Set());
    const [pendingIds, setPendingIds] = useState<string[]>([]);

    const isAlwaysAllowed = useCallback((toolName: string) => alwaysAllowed.has(toolName), [alwaysAllowed]);

    const addAlwaysAllowed = useCallback((toolName: string) => {
        setAlwaysAllowed((prev) => {
            if (prev.has(toolName)) return prev;

            const next = new Set(prev);

            next.add(toolName);

            return next;
        });
    }, []);

    const register = useCallback((id: string) => {
        setPendingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const unregister = useCallback((id: string) => {
        setPendingIds((prev) => prev.filter((pendingId) => pendingId !== id));
    }, []);

    const isActive = useCallback((id: string) => pendingIds[0] === id, [pendingIds]);

    const value = useMemo<ToolApprovalContextValue>(
        () => ({
            isAlwaysAllowed,
            addAlwaysAllowed,
            register,
            unregister,
            isActive,
        }),
        [isAlwaysAllowed, addAlwaysAllowed, register, unregister, isActive],
    );

    return <ToolApprovalContext.Provider value={value}>{children}</ToolApprovalContext.Provider>;
}

export { ToolApprovalContext };

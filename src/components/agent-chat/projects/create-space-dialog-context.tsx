import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ProjectType } from '@/types/project';

import CreateSpaceDialog from './create-space-dialog';

interface OpenCreateSpaceArgs {
    agentId: string;
    onCreated?: (project: ProjectType) => void;
}

interface CreateSpaceDialogContextValue {
    openCreateSpace: (args: OpenCreateSpaceArgs) => void;
}

const CreateSpaceDialogContext = createContext<CreateSpaceDialogContextValue | null>(null);

// Owns a single create-space dialog outside any dropdown so it survives the
// menu that opened it being closed (and unmounted).
export const CreateSpaceDialogProvider = ({ children }: { children: ReactNode }) => {
    const [open, setOpen] = useState(false);
    const [args, setArgs] = useState<OpenCreateSpaceArgs | null>(null);

    const openCreateSpace = useCallback((next: OpenCreateSpaceArgs) => {
        setArgs(next);
        setOpen(true);
    }, []);

    const handleOpenChange = useCallback((next: boolean) => {
        setOpen(next);
        if (!next) setArgs(null);
    }, []);

    const value = useMemo(() => ({ openCreateSpace }), [openCreateSpace]);

    return (
        <CreateSpaceDialogContext.Provider value={value}>
            {children}
            {args ? (
                <CreateSpaceDialog
                    agentId={args.agentId}
                    open={open}
                    onOpenChange={handleOpenChange}
                    onCreated={args.onCreated}
                />
            ) : null}
        </CreateSpaceDialogContext.Provider>
    );
};

export const useCreateSpaceDialog = () => useContext(CreateSpaceDialogContext);

export default CreateSpaceDialogProvider;

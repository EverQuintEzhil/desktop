import { InfoIcon } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import AgentDetails from '@/app/screens/private/screens/agents/components/agent-details';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';

export interface UseAgentLauncherSidesheetReturn {
    launcherName: string;
    handleOpenSidesheet: (e: React.MouseEvent) => void;
    handleCloseSidesheet: () => void;
    renderAgentDetailsSidesheet: () => React.ReactElement | null;
    renderInfoIcon: (wrapperClassName?: string) => React.ReactElement;
    infoIconProps: React.ComponentProps<typeof InfoIcon> & {
        style: { cursor: string };
        onClick: (e: React.MouseEvent) => void;
    };
}

export default function useAgentLauncherSidesheet(agent: AgentType): UseAgentLauncherSidesheetReturn {
    const [sidesheetState, setSidesheetState] = useState<{
        isOpen: boolean;
        selectedAgent: AgentType | null;
    }>({
        isOpen: false,
        selectedAgent: null,
    });

    const handleOpenSidesheet = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setSidesheetState({
                isOpen: true,
                selectedAgent: agent,
            });
        },
        [agent],
    );

    const handleCloseSidesheet = useCallback(() => {
        setSidesheetState({
            isOpen: false,
            selectedAgent: null,
        });
    }, []);

    const renderAgentDetailsSidesheet = useCallback(() => {
        if (!sidesheetState.selectedAgent) return null;

        return (
            <AgentDetails
                isOpen={sidesheetState.isOpen}
                selectedAgent={sidesheetState.selectedAgent}
                isAgentType
                onClose={handleCloseSidesheet}
            />
        );
    }, [sidesheetState.isOpen, sidesheetState.selectedAgent, handleCloseSidesheet]);

    const launcherName = agent.launcher?.name ?? agent.name;

    const infoIconProps: UseAgentLauncherSidesheetReturn['infoIconProps'] = {
        className: 'size-4 text-primary',
        style: { cursor: 'pointer' },
        onClick: handleOpenSidesheet,
    };

    const renderInfoIcon = useCallback(
        (wrapperClassName?: string) => (
            <span
                role="button"
                tabIndex={0}
                className={cn(
                    'inline-flex rounded-full outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus-ring)',
                    wrapperClassName,
                )}
                onClick={handleOpenSidesheet}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenSidesheet(e as unknown as React.MouseEvent);
                    }
                }}
            >
                <InfoIcon className="size-4 text-primary" style={{ cursor: 'pointer' }} />
            </span>
        ),
        [handleOpenSidesheet],
    );

    return {
        launcherName,
        handleOpenSidesheet,
        handleCloseSidesheet,
        renderAgentDetailsSidesheet,
        renderInfoIcon,
        infoIconProps,
    };
}

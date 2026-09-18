import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';

import { invalidateAgentTiles } from '../../../agents/hooks/use-agents-queries';
import { setLauncherPublished } from '../../lib/launcher-publish';

import EditLauncherDialog from './edit-launcher-dialog';
import LauncherVisibilityMenuItem from './launcher-visibility-menu-item';
import PublishToLauncherButton from './publish-to-launcher-button';
import PublishToLauncherDialog from './publish-to-launcher-dialog';
import PublishToLauncherMenuItem from './publish-to-launcher-menu-item';
import { launcherQueryKey, useAgentLauncher } from './use-agent-launcher';

interface VisibilityChange {
    agentId: string;
    launcherId: string;
    isPublished: boolean;
}

interface LauncherControlsInput {
    agentId?: string;
    agentName: string;
    getAgentDescription?: () => string;
}

export interface LauncherControls {
    /** The top-bar pill: an offer to publish, or the launcher state, named. */
    button: ReactNode;
    /** The overflow-menu rows, present only once a launcher exists. */
    menuItem: ReactNode;
    /** Both dialogs, mounted outside the menu so closing it does not unmount them. */
    dialogs: ReactNode;
}

/**
 * Keeps the launcher lifecycle out of the builder topbar, which already owns pending changes,
 * clone and delete. The query lives here rather than in the menu item because the topbar outlives
 * the menu: as the only observer, the menu item would let the entry be evicted between openings.
 */
export const useLauncherControls = ({
    agentId,
    agentName,
    getAgentDescription,
}: LauncherControlsInput): LauncherControls => {
    const queryClient = useQueryClient();
    const { isAllowed, state, refresh } = useAgentLauncher(agentId);
    const [publishOpen, setPublishOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

    const visibilityMutation = useMutation({
        // The agent rides in the variables rather than being read from the closure: react-query
        // re-points a pending mutation at the latest render's options, and this row leaves the menu
        // open, so `Clone agent` is one click away mid-flight. Read from the closure, the refetch
        // below would land on whichever agent the builder had navigated to instead.
        mutationFn: ({ launcherId, isPublished }: VisibilityChange) => setLauncherPublished(launcherId, isPublished),
        onSuccess: async (_result, variables) => {
            await queryClient.refetchQueries({ queryKey: launcherQueryKey(variables.agentId) });
            void invalidateAgentTiles(queryClient);
            toast.success(
                variables.isPublished ? 'Launcher is back on the home screen' : 'Launcher hidden from the home screen',
            );
        },
        onError: (error: unknown) =>
            toast.error(getApiErrorMessage(error, 'Could not change this launcher. Please try again.')),
    });

    const { reset: resetVisibility } = visibilityMutation;

    // The builder swaps `:id` without remounting the topbar, so a dialog left open would carry the
    // previous agent's launcher into the next one — and an in-flight toggle would spin and disable
    // the incoming agent's row for a call that was never about it.
    useEffect(() => {
        setPublishOpen(false);
        setEditOpen(false);
        resetVisibility();
    }, [agentId, resetVisibility]);

    if (!agentId || !isAllowed || !state) {
        return { button: null, menuItem: null, dialogs: null };
    }

    const { launcher } = state;

    return {
        button: (
            <PublishToLauncherButton agentId={agentId} launcher={launcher} onPublish={() => setPublishOpen(true)} />
        ),
        menuItem: launcher ? (
            <>
                <LauncherVisibilityMenuItem
                    isPublished={launcher.isPublished !== false}
                    isPending={visibilityMutation.isPending}
                    onToggle={() =>
                        visibilityMutation.mutate({
                            agentId,
                            launcherId: launcher._id,
                            isPublished: launcher.isPublished === false,
                        })
                    }
                />
                <PublishToLauncherMenuItem
                    isBusy={visibilityMutation.isPending}
                    onEdit={() => {
                        // Awaited before the panel mounts, not alongside it: the launcher is cached
                        // for five minutes and a rename since then has already moved its URL, so the
                        // form has to seed from the row as it is now.
                        void refresh().then(() => setEditOpen(true));
                    }}
                />
            </>
        ) : null,
        dialogs: (
            <>
                {publishOpen ? (
                    <PublishToLauncherDialog
                        agentId={agentId}
                        agentName={agentName}
                        agentDescription={state.agentDescription}
                        getAgentDescription={getAgentDescription}
                        onClose={() => setPublishOpen(false)}
                    />
                ) : null}
                {editOpen && launcher ? (
                    <EditLauncherDialog
                        agentId={agentId}
                        agentName={agentName}
                        launcher={launcher}
                        onClose={() => setEditOpen(false)}
                    />
                ) : null}
            </>
        ),
    };
};

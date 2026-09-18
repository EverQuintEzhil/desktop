import { useQuery } from '@tanstack/react-query';

import { useAppSelector } from '@/hooks';
import usePermissions from '@/hooks/use-permissions';
import { selectHideCreateAgent } from '@/store/selectors';

import { fetchAgentLauncherState, type AgentLauncherState } from '../../lib/launcher-publish';

export const launcherQueryKey = (agentId: string) => ['create-agent', 'launcher', agentId];

export interface AgentLauncherAccess {
    isAllowed: boolean;
    state?: AgentLauncherState;
    /** For the settings panel, which must not seed its form from a five-minute-old row. */
    refresh: () => Promise<unknown>;
}

/**
 * Called once by the builder topbar, which outlives the overflow menu the control lives in. Held
 * there on purpose: the menu item unmounts every time the menu closes, and as the query's only
 * observer it would let the entry be evicted, so a reopen would refetch and briefly render a
 * published agent as unpublished — inserting the row late and shifting the items under the cursor.
 */
export const useAgentLauncher = (agentId: string | undefined): AgentLauncherAccess => {
    const { canAccessible } = usePermissions();
    const hideCreateAgent = useAppSelector(selectHideCreateAgent);

    // `POST /launchers` is admin/owner only in the API, so the control is hidden rather than
    // disabled: nobody can trigger a 403 they had no way to foresee.
    const isAllowed = canAccessible('launchers', 'post') && !hideCreateAgent;

    const query = useQuery({
        queryKey: launcherQueryKey(agentId ?? ''),
        queryFn: () => fetchAgentLauncherState(agentId ?? ''),
        enabled: isAllowed && Boolean(agentId),
        // `GET /agents/:id` is the builder's heaviest endpoint (the full ACL-flag path plus every
        // capability join); four launcher fields do not justify refetching it on every tab focus.
        staleTime: 5 * 60 * 1000,
        // Above `staleTime` deliberately. Left at the 5-minute default they cancel out: the entry
        // is evicted exactly as it goes stale, so the read this control is trying to avoid happens
        // anyway on the next builder interaction.
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    return { isAllowed, state: query.data, refresh: query.refetch };
};

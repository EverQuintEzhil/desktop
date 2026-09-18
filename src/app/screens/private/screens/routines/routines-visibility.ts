import { useAppSelector, usePermissions } from '@/hooks';
import { type LauncherVisibilityDraft, toLauncherVisibilityDraft } from '@/lib/tenant/launcher-visibility';
import { selectTenant } from '@/store/selectors';
import type { LauncherVisibility, Role } from '@/types/store';
import type { AgentUiType, UiRoutinesConfigType } from '@/types/ui';

/**
 * Stored ui configs carry non-canonical spellings, so every surface guard in the repo normalises before
 * comparing — see `hasChatUi` in `types/ui.ts`. A strict compare here would route an agent to the chat
 * screens and still hide its routines.
 */
export const isChatSurface = (componentType?: string | null): boolean =>
    (componentType ?? '').trim().toLowerCase() === 'chat';

/** An agent naming no surface at all is unknown rather than non-chat, and is judged by the caller. */
export const isKnownNonChatSurface = (componentType?: string | null): boolean =>
    Boolean((componentType ?? '').trim()) && !isChatSurface(componentType);

/** Routines are a chat-agent feature: gallery, api and app agents have no schedule to attach work to. */
const hasChatSurface = (uiConfig?: AgentUiType | null): boolean => isChatSurface(uiConfig?.componentType);

/** Reads the routines block off any agent ui config. `api` agents have no routines surface and no block. */
const readAgentRoutinesConfig = (uiConfig?: AgentUiType | null): UiRoutinesConfigType | undefined =>
    uiConfig && 'routines' in uiConfig ? uiConfig.routines : undefined;

/**
 * An unknown role is denied whenever a role list is present: routines run unattended work on a
 * schedule, so they take the deny-by-default stance that `isHiddenForRole` deliberately does not.
 */
const allowsRole = (visibility: LauncherVisibilityDraft, role: Role): boolean => {
    if (visibility.hidden) return false;
    if (!visibility.visibleToRoles) return true;
    if (!role) return false;

    return visibility.visibleToRoles.includes(role);
};

/**
 * Whether Routines may be shown for an agent. Chat is the only surface that has them; beyond that the
 * tenant-wide `hide-routines` About setting and the agent's own `routines` block are independent:
 * either one hiding is enough. An absent tenant value
 * hides, unlike every other `hide-*` key — see `tenant-state.ts` for why.
 */
export const areRoutinesVisibleTo = (
    uiConfig: AgentUiType | null | undefined,
    role: Role,
    tenantHideRoutines: LauncherVisibility | undefined,
): boolean =>
    hasChatSurface(uiConfig) &&
    allowsRole(toLauncherVisibilityDraft(tenantHideRoutines), role) &&
    readAgentRoutinesConfig(uiConfig)?.enabled !== false;

export const useCanSeeRoutines = (uiConfig?: AgentUiType | null): boolean => {
    const { userRole } = usePermissions();
    const { hideRoutines } = useAppSelector(selectTenant);

    return areRoutinesVisibleTo(uiConfig, userRole, hideRoutines);
};

import { useAppSelector, usePermissions } from '@/hooks';
import { toLauncherVisibilityDraft } from '@/lib/tenant/launcher-visibility';
import { selectTenant } from '@/store/selectors';
import type { LauncherVisibility, Role } from '@/types/store';
import type { AgentUiType, UiUsageConfigType } from '@/types/ui';

/** Reads the usage block off any agent ui config. `api` agents have no usage surface and no block. */
export const readAgentUsageConfig = (uiConfig?: AgentUiType | null): UiUsageConfigType | undefined =>
    uiConfig && 'usage' in uiConfig ? uiConfig.usage : undefined;

/**
 * Absent config means visible, so an agent nobody has configured behaves exactly as before. An
 * unknown role is denied whenever a role list is present: usage discloses cost data, so it takes
 * the deny-by-default stance that `isHiddenForRole` deliberately does not.
 */
const allowsRole = (usage: UiUsageConfigType | undefined, role: Role): boolean => {
    if (usage?.hidden) return false;
    if (!usage?.visibleToRoles) return true;
    if (!role) return false;

    return usage.visibleToRoles.includes(role);
};

/**
 * Whether AI usage figures (tokens, cost, CO₂) may be shown. The tenant-wide `hide-ai-usage` About
 * setting and the agent's own `usage` block are independent: either one hiding is enough.
 */
export const isUsageVisibleTo = (
    usage: UiUsageConfigType | undefined,
    role: Role,
    tenantHideAiUsage?: LauncherVisibility,
): boolean => allowsRole(toLauncherVisibilityDraft(tenantHideAiUsage), role) && allowsRole(usage, role);

export const useCanSeeUsage = (uiConfig?: AgentUiType | null): boolean => {
    const { userRole } = usePermissions();
    const { hideAiUsage } = useAppSelector(selectTenant);

    return isUsageVisibleTo(readAgentUsageConfig(uiConfig), userRole, hideAiUsage);
};

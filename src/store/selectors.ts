import { isHiddenForRole } from '@/lib/tenant/launcher-visibility';
import type { RootState, TenantType } from '@/types/store';

export const selectUser = (state: RootState) => state.user;
export const selectTenant = (state: RootState): TenantType => state.tenant;
export const selectHeader = (state: RootState) => state.header;

type LauncherHideKey =
    | 'hideSearchBar'
    | 'hideWhatsNew'
    | 'hideCreateAgent'
    | 'hideScopeSwitch'
    | 'hideCategoryFilter'
    | 'hideSearchInput'
    | 'hideDocumentationLinks'
    | 'hideRoutines';

const selectIsHiddenForMe = (state: RootState, key: LauncherHideKey): boolean =>
    isHiddenForRole(state.tenant[key], state.user.role);

export const selectHideSearchBar = (state: RootState) => selectIsHiddenForMe(state, 'hideSearchBar');
export const selectHideWhatsNew = (state: RootState) => selectIsHiddenForMe(state, 'hideWhatsNew');
export const selectHideCreateAgent = (state: RootState) => selectIsHiddenForMe(state, 'hideCreateAgent');
export const selectHideScopeSwitch = (state: RootState) => selectIsHiddenForMe(state, 'hideScopeSwitch');
export const selectHideCategoryFilter = (state: RootState) => selectIsHiddenForMe(state, 'hideCategoryFilter');
export const selectHideSearchInput = (state: RootState) => selectIsHiddenForMe(state, 'hideSearchInput');
export const selectHideDocumentationLinks = (state: RootState) => selectIsHiddenForMe(state, 'hideDocumentationLinks');
export const selectHideRoutines = (state: RootState) => selectIsHiddenForMe(state, 'hideRoutines');

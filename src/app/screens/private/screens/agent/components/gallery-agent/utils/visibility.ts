import type { GalleryAgentType } from '@/types/admin';

import type { GalleryTab } from '../hooks/use-gallery-media-state';

/**
 * Default for whether the end user is allowed to change the public/private
 * visibility of an item, per tab. Used when the agent's uiConfig does not
 * define `canUserChangeVisibilityByTab`.
 */
export const DEFAULT_CAN_USER_CHANGE_VISIBILITY: Record<GalleryTab, boolean> = {
    my: true,
    fav: true,
    firmwide: false,
};

/**
 * Whether the user can toggle the public/private state for the given tab,
 * driven by the agent's `canUserChangeVisibilityByTab` uiConfig, falling back
 * to the per-tab default when the config is not set.
 */
export const canUserChangeVisibility = (agent: GalleryAgentType, tab: GalleryTab): boolean => {
    return agent.uiConfig?.canUserChangeVisibilityByTab?.[tab] ?? DEFAULT_CAN_USER_CHANGE_VISIBILITY[tab];
};

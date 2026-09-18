import { createContext, useContext } from 'react';

/**
 * Optional mount target for body-portaled overlays (dialog/sheet/alert-dialog).
 *
 * The app never provides it, so portals keep their default document.body
 * target. The chat SDK provides a body-appended `.fm-chat` element: its
 * published stylesheet scopes every rule under `.fm-chat`, so overlays
 * portaled straight to <body> would lose all styles and tokens in a host
 * page.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export const usePortalContainer = () => useContext(PortalContainerContext);

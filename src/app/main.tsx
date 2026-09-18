import { createRoot } from 'react-dom/client';

import '../index.css';
import '@/styles/sidebar-shared.scss';

import './userback-overrides.css';

import { setSurface } from '@/lib/auth/surface';
import { assertSingleReact, installHostImportMap } from '@/lib/genui/host-import-map';

import App from './app';

setSurface('app');

// Resolve GenUI app bundles' externalized React to the host singleton (spec §12/§16).
installHostImportMap();
assertSingleReact();

// Chromium only shows background-originated notifications via the SW; register it up front.
if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/notification-sw.js').catch(() => {});
}

createRoot(document.getElementById('app')!).render(<App />);

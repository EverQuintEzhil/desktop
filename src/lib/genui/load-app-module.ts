/**
 * Loads a remote GenUI app bundle and returns its default-exported React
 * component (spec §9.3, §12).
 *
 * The bundle is fetched once per `refName@version` and cached, so re-renders of
 * the same widget (and re-opening a pinned conversation) never re-fetch. React
 * externals inside the bundle resolve through the host import map (see
 * `host-import-map.ts`), guaranteeing a single React instance.
 */

import type { GenUIApp } from '@thefluentmind/genui-sdk';

type RemoteAppModule = { default: GenUIApp };

const moduleCache = new Map<string, Promise<GenUIApp>>();

const cacheKey = (refName: string, version: string): string => `${refName}@${version}`;

async function importBundle(bundleUrl: string): Promise<GenUIApp> {
    /* @vite-ignore — the URL is authoritative, supplied by `ai` in the data-genui part. */
    const mod = (await import(/* @vite-ignore */ bundleUrl)) as Partial<RemoteAppModule>;
    const component = mod.default;

    if (typeof component !== 'function') {
        throw new Error(`GenUI bundle at ${bundleUrl} has no default-exported component.`);
    }

    return component;
}

/**
 * Resolves (and caches) the app component for a given bundle. Keyed by
 * `refName@version` so an immutable published version is loaded at most once.
 */
export function loadAppModule(refName: string, version: string, bundleUrl: string): Promise<GenUIApp> {
    const key = cacheKey(refName, version);
    const cached = moduleCache.get(key);

    if (cached) return cached;

    const pending = importBundle(bundleUrl).catch((error) => {
        // Drop the rejected promise so a later render can retry.
        moduleCache.delete(key);
        throw error;
    });

    moduleCache.set(key, pending);

    return pending;
}

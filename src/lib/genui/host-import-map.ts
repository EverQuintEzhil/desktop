/**
 * Host import map for GenUI app bundles.
 *
 * Remote app bundles (`assets.{fqdn}/apps/{refName}/{version}/index.js`) are
 * built with React/react-dom EXTERNALIZED, so they ship bare
 * `import ... from "react"` specifiers. When the host `import(bundleUrl)`s such
 * a bundle, those bare specifiers must resolve to the host's ALREADY-LOADED
 * React — otherwise the bundle would pull a second React copy and break hooks.
 *
 * We resolve them by registering an import map whose `react` / `react-dom` /
 * JSX-runtime / SDK host module entries point at blob modules that simply
 * re-export the host's live singleton modules (the SDK host module holds the
 * `RemoteAppHostContext` React context, so it must be the host's copy). The
 * design system is mapped the same way so app bundles resolve
 * `@thefluentmind/design-system` to the host's already-loaded singleton.
 *
 * The map is injected once, before any app bundle is imported. Browsers honor
 * an injected `<script type="importmap">` as long as no module resolution has
 * consumed the mapped specifiers yet; app bundles are only imported on demand,
 * well after bootstrap, so this holds.
 */

import * as hostGenuiSdkHost from '@thefluentmind/genui-sdk/host';
import * as hostReact from 'react';
import * as hostReactDom from 'react-dom';
import * as hostReactDomClient from 'react-dom/client';
import * as hostJsxRuntime from 'react/jsx-runtime';

import * as hostDesignSystem from '@/components/ui/design-system';

type ModuleNamespace = Record<string, unknown>;

let injected = false;

/**
 * Builds a blob-URL ES module that re-exports every key of a host module
 * namespace (including `default`). A remote bundle that does
 * `import React from "react"` or `import { useState } from "react"` therefore
 * receives the exact host instance.
 */
function createReExportModule(namespace: ModuleNamespace): string {
    const globalKey = `__genuiHostModule_${Math.random().toString(36).slice(2)}__`;

    (window as unknown as Record<string, unknown>)[globalKey] = namespace;

    const names = Object.keys(namespace).filter((name) => name !== 'default' && name !== 'module.exports');
    const source = [
        `const ns = window[${JSON.stringify(globalKey)}];`,
        'export default ns.default ?? ns;',
        ...names.map((name) => `export const ${name} = ns[${JSON.stringify(name)}];`),
    ].join('\n');

    return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

function importMapsSupported(): boolean {
    return (
        typeof HTMLScriptElement !== 'undefined' &&
        typeof HTMLScriptElement.supports === 'function' &&
        HTMLScriptElement.supports('importmap')
    );
}

/**
 * Registers the host import map so subsequent `import(bundleUrl)` calls resolve
 * `react`/`react-dom` to the host singletons. Idempotent and safe to call from
 * app bootstrap. No-op (with a warning) on browsers without import-map support.
 */
export function installHostImportMap(): void {
    if (injected || typeof document === 'undefined') return;

    injected = true;

    if (!importMapsSupported()) {
        console.error('[genui] Import maps unsupported; GenUI app bundles cannot resolve React externals.');

        return;
    }

    const imports: Record<string, string> = {
        react: createReExportModule(hostReact as ModuleNamespace),
        'react-dom': createReExportModule(hostReactDom as ModuleNamespace),
        'react-dom/client': createReExportModule(hostReactDomClient as ModuleNamespace),
        'react/jsx-runtime': createReExportModule(hostJsxRuntime as ModuleNamespace),
        'react/jsx-dev-runtime': createReExportModule(hostJsxRuntime as ModuleNamespace),
        '@thefluentmind/design-system': createReExportModule(hostDesignSystem as ModuleNamespace),
        '@thefluentmind/genui-sdk/host': createReExportModule(hostGenuiSdkHost as ModuleNamespace),
    };

    const script = document.createElement('script');

    script.type = 'importmap';
    script.textContent = JSON.stringify({ imports });

    const firstModuleScript = document.querySelector('script[type="module"]');

    if (firstModuleScript?.parentNode) {
        firstModuleScript.parentNode.insertBefore(script, firstModuleScript);
    } else {
        document.head.appendChild(script);
    }
}

/**
 * Dev-only sanity check: asserts the host is running a single React instance.
 * The remote bundle, once loaded, shares this same object via the import map.
 */
export function assertSingleReact(): void {
    const globalScope = window as unknown as Record<string, unknown>;
    const existing = globalScope.__genuiHostReact__;

    if (existing && existing !== hostReact) {
        console.error('[genui] Multiple React instances detected — hooks in app bundles will break.');
    }

    globalScope.__genuiHostReact__ = hostReact;
}

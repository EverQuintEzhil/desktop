/**
 * Agent tools can steer the app pane: any tool output carrying
 * `app_navigate: { hash: "#/…" }` in the finished turn routes the app
 * (hash-routed GenUI bundles listen for hashchange). The LAST directive in
 * the turn wins. E.g. Scout's `scout_open_in_app` opens a pursuit record the
 * user asked the assistant for.
 */
export type AppNavigate = { hash: string; prefill?: Record<string, unknown> };

// Only the scout bundle listens on these names — any other app agent gets
// navigation but no prefill until the key is carried on the agent record.
export const FORM_PREFILL_KEY = 'scout-app.form.prefill';
const FORM_PREFILL_EVENT = 'scout:form-prefill';

export const findAppNavigate = (message: unknown): AppNavigate | null => {
    const parts = (message as { parts?: unknown[] } | null | undefined)?.parts;

    if (!Array.isArray(parts)) return null;

    let found: AppNavigate | null = null;

    for (const part of parts) {
        const candidate = part as { type?: unknown; state?: unknown; output?: unknown };
        const type = typeof candidate.type === 'string' ? candidate.type : '';

        if (type !== 'dynamic-tool' && !type.startsWith('tool-')) continue;

        if (candidate.state !== 'output-available') continue;

        const nav = (candidate.output as { app_navigate?: { hash?: unknown; prefill?: unknown } } | null | undefined)
            ?.app_navigate;

        if (nav && typeof nav.hash === 'string' && nav.hash.startsWith('#/')) {
            const prefill =
                nav.prefill && typeof nav.prefill === 'object' && !Array.isArray(nav.prefill)
                    ? (nav.prefill as Record<string, unknown>)
                    : undefined;

            found = { hash: nav.hash, prefill };
        }
    }

    return found;
};

// The destination bundle keeps only non-empty string values, so scalars are
// stringified here and nested values dropped rather than silently ignored there.
const toPrefillStrings = (prefill: Record<string, unknown>): Record<string, string> =>
    Object.entries(prefill).reduce<Record<string, string>>((values, [key, value]) => {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return values;

        const text = String(value);

        if (text.trim().length === 0) return values;

        return { ...values, [key]: text };
    }, {});

export const applyAppNavigate = (nav: AppNavigate): void => {
    const prefill = nav.prefill ? toPrefillStrings(nav.prefill) : {};

    if (Object.keys(prefill).length > 0) {
        try {
            sessionStorage.setItem(FORM_PREFILL_KEY, JSON.stringify(prefill));
        } catch {
            // Best-effort — form still opens even if storage is blocked.
        }
        window.dispatchEvent(new Event(FORM_PREFILL_EVENT));
    }

    let hash = nav.hash;

    // Already on the create form: bump the query so hashchange fires and the
    // page picks up the new prefill.
    if (hash.split('?')[0] === '#/new' && window.location.hash.split('?')[0] === '#/new') {
        hash = `#/new?p=${Date.now()}`;
    }

    if (window.location.hash !== hash) window.location.hash = hash;
};

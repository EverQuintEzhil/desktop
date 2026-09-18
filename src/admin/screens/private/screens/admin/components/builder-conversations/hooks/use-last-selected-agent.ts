import { useLayoutEffect, useEffect, useRef } from 'react';

import { BUILDER_CONVERSATIONS_AGENT_STORAGE_KEY } from '../constants';

interface Options {
    /** From the URL. Empty when the screen is showing the chooser. */
    agentSlug: string;
    /**
     * The slug the server confirmed, which is what gets stored. `getBySlugOrId` also accepts
     * an id, so this normalises an id-shaped URL to a slug — and storing only what resolved
     * keeps a mistyped URL from evicting a good remembered agent.
     */
    resolvedSlug: string | null;
    /** Failure from the agent query, if any. */
    error: unknown;
    onRestore: (slug: string) => void;
}

/**
 * Only a genuinely missing agent may evict the memory. Clearing on any failure would let a
 * 500 or a dropped connection silently forget the user's agent, which is both invisible and
 * recurring. The API reports not-found either as a 404 or as a `success: false` envelope
 * carrying "There is no such ...", so both are checked — same shape as `agent-binary` and
 * `project-detail`.
 */
const isAgentGoneError = (error: unknown): boolean => {
    const err = error as Error & { response?: { status?: number; data?: { message?: string } } };

    if (!err) return false;
    if (err.response?.status === 404) return true;

    return err.response?.data?.message?.includes('There is no such agent') ?? false;
};

const readLastSelectedAgent = (): string | null => localStorage.getItem(BUILDER_CONVERSATIONS_AGENT_STORAGE_KEY);

/**
 * Forgets the remembered agent, so returning to the chooser survives a reload instead of
 * being undone by the next restore.
 */
export const clearLastSelectedAgent = () => {
    localStorage.removeItem(BUILDER_CONVERSATIONS_AGENT_STORAGE_KEY);
};

/**
 * Remembers the agent across visits, the way the table screens remember their params.
 * The URL stays authoritative — the agent is a path segment — and storage only supplies
 * a starting point when the screen is entered without one. Only the identifying slug is
 * stored: the open conversation and the agent's display name both stay out of it, the
 * first because it should not survive a visit, the second because it is server state that
 * would go stale.
 */
export const useLastSelectedAgent = (options: Options) => {
    const { agentSlug, resolvedSlug, error, onRestore } = options;
    const hasRestoredRef = useRef(false);

    // Restore on arrival only. Leaving the agent later in the session — the breadcrumb back
    // to the chooser — must not bounce the user straight into the stored agent again.
    //
    // Layout effect, not passive: a passive one runs after paint, so the chooser would flash
    // on screen for a frame before the redirect replaced it.
    useLayoutEffect(() => {
        if (hasRestoredRef.current) return;
        hasRestoredRef.current = true;

        if (agentSlug) return;

        const stored = readLastSelectedAgent();

        if (stored) onRestore(stored);
    }, [agentSlug, onRestore]);

    useEffect(() => {
        if (resolvedSlug) localStorage.setItem(BUILDER_CONVERSATIONS_AGENT_STORAGE_KEY, resolvedSlug);
    }, [resolvedSlug]);

    // A remembered agent that is later deleted would otherwise send every future visit
    // straight back into a dead slug, with no way out but editing the URL.
    //
    // Scoped to the remembered agent: browsing to some *other* dead agent must not evict a
    // memory that is still good. The restore-a-deleted-agent case still clears, because the
    // slug it navigated to is by definition the stored one.
    useEffect(() => {
        if (!isAgentGoneError(error)) return;
        if (readLastSelectedAgent() !== agentSlug) return;

        clearLastSelectedAgent();
    }, [error, agentSlug]);
};

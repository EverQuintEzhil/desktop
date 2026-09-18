import { useEffect, useRef } from 'react';
import { useInRouterContext, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import type { ArtifactPointer } from './artifact-types';
import { ARTIFACT_SEARCH_PARAM } from './artifact-url';

interface Props {
    conversationId: string | null;
    openSlug: string | null;
    /** Changes whenever the thread's messages do, so a slug that could not be resolved yet is retried. */
    resolveKey: string;
    resolveSlug: (slug: string) => ArtifactPointer | null;
    onOpen: (pointer: ArtifactPointer) => void;
    onClose: () => void;
}

/** Marks the history entry the pane pushed, so closing can pop it instead of stacking a new one. */
interface ArtifactLocationState {
    artifactPane?: boolean;
}

const ArtifactUrlSyncInner = ({ conversationId, openSlug, resolveKey, resolveSlug, onOpen, onClose }: Props) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const param = searchParams.get(ARTIFACT_SEARCH_PARAM);

    const lastSyncRef = useRef({ param, openSlug });
    const conversationIdRef = useRef(conversationId);
    const locationRef = useRef(location);
    const searchParamsRef = useRef(searchParams);
    const resolveSlugRef = useRef(resolveSlug);
    const onOpenRef = useRef(onOpen);
    const onCloseRef = useRef(onClose);

    locationRef.current = location;
    searchParamsRef.current = searchParams;
    resolveSlugRef.current = resolveSlug;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;

    // The callbacks are read through refs so this effect re-runs only when one of the four values
    // it reconciles moves — an extra run mid-write would read the URL as if it had changed.
    useEffect(() => {
        const previous = lastSyncRef.current;
        const previousConversationId = conversationIdRef.current;

        conversationIdRef.current = conversationId;

        // A new conversation mints its id mid-turn: writing a param would attach the pane to a URL
        // about to be replaced, and reading one would close a pane opened during that same turn.
        if (!conversationId || conversationId !== previousConversationId) return;

        lastSyncRef.current = { param, openSlug };

        if (param === openSlug) return;

        if (openSlug === previous.openSlug) {
            if (!param) {
                onCloseRef.current();

                return;
            }

            const pointer = resolveSlugRef.current(param);

            // The message may not be loaded, or the link may be stale; leave the URL for a later retry.
            if (!pointer) return;

            onOpenRef.current(pointer);

            return;
        }

        const params = new URLSearchParams(searchParamsRef.current);
        const pushedByUs = Boolean((locationRef.current.state as ArtifactLocationState | null)?.artifactPane);
        const buildUrl = () => {
            const search = params.toString();

            return search ? `${locationRef.current.pathname}?${search}` : locationRef.current.pathname;
        };

        if (!openSlug) {
            if (pushedByUs) {
                navigate(-1);

                return;
            }

            params.delete(ARTIFACT_SEARCH_PARAM);
            navigate(buildUrl(), { replace: true });

            return;
        }

        params.set(ARTIFACT_SEARCH_PARAM, openSlug);
        // Opening is a new history entry so Back closes the pane; swapping the artifact shown replaces
        // it, keeping one entry for the whole pane session.
        navigate(buildUrl(), {
            replace: pushedByUs,
            state: { artifactPane: true } satisfies ArtifactLocationState,
        });
    }, [param, openSlug, conversationId, resolveKey, navigate]);

    return null;
};

const ArtifactUrlSync = (props: Props) => {
    if (!useInRouterContext()) return null;

    return <ArtifactUrlSyncInner {...props} />;
};

export default ArtifactUrlSync;

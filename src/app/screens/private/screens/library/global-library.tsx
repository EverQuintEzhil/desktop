import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAppSelector } from '@/app/hooks';
import LibraryContent, {
    type PreviewIntent,
} from '@/app/screens/private/screens/agent/components/chat-agent/components/library/library-content';
import { type LibraryScope, normalizeScope } from '@/components/agent-chat/hooks/use-media-library';
import { selectUser } from '@/store/selectors';

interface Props {
    basePath: string;
    contentClassName?: string;
    scrollMode?: 'window' | 'container';
}

/** Marks the history entry the preview pushed, so closing can pop it instead of stacking a new one. */
interface PreviewLocationState {
    libraryPreview?: boolean;
}

const GlobalLibrary = ({ basePath, contentClassName, scrollMode }: Props) => {
    const user = useAppSelector(selectUser);
    const userId = user._id || '';
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const scope = normalizeScope(searchParams.get('tab') ?? undefined);
    const previewId = searchParams.get('file');
    const requestedScopeRef = useRef<LibraryScope>(scope);

    // Re-arm the guard whenever the URL settles, so a Back to a tab can be re-selected by hand.
    useEffect(() => {
        requestedScopeRef.current = scope;
    }, [scope]);

    const buildUrl = (params: URLSearchParams) => {
        const search = params.toString();

        return search ? `${basePath}?${search}` : basePath;
    };

    const onScopeChange = (value: LibraryScope) => {
        // A tab click reaches us twice — once from mousedown, once from the focus that follows —
        // and `scope` still holds the old value on the second call because the URL round-trip has
        // not landed yet. Comparing against the last value we asked for is what dedupes it.
        if (value === requestedScopeRef.current) return;

        requestedScopeRef.current = value;

        const params = new URLSearchParams();

        if (value !== 'yours') params.set('tab', value);

        navigate(buildUrl(params));
    };

    const onPreviewChange = (id: string | null, intent: PreviewIntent) => {
        // The library itself is being left behind; the preview unmounts with it.
        if (intent === 'leave') return;
        if (id === previewId) return;

        const params = new URLSearchParams(searchParams);
        const pushedByUs = Boolean((location.state as PreviewLocationState | null)?.libraryPreview);

        if (id) {
            params.set('file', id);
            // Opening is a new history entry so Back closes the preview; stepping between files
            // replaces it, keeping one entry for the whole preview session.
            navigate(buildUrl(params), {
                replace: intent === 'step',
                state: { libraryPreview: true } satisfies PreviewLocationState,
            });

            return;
        }

        if (pushedByUs) {
            navigate(-1);

            return;
        }

        // Deep-linked straight into a preview: there is no entry of ours to pop.
        params.delete('file');
        navigate(buildUrl(params), { replace: true });
    };

    return (
        <LibraryContent
            agentId={undefined}
            userId={userId}
            title="Library"
            scope={scope}
            onScopeChange={onScopeChange}
            previewId={previewId}
            onPreviewChange={onPreviewChange}
            containerClassName={contentClassName}
            scrollMode={scrollMode}
            enableSelection
            showEntityFilters
            originTypes={['chat', 'gallery', 'project']}
        />
    );
};

export default GlobalLibrary;

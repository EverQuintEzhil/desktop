import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

import { MERMAID_CONFIG } from '../constants';
import { formatMermaidError, loadMermaid, removeMermaidTemporaryRenderNode } from '../utils';

interface UseMermaidRenderResult {
    svg: string;
    error: string;
    setError: (error: string) => void;
}

export const useMermaidRender = (
    diagramId: string,
    sanitizedChart: string,
    isStreaming: boolean,
    hasInitializedZoomRef: RefObject<boolean>,
): UseMermaidRenderResult => {
    const [svg, setSvg] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isStreaming) return;
        let isMounted = true;

        const renderDiagram = async () => {
            try {
                const mermaid = await loadMermaid();

                removeMermaidTemporaryRenderNode(diagramId);
                mermaid.initialize(MERMAID_CONFIG);

                const rendered = await mermaid.render(diagramId, sanitizedChart);

                removeMermaidTemporaryRenderNode(diagramId);
                if (isMounted) {
                    hasInitializedZoomRef.current = false;
                    setSvg(rendered.svg);
                    setError('');
                }
            } catch (renderError) {
                removeMermaidTemporaryRenderNode(diagramId);
                console.error('[Mermaid]', formatMermaidError(renderError));
                if (isMounted) {
                    hasInitializedZoomRef.current = false;
                    setSvg('');
                    setError('Invalid or unsupported diagram');
                }
            }
        };

        renderDiagram();

        return () => {
            isMounted = false;
            removeMermaidTemporaryRenderNode(diagramId);
        };
    }, [diagramId, isStreaming, sanitizedChart]);

    return { svg, error, setError };
};

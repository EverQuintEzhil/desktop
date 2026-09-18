import { useEffect, useId, useState } from 'react';

import { MERMAID_CONFIG } from '@/components/markdown/mermaid-diagram/constants';
import {
    formatMermaidError,
    loadMermaid,
    removeMermaidTemporaryRenderNode,
    sanitizeMermaidChart,
} from '@/components/markdown/mermaid-diagram/utils';
import { cn } from '@/lib/utils';

interface ArtifactMermaidProps {
    content: string;
    className?: string;
}

const RENDER_ERROR = 'This diagram could not be drawn. Switch to Source to read it.';

export const ArtifactMermaid = ({ content, className }: ArtifactMermaidProps) => {
    const diagramId = `artifact-mermaid-${useId().replace(/:/g, '')}`;
    const [svg, setSvg] = useState('');
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const chart = sanitizeMermaidChart(content);

        const draw = async () => {
            try {
                const mermaid = await loadMermaid();

                removeMermaidTemporaryRenderNode(diagramId);
                mermaid.initialize(MERMAID_CONFIG);

                const rendered = await mermaid.render(diagramId, chart);

                removeMermaidTemporaryRenderNode(diagramId);

                if (!isMounted) return;

                setSvg(rendered.svg);
                setHasError(false);
            } catch (error) {
                removeMermaidTemporaryRenderNode(diagramId);
                console.error('[Artifact mermaid]', formatMermaidError(error));

                if (!isMounted) return;

                setSvg('');
                setHasError(true);
            }
        };

        void draw();

        return () => {
            isMounted = false;
            removeMermaidTemporaryRenderNode(diagramId);
        };
    }, [content, diagramId]);

    if (hasError) {
        return (
            <div
                data-slot="artifact-mermaid"
                role="alert"
                className={cn('flex items-center justify-center bg-card p-6 text-sm text-muted-foreground', className)}
            >
                {RENDER_ERROR}
            </div>
        );
    }

    return (
        <div
            data-slot="artifact-mermaid"
            data-testid="artifact-mermaid"
            className={cn(
                'scrollbar-controller scrollbar-vertical scrollbar-horizontal flex justify-center bg-white p-4',
                '[&_svg]:h-auto [&_svg]:max-w-full',
                className,
            )}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

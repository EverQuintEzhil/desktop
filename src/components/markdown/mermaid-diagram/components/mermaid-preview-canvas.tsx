import type { ReactNode, RefObject } from 'react';

import { cn } from '@/lib/utils';

interface MermaidPreviewCanvasProps {
    containerRef: RefObject<HTMLDivElement | null>;
    scrollAreaRef: RefObject<HTMLDivElement | null>;
    isFullscreen: boolean;
    isPannable: boolean;
    isPanning: boolean;
    scrollAreaStyle: { height: string } | undefined;
    spacerStyle: { width: number; height: number } | undefined;
    previewTransformStyle: { transform: string; transformOrigin: 'top left' };
    baseSvg: string;
    heading: ReactNode;
    toolbar: ReactNode;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
}

const MermaidPreviewCanvas: React.FC<MermaidPreviewCanvasProps> = ({
    containerRef,
    scrollAreaRef,
    isFullscreen,
    isPannable,
    isPanning,
    scrollAreaStyle,
    spacerStyle,
    previewTransformStyle,
    baseSvg,
    heading,
    toolbar,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
}) => (
    <div
        ref={containerRef}
        className={cn(
            'mermaid-diagram flow-chart',
            isFullscreen && 'is-fullscreen',
            isPannable && 'is-pannable',
            isPanning && 'is-panning',
        )}
    >
        {heading}
        {toolbar}
        <div
            ref={scrollAreaRef}
            className="mermaid-scroll-area"
            style={scrollAreaStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
        >
            <div className="mermaid-preview-spacer" style={spacerStyle}>
                <div
                    className="mermaid-preview"
                    aria-label="Mermaid diagram"
                    style={previewTransformStyle}
                    dangerouslySetInnerHTML={{ __html: baseSvg }}
                />
            </div>
        </div>
    </div>
);

export default MermaidPreviewCanvas;

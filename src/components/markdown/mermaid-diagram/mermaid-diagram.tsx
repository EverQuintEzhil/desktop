import { useId, useMemo, useRef, useState } from 'react';

import MermaidCodeView from './components/mermaid-code-view';
import MermaidErrorView from './components/mermaid-error-view';
import MermaidHeading from './components/mermaid-heading';
import MermaidLoadingView from './components/mermaid-loading-view';
import MermaidPreviewCanvas from './components/mermaid-preview-canvas';
import MermaidToolbar from './components/mermaid-toolbar';
import { useMermaidRender, useMermaidSvgTransform, useMermaidZoomPan } from './hooks';
import type { MermaidViewMode } from './types';
import { downloadPng, formatMermaidError, sanitizeMermaidChart } from './utils';
import './mermaid-diagram.scss';

export interface MermaidDiagramProps {
    chart: string;
    isStreaming?: boolean;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, isStreaming = false }) => {
    const sanitizedChart = useMemo(() => sanitizeMermaidChart(chart), [chart]);
    const reactId = useId();
    const diagramId = useMemo(() => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [reactId]);
    const [viewMode, setViewMode] = useState<MermaidViewMode>('preview');
    const [isDownloading, setIsDownloading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const hasInitializedZoomRef = useRef(false);

    const { svg, error, setError } = useMermaidRender(diagramId, sanitizedChart, isStreaming, hasInitializedZoomRef);
    const { naturalDims, baseSvg } = useMermaidSvgTransform(svg);
    const {
        zoom,
        fitZoom,
        isFullscreen,
        isPanning,
        isPannable,
        onZoomIn,
        onZoomOut,
        onResetZoom,
        onToggleFullscreen,
        onPointerDown,
        onPointerMove,
        onPointerEnd,
    } = useMermaidZoomPan(svg, naturalDims, viewMode, scrollAreaRef, hasInitializedZoomRef);

    const onDownloadPng = async () => {
        if (!svg || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadPng(svg);
        } catch (downloadError) {
            setError(formatMermaidError(downloadError));
            setViewMode('preview');
        } finally {
            setIsDownloading(false);
        }
    };

    const renderToolbar = () => (
        <MermaidToolbar
            viewMode={viewMode}
            onSetViewMode={setViewMode}
            svg={svg}
            zoom={zoom}
            fitZoom={fitZoom}
            isFullscreen={isFullscreen}
            isDownloading={isDownloading}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onResetZoom={onResetZoom}
            onToggleFullscreen={onToggleFullscreen}
            onDownloadPng={onDownloadPng}
        />
    );

    if (isStreaming) {
        return <MermaidLoadingView />;
    }

    if (viewMode === 'code') {
        return (
            <div className="mermaid-diagram">
                <MermaidHeading />
                {renderToolbar()}
                <MermaidCodeView sanitizedChart={sanitizedChart} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="mermaid-diagram is-error" role="alert">
                <MermaidHeading />
                {renderToolbar()}
                <MermaidErrorView error={error} />
            </div>
        );
    }

    // Lock the scroll area to the diagram's height at fit zoom so zooming
    // only causes scrolling within a fixed-height box, not page-layout shift.
    const lockedHeight = !isFullscreen && naturalDims ? Math.round(naturalDims.height * fitZoom) : null;
    const scrollAreaStyle = lockedHeight !== null ? { height: `${lockedHeight}px` } : undefined;
    // Spacer drives the scrollable canvas dimensions; CSS transform scales the SVG
    // visually without re-serializing it on every zoom step.
    const spacerStyle = naturalDims
        ? { width: Math.round(naturalDims.width * zoom), height: Math.round(naturalDims.height * zoom) }
        : undefined;
    const previewTransformStyle = { transform: `scale(${zoom})`, transformOrigin: 'top left' as const };

    return (
        <MermaidPreviewCanvas
            containerRef={containerRef}
            scrollAreaRef={scrollAreaRef}
            isFullscreen={isFullscreen}
            isPannable={isPannable}
            isPanning={isPanning}
            scrollAreaStyle={scrollAreaStyle}
            spacerStyle={spacerStyle}
            previewTransformStyle={previewTransformStyle}
            baseSvg={baseSvg}
            heading={<MermaidHeading />}
            toolbar={renderToolbar()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerEnd={onPointerEnd}
        />
    );
};

export default MermaidDiagram;

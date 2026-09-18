import {
    CodeIcon,
    DownloadIcon,
    Maximize2Icon,
    MaximizeIcon,
    Minimize2Icon,
    PlayIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { SimpleTooltip } from '../../../ui/simple-tooltip';
import { ZOOM_MAX, ZOOM_MIN } from '../constants';
import type { MermaidViewMode } from '../types';

interface MermaidToolbarProps {
    viewMode: MermaidViewMode;
    onSetViewMode: (mode: MermaidViewMode) => void;
    svg: string;
    zoom: number;
    fitZoom: number;
    isFullscreen: boolean;
    isDownloading: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onToggleFullscreen: () => void;
    onDownloadPng: () => void;
}

const MermaidToolbar: React.FC<MermaidToolbarProps> = ({
    viewMode,
    onSetViewMode,
    svg,
    zoom,
    fitZoom,
    isFullscreen,
    isDownloading,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onToggleFullscreen,
    onDownloadPng,
}) => {
    const renderZoomControls = () => {
        if (viewMode !== 'preview' || !svg) return null;

        return (
            <div className="mermaid-zoom-controls" role="group" aria-label="Zoom controls">
                <SimpleTooltip content="Reset zoom" side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mermaid-icon-button"
                        aria-label="Reset zoom"
                        disabled={zoom === fitZoom}
                        onClick={onResetZoom}
                    >
                        <MaximizeIcon />
                    </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Zoom out" side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mermaid-icon-button"
                        aria-label="Zoom out"
                        disabled={zoom <= ZOOM_MIN}
                        onClick={onZoomOut}
                    >
                        <ZoomOutIcon />
                    </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Zoom in" side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mermaid-icon-button"
                        aria-label="Zoom in"
                        disabled={zoom >= ZOOM_MAX}
                        onClick={onZoomIn}
                    >
                        <ZoomInIcon />
                    </Button>
                </SimpleTooltip>
                <SimpleTooltip content={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mermaid-icon-button"
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        aria-pressed={isFullscreen}
                        onClick={onToggleFullscreen}
                    >
                        {isFullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
                    </Button>
                </SimpleTooltip>
            </div>
        );
    };

    return (
        <div className="mermaid-toolbar">
            {renderZoomControls()}
            <SimpleTooltip content="Download PNG" side="bottom">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mermaid-icon-button"
                    aria-label="Download PNG"
                    disabled={!svg || isDownloading}
                    onClick={onDownloadPng}
                >
                    <DownloadIcon />
                </Button>
            </SimpleTooltip>
            <div className="mermaid-view-switch" role="tablist" aria-label="Mermaid view">
                <SimpleTooltip content="Code" side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mermaid-switch-button"
                        aria-label="Code"
                        aria-selected={viewMode === 'code'}
                        role="tab"
                        onClick={() => onSetViewMode('code')}
                    >
                        <CodeIcon />
                    </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Preview" side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mermaid-switch-button"
                        aria-label="Preview"
                        aria-selected={viewMode === 'preview'}
                        role="tab"
                        onClick={() => onSetViewMode('preview')}
                    >
                        <PlayIcon />
                    </Button>
                </SimpleTooltip>
            </div>
        </div>
    );
};

export default MermaidToolbar;

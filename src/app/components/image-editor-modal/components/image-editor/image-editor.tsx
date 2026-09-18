import { useCallback, useRef, useState } from 'react';

import { EditorProvider, useEditorContext } from '../../context/editor-context';
import { useAdjustmentState, useExportImage, useFilterState, useUndoRedoHistory, useZoom } from '../../hooks';
import type { ActiveMode } from '../../types';
import { MAX_ZOOM, MIN_ZOOM } from '../../utils/zoom-utils';
import { Adjust } from '../adjust';
import Crop from '../crop';
import { EditorCanvas } from '../editor-canvas';
import { ErrorBoundary } from '../error-boundary';
import { Filter } from '../filter';
import { LeftRail } from '../left-rail';
import { SidePanel } from '../side-panel';
import { TopToolbar } from '../top-toolbar';

interface ImageEditorProps {
    safeImageUrl: string;
    imageName: string;
    onModalClose: () => void;
}

const ImageEditorContent = (props: ImageEditorProps) => {
    const { safeImageUrl, imageName, onModalClose } = props;
    const [activeMode, setActiveMode] = useState<ActiveMode>(null);
    const fitZoomLevelRef = useRef<number | null>(null);

    const { zoomState, updateZoomState } = useEditorContext();

    const { canUndo, canRedo, recordSnapshot, undo, redo } = useUndoRedoHistory();

    const { handleResetAdjustments, handleToggleAdjustments } = useAdjustmentState({ recordSnapshot });

    const {
        selectedFilterLabel,
        selectedLut,
        selectedDuotone,
        handleResetFilters,
        handleToggleFilter,
        handleSelectFilterId,
    } = useFilterState({ recordSnapshot });

    const { exporting, copying, handleExport, handleCopy, handleExportAs } = useExportImage({
        imageUrl: safeImageUrl,
        imageName,
        selectedLut,
        selectedDuotone,
    });

    const handleToggleMode = (mode: 'crop' | 'adjust' | 'filters') => {
        setActiveMode((prev) => (prev === mode ? null : mode));
    };

    const { handleZoomIn, handleZoomOut, handleZoomChange } = useZoom({
        zoomState,
        updateZoomState,
    });

    const handleAutoFit = useCallback(() => {
        const level = fitZoomLevelRef.current;

        if (level == null) return;

        updateZoomState({ level });
    }, [updateZoomState]);

    const handleFitZoomComputed = useCallback((level: number) => {
        fitZoomLevelRef.current = level;
    }, []);

    const renderPanelContent = () => {
        if (activeMode === 'crop') {
            return <Crop imageUrl={safeImageUrl} recordSnapshot={recordSnapshot} />;
        }

        if (activeMode === 'filters') {
            return (
                <Filter
                    imageUrl={safeImageUrl}
                    handleSelectFilterId={handleSelectFilterId}
                    recordSnapshot={recordSnapshot}
                />
            );
        }

        if (activeMode === 'adjust') {
            return <Adjust recordSnapshot={recordSnapshot} />;
        }

        return null;
    };

    return (
        <div className="top-toolbar-container image-editor flex h-full w-full flex-col">
            <TopToolbar
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onModalClose={onModalClose}
                onExport={handleExport}
                exporting={exporting}
                onCopy={handleCopy}
                copying={copying}
                onExportAs={handleExportAs}
                zoomLevel={zoomState.level}
                zoomPresets={[200, 100, 50]}
                canZoomIn={zoomState.level < MAX_ZOOM}
                canZoomOut={zoomState.level > MIN_ZOOM}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomChange={handleZoomChange}
                onAutoFit={handleAutoFit}
            />
            <div
                className={`workspace grid min-h-0 flex-1 gap-0 max-lg:flex max-lg:flex-col-reverse max-lg:justify-center ${activeMode ? 'with-panel' : 'no-panel'}`}
            >
                <LeftRail activeMode={activeMode} onToggleMode={handleToggleMode} />
                <SidePanel
                    activeMode={activeMode}
                    onClose={() => setActiveMode(null)}
                    selectedFilterLabel={selectedFilterLabel}
                    onResetFilters={handleResetFilters}
                    onToggleFilter={handleToggleFilter}
                    onResetAdjustments={handleResetAdjustments}
                    onToggleAdjustments={handleToggleAdjustments}
                >
                    {renderPanelContent()}
                </SidePanel>
                <ErrorBoundary>
                    <EditorCanvas
                        activeMode={activeMode}
                        safeImageUrl={safeImageUrl}
                        selectedLut={selectedLut}
                        selectedDuotone={selectedDuotone}
                        exporting={exporting}
                        recordSnapshot={recordSnapshot}
                        onDoneCrop={() => setActiveMode(null)}
                        zoomLevel={zoomState.level}
                        onZoomChange={handleZoomChange}
                        onFitZoomComputed={handleFitZoomComputed}
                    />
                </ErrorBoundary>
            </div>
        </div>
    );
};

const ImageEditor = (props: ImageEditorProps) => {
    return (
        <EditorProvider>
            <ImageEditorContent {...props} />
        </EditorProvider>
    );
};

export default ImageEditor;

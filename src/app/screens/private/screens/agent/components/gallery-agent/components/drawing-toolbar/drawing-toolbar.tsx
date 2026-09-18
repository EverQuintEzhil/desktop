import { useRef } from 'react';

import { cn } from '@/lib/utils';

import type { PenSize, ToolMode } from '../../hooks/use-mask-image';

import './drawing-toolbar.scss';

export interface DrawingToolbarProps {
    toolMode: ToolMode;
    setToolMode: (mode: ToolMode) => void;
    penColor: string;
    setPenColor: (color: string) => void;
    penSize: PenSize;
    setPenSize: (size: PenSize) => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onClear: () => void;
    containerWidth?: number;
    showBrush?: boolean;
}

const PEN_SIZE_LABELS: Record<PenSize, string> = {
    sm: 'S',
    md: 'M',
    lg: 'L',
};

const PEN_SIZES: PenSize[] = ['sm', 'md', 'lg'];

const BASE_WIDTH = 480;
const TOOLBAR_HEIGHT = 44;

const DrawingToolbar = (props: DrawingToolbarProps) => {
    const {
        toolMode,
        setToolMode,
        penColor,
        setPenColor,
        penSize,
        setPenSize,
        canUndo,
        canRedo,
        onUndo,
        onRedo,
        onClear,
        containerWidth,
        showBrush = false,
    } = props;

    const colorInputRef = useRef<HTMLInputElement | null>(null);

    const scaleFactor = containerWidth ? Math.min(1, Math.max(0.5, containerWidth / BASE_WIDTH)) : 1;

    return (
        <div
            className="drawing-toolbar-wrapper pointer-events-none flex w-full items-start justify-center overflow-visible"
            style={{ height: `${TOOLBAR_HEIGHT * scaleFactor}px` }}
        >
            <div
                className={cn(
                    'flex items-center gap-0.5',
                    'border border-[rgba(255,255,255,0.1)] bg-[rgba(18,18,18,0.92)]',
                    'rounded-3xl px-2 py-1 [backdrop-filter:blur(12px)]',
                    'box-border h-11 shrink-0 whitespace-nowrap',
                )}
                style={{ transform: `scale(${scaleFactor})`, transformOrigin: 'center top' }}
            >
                {/* Tool selector */}
                <div className="flex items-center gap-px">
                    {showBrush && (
                        <button
                            className={`drawing-toolbar-btn${toolMode === 'brush' ? ' is-active' : ''}`}
                            onClick={() => setToolMode('brush')}
                            title="Brush (mask area)"
                            type="button"
                        >
                            <BrushIcon />
                            Brush
                        </button>
                    )}
                    {!showBrush && (
                        <button
                            className={`drawing-toolbar-btn${toolMode === 'pen' ? ' is-active' : ''}`}
                            onClick={() => setToolMode('pen')}
                            title="Pen (draw)"
                            type="button"
                        >
                            <PenIcon />
                            Pen
                        </button>
                    )}
                </div>

                <div className="mx-[5px] h-5 w-px shrink-0 bg-[rgba(255,255,255,0.14)]" />

                {/* Size selector */}
                <div className="flex items-center gap-px">
                    {PEN_SIZES.map((size) => (
                        <button
                            key={size}
                            className={`drawing-toolbar-btn drawing-toolbar-btn--size${penSize === size ? ' is-active' : ''}`}
                            onClick={() => setPenSize(size)}
                            title={`Size: ${PEN_SIZE_LABELS[size]}`}
                            type="button"
                        >
                            {PEN_SIZE_LABELS[size]}
                        </button>
                    ))}
                </div>

                {/* Color picker — pen only */}
                {toolMode === 'pen' && (
                    <>
                        <div className="mx-[5px] h-5 w-px shrink-0 bg-[rgba(255,255,255,0.14)]" />
                        <div className="flex items-center gap-px">
                            <button
                                className="drawing-toolbar-btn drawing-toolbar-btn--color"
                                onClick={() => colorInputRef.current?.click()}
                                title="Pick color"
                                type="button"
                            >
                                <span className="drawing-toolbar-color-swatch" style={{ backgroundColor: penColor }} />
                            </button>
                            <input
                                ref={colorInputRef}
                                type="color"
                                value={penColor}
                                onChange={(e) => setPenColor(e.target.value)}
                                className="drawing-toolbar-color-input"
                                aria-label="Pen color"
                            />
                        </div>
                    </>
                )}

                <div className="mx-[5px] h-5 w-px shrink-0 bg-[rgba(255,255,255,0.14)]" />

                {/* Undo / Redo */}
                <div className="flex items-center gap-px">
                    <button
                        className="drawing-toolbar-btn drawing-toolbar-btn--icon"
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Undo"
                        type="button"
                    >
                        <UndoIcon />
                    </button>
                    <button
                        className="drawing-toolbar-btn drawing-toolbar-btn--icon"
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="Redo"
                        type="button"
                    >
                        <RedoIcon />
                    </button>
                </div>

                <div className="mx-[5px] h-5 w-px shrink-0 bg-[rgba(255,255,255,0.14)]" />

                {/* Clear */}
                <div className="flex items-center gap-px">
                    <button className="drawing-toolbar-btn" onClick={onClear} title="Clear all" type="button">
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
};

const BrushIcon = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.58a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
        <path d="M9 8c-2 3-4 3.5-7 4l8 8c1-.5 3.5-2 4-7" />
        <path d="M14.5 17.5 4.5 15" />
    </svg>
);

const PenIcon = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
);

const UndoIcon = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
);

const RedoIcon = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M21 7v6h-6" />
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
);

export default DrawingToolbar;

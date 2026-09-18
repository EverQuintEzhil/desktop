import {
    SquareCenterlineDashedHorizontalIcon,
    SquareCenterlineDashedVerticalIcon,
    RotateCcwIcon,
    RotateCwIcon,
} from 'lucide-react';
import { useCallback, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

import IntensityControl from '../intensity-control';

import './crop-sub-toolbar.scss';

export interface CropSubToolbarProps {
    activeMode: 'crop' | 'fit';
    onModeChange: (mode: 'crop' | 'fit') => void;
    flipX: boolean;
    flipY: boolean;
    straightenAngle: number;
    onStraightenStart: () => void;
    onStraightenChange: (value: number) => void;
    onRotate90: () => void;
    onToggleFlipX: () => void;
    onToggleFlipY: () => void;

    onResetCrop: () => void;
    onDone: () => void;

    exporting: boolean;
    downloading: boolean;
}

const CropSubToolbar = (props: CropSubToolbarProps) => {
    const {
        activeMode,
        onModeChange,
        straightenAngle,
        onStraightenStart,
        onStraightenChange,
        onRotate90,
        onToggleFlipX,
        onToggleFlipY,
        onResetCrop,
        onDone,
        exporting,
        downloading,
    } = props;

    const rafIdRef = useRef<number | null>(null);
    const pendingValueRef = useRef<number | null>(null);

    const throttledStraightenChange = useCallback(
        (value: number) => {
            pendingValueRef.current = value;

            if (rafIdRef.current === null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    if (pendingValueRef.current !== null) {
                        onStraightenChange(pendingValueRef.current);
                        pendingValueRef.current = null;
                    }
                    rafIdRef.current = null;
                });
            }
        },
        [onStraightenChange],
    );

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    const modeOptions: { value: 'crop' | 'fit'; label: string }[] = [
        { label: 'Crop', value: 'crop' },
        { label: 'Fit', value: 'fit' },
    ];

    return (
        <div
            className="crop-sub-toolbar editor-toolbar absolute inset-x-3 top-[14px] z-4 flex max-w-none items-center justify-between gap-3 overflow-hidden px-4 py-2"
            role="toolbar"
            aria-label="Crop tools"
        >
            <div className="crop-sub-toolbar-left flex items-center gap-3">
                <div className="flex items-center gap-3">
                    <Select<'crop' | 'fit'>
                        placeholder="Select"
                        variant="ghost"
                        options={modeOptions}
                        value={activeMode}
                        onChange={(val) => val != null && onModeChange(val)}
                        className="min-w-[100px]"
                    />
                    <div className="crop-transform-controls flex items-center gap-1">
                        <SimpleTooltip content="Turn the Image 90° Counter clockwise" side="bottom">
                            <Button
                                variant="outline"
                                color="subtle"
                                className="h-8"
                                onClick={onRotate90}
                                disabled={exporting || downloading}
                            >
                                <RotateCcwIcon />
                            </Button>
                        </SimpleTooltip>
                        <SimpleTooltip content="Mirror Image Horizontally" side="bottom">
                            <Button
                                variant="outline"
                                color="subtle"
                                className="h-8"
                                onClick={onToggleFlipX}
                                disabled={exporting || downloading}
                            >
                                <SquareCenterlineDashedHorizontalIcon />
                            </Button>
                        </SimpleTooltip>
                        <SimpleTooltip content="Mirror Image Vertically" side="bottom">
                            <Button
                                variant="outline"
                                color="subtle"
                                className="h-8"
                                onClick={onToggleFlipY}
                                disabled={exporting || downloading}
                            >
                                <SquareCenterlineDashedVerticalIcon />
                            </Button>
                        </SimpleTooltip>
                    </div>
                </div>

                <div aria-label="Straighten" className="straighten-controls flex items-center gap-1">
                    <span className="text-sm font-medium">Straighten</span>
                    <IntensityControl
                        showLabel={false}
                        value={Number.isFinite(straightenAngle) ? straightenAngle : 0}
                        displayValue={`${Number.isFinite(straightenAngle) ? straightenAngle.toFixed(1) : '0.0'}°`}
                        min={-45}
                        max={45}
                        step={1}
                        pattern="-?[0-9]*"
                        allowedPattern={/^-?\d*$/}
                        disabled={exporting || downloading}
                        onSliderStart={onStraightenStart}
                        onEditStart={onStraightenStart}
                        onChange={(val) => {
                            throttledStraightenChange(Number.isFinite(val) ? val : 0);
                        }}
                        wrapperClassName="flex items-center gap-2"
                        sliderWrapperClassName="straighten-slider-wrapper"
                        numberClassName="straighten-number"
                        rangeClassName="straighten-slider"
                        ariaLabelNumber="Straighten angle"
                        ariaLabelSlider="Straighten angle"
                    />
                </div>
            </div>

            <div className="crop-sub-toolbar-right flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onResetCrop} disabled={exporting || downloading}>
                    <RotateCwIcon />
                    Reset
                </Button>
                <Button size="sm" onClick={onDone} disabled={exporting || downloading}>
                    Done
                </Button>
            </div>
        </div>
    );
};

export default CropSubToolbar;

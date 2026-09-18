export interface ImageEditorModalProps {
    imageUrl: string;
    imageName: string;
    isOpen: boolean;
    onClose: () => void;
}

export type AspectRatioPresetValue = 'original' | '1:1' | '4:3' | '3:2' | '16:9';
export interface CustomAspectRatio {
    width: number;
    height: number;
}
export type AspectRatio = AspectRatioPresetValue | CustomAspectRatio | 'free';

export interface AspectRatioPreset {
    value: AspectRatioPresetValue;
    label: string;
    ratio: number | null;
}

export type Mode = 'crop' | 'adjust' | 'filters';
export type ActiveMode = Mode | null;

export interface LutFilterOption {
    id: string;
    label: string;
    category: string;
    lutUri: string;
    tilesX: number;
    tilesY: number;
    dataCy: string;
}

export interface LutTexture {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    tilesX: number;
    tilesY: number;
    lutSize: number;
}

export interface DuotoneColors {
    darkColor: string;
    lightColor: string;
}

export interface Adjustments {
    brightness: number;
    saturation: number;
    contrast: number;
    gamma: number;
    clarity: number;
    exposure: number;
    shadows: number;
    highlights: number;
    blacks: number;
    whites: number;
    temperature: number;
    sharpness: number;
    vignette: {
        size: number;
        amount: number;
    };
    tint: number;
    vibrance: number;
    dehaze: {
        amount: number;
    };
    grain: {
        amount: number;
        size: number;
    };
    denoise: {
        amount: number;
    };
    blur: {
        amount: number;
    };
}

export type AdjustmentKey = keyof Adjustments;

export interface CropState {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    straightenAngle: number;
    aspectRatio: AspectRatio;
    lockedAspectRatio: number | null;
    mode: 'crop' | 'fit';
}

export interface ZoomState {
    level: number;
}

export interface EditorStateSnapshot extends Record<string, unknown> {
    selectedFilterId: string | null;
    filterIntensity: number;
    filterEnabled: boolean;
    adjustments: Adjustments;
    adjustmentsEnabled: boolean;
    crop: CropState;
}

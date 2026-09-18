import { clamp } from 'lodash';

import type { Adjustments } from '../types';

export const defaultAdjustments: Adjustments = {
    brightness: 0,
    saturation: 0,
    contrast: 0,
    gamma: 0,
    clarity: 0,
    exposure: 0,
    shadows: 0,
    highlights: 0,
    blacks: 0,
    whites: 0,
    temperature: 0,
    sharpness: 0,
    vignette: {
        size: 0,
        amount: 0,
    },
    tint: 0,
    vibrance: 0,
    dehaze: {
        amount: 0,
    },
    grain: {
        amount: 0,
        size: 0,
    },
    denoise: {
        amount: 0,
    },
    blur: {
        amount: 0,
    },
};

export const ADJUSTMENT_CONTROLS: Array<{
    key: keyof Adjustments;
    label: string;
    min: number;
    max: number;
    step?: number;
}> = [
    {
        key: 'brightness',
        label: 'Brightness',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'saturation',
        label: 'Saturation',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'contrast',
        label: 'Contrast',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'gamma',
        label: 'Gamma',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'clarity',
        label: 'Clarity',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'exposure',
        label: 'Exposure',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'shadows',
        label: 'Shadows',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'highlights',
        label: 'Highlights',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'blacks',
        label: 'Blacks',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'whites',
        label: 'Whites',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'temperature',
        label: 'Temperature',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'sharpness',
        label: 'Sharpness',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'tint',
        label: 'Tint',
        min: -100,
        max: 100,
        step: 1,
    },
    {
        key: 'vibrance',
        label: 'Vibrance',
        min: -100,
        max: 100,
        step: 1,
    },
];

export const ADJUSTMENT_SECTIONS: Array<{ title: string; keys: (keyof Adjustments)[] }> = [
    {
        title: 'Basic',
        keys: ['brightness', 'saturation', 'contrast', 'gamma', 'vibrance', 'tint'],
    },
    {
        title: 'Refinements',
        keys: ['clarity', 'exposure', 'shadows', 'highlights', 'blacks', 'whites', 'temperature', 'sharpness'],
    },
    {
        title: 'Advanced',
        keys: ['vignette', 'grain', 'dehaze', 'denoise', 'blur'],
    },
];

export interface AccordionControl {
    property: string;
    label: string;
    min: number;
    max: number;
    step: number;
}

export interface AccordionAdjustmentConfig {
    key: keyof Adjustments;
    label: string;
    controls: AccordionControl[];
}

export const ACCORDION_ADJUSTMENTS: AccordionAdjustmentConfig[] = [
    {
        key: 'vignette',
        label: 'Vignette',
        controls: [
            {
                property: 'size',
                label: 'Size',
                min: 0,
                max: 100,
                step: 1,
            },
            {
                property: 'amount',
                label: 'Amount',
                min: 0,
                max: 100,
                step: 1,
            },
        ],
    },
    {
        key: 'grain',
        label: 'Grain',
        controls: [
            {
                property: 'amount',
                label: 'Amount',
                min: 0,
                max: 100,
                step: 1,
            },
            {
                property: 'size',
                label: 'Size',
                min: 0,
                max: 100,
                step: 1,
            },
        ],
    },
    {
        key: 'dehaze',
        label: 'Dehaze',
        controls: [
            {
                property: 'amount',
                label: 'Amount',
                min: -100,
                max: 100,
                step: 1,
            },
        ],
    },
    {
        key: 'denoise',
        label: 'Denoise',
        controls: [
            {
                property: 'amount',
                label: 'Amount',
                min: 0,
                max: 100,
                step: 1,
            },
        ],
    },
    {
        key: 'blur',
        label: 'Blur',
        controls: [
            {
                property: 'amount',
                label: 'Amount',
                min: 0,
                max: 100,
                step: 1,
            },
        ],
    },
];

// Adjustment normalization functions
export const normalizeAdjustmentValue = (value: number): number => {
    return clamp(value / 100, -1, 1);
};

export const normalizeShadows = (value: number): number => {
    const normalized = normalizeAdjustmentValue(value);

    return clamp(normalized * 2, -2, 2);
};

export const normalizeGamma = (value: number): number => {
    const normalized = normalizeAdjustmentValue(value);

    if (normalized < 0) {
        return 1 + 0.5 * normalized;
    }

    return 1 + normalized;
};

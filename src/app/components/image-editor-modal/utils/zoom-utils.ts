import { clamp } from 'lodash';

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 120000;
export const ZOOM_SENSITIVITY = 0.002;

export const ZOOM_STEPS = [12.5, 25, 50, 100, 200, 400, 800, 1600, 3200];

export const clampZoom = (zoom: number): number => {
    return clamp(zoom, MIN_ZOOM, MAX_ZOOM);
};

export const getNextZoomStep = (currentZoom: number): number => {
    const currentIndex = ZOOM_STEPS.findIndex((step) => step > currentZoom);

    return currentIndex >= 0 ? ZOOM_STEPS[currentIndex] : MAX_ZOOM;
};

export const getPreviousZoomStep = (currentZoom: number): number => {
    const currentIndex = ZOOM_STEPS.findIndex((step) => step >= currentZoom);

    return currentIndex > 0 ? ZOOM_STEPS[currentIndex - 1] : MIN_ZOOM;
};

export const calculateFitZoomLevel = (
    imageDimensions: { width: number; height: number },
    containerSize: { width: number; height: number },
): number => {
    if (!imageDimensions.width || !imageDimensions.height || !containerSize.width || !containerSize.height) {
        return 100;
    }

    const fitLevel =
        Math.min(containerSize.width / imageDimensions.width, containerSize.height / imageDimensions.height) * 100;

    return fitLevel;
};

export const calculateDisplaySize = (
    imageDimensions: { width: number; height: number },
    zoomLevel: number,
): { width: number; height: number } => {
    if (!imageDimensions.width || !imageDimensions.height) {
        return { width: 100, height: 100 };
    }

    const scale = zoomLevel / 100;

    return {
        width: imageDimensions.width * scale,
        height: imageDimensions.height * scale,
    };
};

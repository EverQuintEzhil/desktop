export const DEFAULT_ZOOM_LEVEL = 100;

export const DEFAULT_CROP_STATE = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    flipX: false,
    flipY: false,
    straightenAngle: 0,
    aspectRatio: 'free' as const,
    lockedAspectRatio: null,
    mode: 'crop' as const,
};

export const DEFAULT_ZOOM_STATE = {
    level: DEFAULT_ZOOM_LEVEL,
};

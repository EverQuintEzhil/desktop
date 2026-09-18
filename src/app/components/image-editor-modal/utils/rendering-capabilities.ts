export interface RenderingCapabilities {
    webglSupported: boolean;
    renderingMode: 'webgl' | 'canvas2d';
    isSlowMode: boolean;
}

export const isWebGLSupported = (): boolean => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            return false;
        }

        return true;
    } catch (e) {
        // Diagnostic for unexpected WebGL probe failures; warn keeps it out of error telemetry.
        // eslint-disable-next-line no-console
        console.warn('WebGL detection failed:', e);

        return false;
    }
};

export const getRenderingCapabilities = (): RenderingCapabilities => {
    const webglSupported = isWebGLSupported();

    return {
        webglSupported,
        renderingMode: webglSupported ? 'webgl' : 'canvas2d',
        isSlowMode: !webglSupported,
    };
};

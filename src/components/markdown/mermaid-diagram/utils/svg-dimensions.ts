const readSvgLength = (value: string | null): number | null => {
    if (!value) return null;
    if (value.includes('%')) return null;

    const parsed = Number.parseFloat(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getSvgDimensions = (svg: string): { width: number; height: number } => {
    const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const svgElement = svgDocument.documentElement;
    const viewBox = svgElement.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);

    return {
        width: viewBox?.[2] ?? readSvgLength(svgElement.getAttribute('width')) ?? 1200,
        height: viewBox?.[3] ?? readSvgLength(svgElement.getAttribute('height')) ?? 800,
    };
};

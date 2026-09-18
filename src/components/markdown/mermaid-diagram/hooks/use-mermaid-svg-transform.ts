import { useMemo } from 'react';

import { getSvgDimensions } from '../utils';

interface UseMermaidSvgTransformResult {
    naturalDims: { width: number; height: number } | null;
    baseSvg: string;
}

export const useMermaidSvgTransform = (svg: string): UseMermaidSvgTransformResult => {
    const naturalDims = useMemo(() => (svg ? getSvgDimensions(svg) : null), [svg]);

    const baseSvg = useMemo(() => {
        if (!svg || !naturalDims) return svg;

        try {
            const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
            const svgEl = parsed.documentElement as unknown as SVGSVGElement | null;

            if (svgEl?.tagName.toLowerCase() !== 'svg') return svg;

            svgEl.setAttribute('width', String(naturalDims.width));
            svgEl.setAttribute('height', String(naturalDims.height));
            svgEl.removeAttribute('style');

            return new XMLSerializer().serializeToString(svgEl);
        } catch (scaleError) {
            console.error('[Mermaid]', scaleError);

            return svg;
        }
    }, [svg, naturalDims]);

    return { naturalDims, baseSvg };
};

import { getSvgDimensions } from './svg-dimensions';

export const cropSvgToContent = (svg: string): { svg: string; width: number; height: number } => {
    const container = document.createElement('div');

    container.style.position = 'absolute';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.visibility = 'hidden';
    container.innerHTML = svg;
    document.body.appendChild(container);

    try {
        const svgEl = container.querySelector<SVGSVGElement>('svg');

        if (!svgEl) {
            const fallback = getSvgDimensions(svg);

            return { svg, width: fallback.width, height: fallback.height };
        }

        const bbox = svgEl.getBBox();
        const padding = 8;
        const width = Math.max(Math.ceil(bbox.width) + padding * 2, 1);
        const height = Math.max(Math.ceil(bbox.height) + padding * 2, 1);
        const x = Math.floor(bbox.x) - padding;
        const y = Math.floor(bbox.y) - padding;

        svgEl.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        svgEl.setAttribute('width', String(width));
        svgEl.setAttribute('height', String(height));
        svgEl.removeAttribute('style');

        return {
            svg: new XMLSerializer().serializeToString(svgEl),
            width,
            height,
        };
    } catch (cropError) {
        console.error('[Mermaid]', cropError);
        const fallback = getSvgDimensions(svg);

        return { svg, width: fallback.width, height: fallback.height };
    } finally {
        document.body.removeChild(container);
    }
};

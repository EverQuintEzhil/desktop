import { describe, expect, it } from 'vitest';

import { computeMaskOutlinePaths } from './mask-image-helpers';

type Alpha = (x: number, y: number) => number;

const mask = (w: number, h: number, alpha: Alpha): Uint8ClampedArray => {
    const data = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            data[(y * w + x) * 4 + 3] = alpha(x, y);
        }
    }

    return data;
};

const inside = (x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1;

const boundingBox = (path: Array<{ x: number; y: number }>) => ({
    minX: Math.min(...path.map((point) => point.x)),
    maxX: Math.max(...path.map((point) => point.x)),
    minY: Math.min(...path.map((point) => point.y)),
    maxY: Math.max(...path.map((point) => point.y)),
});

describe('computeMaskOutlinePaths', () => {
    it('returns no paths for a fully transparent mask', () => {
        expect(
            computeMaskOutlinePaths(
                mask(6, 6, () => 0),
                6,
                6,
            ),
        ).toEqual([]);
    });

    it('returns no paths for a fully opaque mask', () => {
        expect(
            computeMaskOutlinePaths(
                mask(6, 6, () => 255),
                6,
                6,
            ),
        ).toEqual([]);
    });

    it('traces a single closed outline around one opaque square', () => {
        const data = mask(4, 4, (x, y) => (inside(x, y, 1, 1, 2, 2) ? 255 : 0));

        const paths = computeMaskOutlinePaths(data, 4, 4);

        expect(paths).toHaveLength(1);
        expect(paths[0][0]).toEqual(paths[0][paths[0].length - 1]);
        expect(boundingBox(paths[0])).toEqual({
            minX: 0.5,
            maxX: 2.5,
            minY: 0.5,
            maxY: 2.5,
        });
    });

    it('traces one outline per disconnected region', () => {
        const data = mask(9, 5, (x, y) => (inside(x, y, 1, 1, 2, 3) || inside(x, y, 6, 1, 7, 3) ? 255 : 0));

        const paths = computeMaskOutlinePaths(data, 9, 5);

        expect(paths).toHaveLength(2);

        const xRanges = paths.map((path) => boundingBox(path).minX).sort((a, b) => a - b);

        expect(xRanges).toEqual([0.5, 5.5]);
    });

    it('interpolates sub-pixel crossings for a soft edge instead of snapping to the half pixel', () => {
        const data = mask(5, 5, (x, y) => {
            if (!inside(x, y, 1, 1, 3, 3)) return 0;

            return x === 1 ? 191 : 255;
        });

        const [path] = computeMaskOutlinePaths(data, 5, 5);
        const fractional = path.filter((point) => point.x % 1 !== 0.5 || point.y % 1 !== 0.5);

        expect(path.length).toBeGreaterThan(4);
        expect(fractional.length).toBeGreaterThan(0);
    });

    it('traces a diamond around a single opaque pixel', () => {
        const data = mask(3, 3, (x, y) => (x === 1 && y === 1 ? 255 : 0));

        const paths = computeMaskOutlinePaths(data, 3, 3);

        expect(paths).toEqual([
            [
                { x: 0.5, y: 1 },
                { x: 1, y: 0.5 },
                { x: 1.5, y: 1 },
                { x: 1, y: 1.5 },
                { x: 0.5, y: 1 },
            ],
        ]);
    });

    it('handles every marching-squares corner configuration without producing a contour from one cell', () => {
        for (let pattern = 0; pattern < 16; pattern++) {
            const corners = [
                (pattern & 0b1000) !== 0,
                (pattern & 0b0100) !== 0,
                (pattern & 0b0010) !== 0,
                (pattern & 0b0001) !== 0,
            ];
            const data = mask(2, 2, (x, y) => {
                const index = y === 0 ? x : 3 - x;

                return corners[index] ? 255 : 0;
            });

            expect(computeMaskOutlinePaths(data, 2, 2)).toEqual([]);
        }
    });

    it('separates two saddle cells into distinct contours rather than one crossing loop', () => {
        const data = mask(6, 6, (x, y) => (inside(x, y, 1, 1, 2, 2) || inside(x, y, 3, 3, 4, 4) ? 255 : 0));

        const paths = computeMaskOutlinePaths(data, 6, 6);

        expect(paths.length).toBeGreaterThanOrEqual(1);
        paths.forEach((path) => expect(path.length).toBeGreaterThanOrEqual(4));
    });

    it('traces a ring with both an outer and an inner contour', () => {
        const data = mask(9, 9, (x, y) => {
            if (!inside(x, y, 1, 1, 7, 7)) return 0;

            return inside(x, y, 3, 3, 5, 5) ? 0 : 255;
        });

        const paths = computeMaskOutlinePaths(data, 9, 9);

        expect(paths).toHaveLength(2);

        const sizes = paths
            .map((path) => boundingBox(path))
            .map((box) => box.maxX - box.minX)
            .sort((a, b) => a - b);

        expect(sizes[0]).toBeLessThan(sizes[1]);
    });
});

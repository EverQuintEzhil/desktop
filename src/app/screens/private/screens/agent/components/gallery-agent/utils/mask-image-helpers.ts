export const computeMaskOutlinePaths = (
    data: Uint8ClampedArray,
    w: number,
    h: number,
): Array<Array<{ x: number; y: number }>> => {
    const THRESHOLD = 0.5;
    const KEY_SCALE = 1024;

    const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3] / 255;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    type Key = string;
    const keyOf = (px: number, py: number): Key => `${Math.round(px * KEY_SCALE)},${Math.round(py * KEY_SCALE)}`;
    const parseKey = (k: Key) => {
        const [sx, sy] = k.split(',');

        return { x: Number(sx) / KEY_SCALE, y: Number(sy) / KEY_SCALE };
    };

    const edgePoint = (
        cellX: number,
        cellY: number,
        edge: 0 | 1 | 2 | 3,
        tl: number,
        tr: number,
        br: number,
        bl: number,
    ) => {
        const interp = (v1: number, v2: number) => {
            const denom = v2 - v1;

            if (Math.abs(denom) < 1e-6) return 0.5;

            return clamp01((THRESHOLD - v1) / denom);
        };

        switch (edge) {
            case 0: {
                const t = interp(tl, bl);

                return { x: cellX, y: cellY + t };
            }
            case 1: {
                const t = interp(tl, tr);

                return { x: cellX + t, y: cellY };
            }
            case 2: {
                const t = interp(tr, br);

                return { x: cellX + 1, y: cellY + t };
            }
            case 3: {
                const t = interp(bl, br);

                return { x: cellX + t, y: cellY + 1 };
            }
            default:
                return { x: cellX, y: cellY };
        }
    };

    const segments: Array<[Key, Key]> = [];
    const addSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        segments.push([keyOf(a.x, a.y), keyOf(b.x, b.y)]);
    };

    for (let y = 0; y < h - 1; y++) {
        for (let x = 0; x < w - 1; x++) {
            const vtl = alphaAt(x, y);
            const vtr = alphaAt(x + 1, y);
            const vbr = alphaAt(x + 1, y + 1);
            const vbl = alphaAt(x, y + 1);

            const tl = vtl >= THRESHOLD ? 1 : 0;
            const tr = vtr >= THRESHOLD ? 1 : 0;
            const br = vbr >= THRESHOLD ? 1 : 0;
            const bl = vbl >= THRESHOLD ? 1 : 0;
            const idx = (tl << 3) | (tr << 2) | (br << 1) | bl;

            switch (idx) {
                case 0:
                case 15:
                    break;
                case 1:
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 3, vtl, vtr, vbr, vbl));
                    break;
                case 2:
                    addSeg(edgePoint(x, y, 3, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    break;
                case 3:
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    break;
                case 4:
                    addSeg(edgePoint(x, y, 1, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    break;
                case 5:
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 1, vtl, vtr, vbr, vbl));
                    addSeg(edgePoint(x, y, 3, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    break;
                case 6:
                    addSeg(edgePoint(x, y, 1, vtl, vtr, vbr, vbl), edgePoint(x, y, 3, vtl, vtr, vbr, vbl));
                    break;
                case 7:
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 1, vtl, vtr, vbr, vbl));
                    break;
                case 8:
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 1, vtl, vtr, vbr, vbl));
                    break;
                case 9:
                    addSeg(edgePoint(x, y, 1, vtl, vtr, vbr, vbl), edgePoint(x, y, 3, vtl, vtr, vbr, vbl));
                    break;
                case 10:
                    addSeg(edgePoint(x, y, 1, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 3, vtl, vtr, vbr, vbl));
                    break;
                case 11:
                    addSeg(edgePoint(x, y, 1, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    break;
                case 12:
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    break;
                case 13:
                    addSeg(edgePoint(x, y, 3, vtl, vtr, vbr, vbl), edgePoint(x, y, 2, vtl, vtr, vbr, vbl));
                    break;
                case 14:
                    addSeg(edgePoint(x, y, 0, vtl, vtr, vbr, vbl), edgePoint(x, y, 3, vtl, vtr, vbr, vbl));
                    break;
                default:
                    break;
            }
        }
    }

    const adjacency = new Map<Key, Key[]>();
    const addAdj = (a: Key, b: Key) => {
        const arr = adjacency.get(a);

        if (arr) arr.push(b);
        else adjacency.set(a, [b]);
    };

    for (const [a, b] of segments) {
        addAdj(a, b);
        addAdj(b, a);
    }

    const edgeKey = (a: Key, b: Key) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const usedEdges = new Set<string>();

    const paths: Array<Array<{ x: number; y: number }>> = [];

    for (const [a, b] of segments) {
        const ek = edgeKey(a, b);

        if (usedEdges.has(ek)) continue;

        const start = a;
        let current = a;
        let prev: Key | null = null;
        const pathKeys: Key[] = [current];

        while (true) {
            const neighbors = adjacency.get(current) || [];
            const next =
                neighbors.find((n) => {
                    if (prev && n === prev) return false;

                    return !usedEdges.has(edgeKey(current, n));
                }) || neighbors.find((n) => !usedEdges.has(edgeKey(current, n)));

            if (!next) break;

            usedEdges.add(edgeKey(current, next));
            prev = current;
            current = next;
            pathKeys.push(current);

            if (current === start) break;
            if (pathKeys.length > 20000) break;
        }

        if (pathKeys.length < 4) continue;
        const path = pathKeys.map((k) => {
            const { x, y } = parseKey(k);

            return { x, y };
        });

        paths.push(path);
    }

    return paths;
};

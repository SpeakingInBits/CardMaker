/** Axis-aligned rectangle in inches. */
export interface RectIn {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface SnapResult {
    x: number;
    y: number;
    /** Snapped vertical guide line position (inches), if any. */
    verticalGuideIn: number | null;
    /** Snapped horizontal guide line position (inches), if any. */
    horizontalGuideIn: number | null;
}

/**
 * Snap a dragged rectangle to alignment lines: the card edges and center,
 * plus the edges and centers of every other component on the face.
 * Each axis snaps independently to its closest line within `threshold`.
 */
export function computeSnap(
    proposed: RectIn,
    cardW: number,
    cardH: number,
    others: RectIn[],
    threshold: number,
): SnapResult {
    const vLines = [0, cardW / 2, cardW];
    const hLines = [0, cardH / 2, cardH];
    for (const o of others) {
        vLines.push(o.x, o.x + o.w / 2, o.x + o.w);
        hLines.push(o.y, o.y + o.h / 2, o.y + o.h);
    }

    const xSnap = snapAxis(proposed.x, [0, proposed.w / 2, proposed.w], vLines, threshold);
    const ySnap = snapAxis(proposed.y, [0, proposed.h / 2, proposed.h], hLines, threshold);

    return {
        x: xSnap?.position ?? proposed.x,
        y: ySnap?.position ?? proposed.y,
        verticalGuideIn: xSnap?.line ?? null,
        horizontalGuideIn: ySnap?.line ?? null,
    };
}

/**
 * Find the best snap for one axis: try aligning each anchor offset of the
 * dragged rect (leading edge, center, trailing edge) to each line; pick the
 * smallest adjustment within the threshold.
 */
function snapAxis(
    position: number,
    anchorOffsets: number[],
    lines: number[],
    threshold: number,
): { position: number; line: number } | null {
    let best: { position: number; line: number; delta: number } | null = null;
    for (const offset of anchorOffsets) {
        const anchor = position + offset;
        for (const line of lines) {
            const delta = Math.abs(line - anchor);
            if (delta <= threshold && (best === null || delta < best.delta)) {
                best = { position: line - offset, line, delta };
            }
        }
    }
    return best ? { position: best.position, line: best.line } : null;
}

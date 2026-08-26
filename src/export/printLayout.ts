export type PaperId = 'letter' | 'legal' | 'tabloid' | 'a3' | 'a4' | 'a5';

export interface PaperSize {
    label: string;
    widthIn: number;
    heightIn: number;
}

export const PAPER_SIZES: Record<PaperId, PaperSize> = {
    letter: { label: 'Letter (8.5 × 11 in)', widthIn: 8.5, heightIn: 11 },
    legal: { label: 'Legal (8.5 × 14 in)', widthIn: 8.5, heightIn: 14 },
    tabloid: { label: 'Tabloid (11 × 17 in)', widthIn: 11, heightIn: 17 },
    a3: { label: 'A3 (297 × 420 mm)', widthIn: 11.6929, heightIn: 16.5354 },
    a4: { label: 'A4 (210 × 297 mm)', widthIn: 8.2677, heightIn: 11.6929 },
    a5: { label: 'A5 (148 × 210 mm)', widthIn: 5.8268, heightIn: 8.2677 },
};

export const PRINT_LIMITS = {
    minPaperIn: 1,
    maxPaperIn: 48,
    minMarginIn: 0,
    maxMarginIn: 3,
    minGapIn: 0,
    maxGapIn: 2,
} as const;

/** Build a validated custom paper size from user-entered dimensions. */
export function customPaper(widthIn: number, heightIn: number): PaperSize {
    const clampDim = (v: number): number =>
        Math.min(PRINT_LIMITS.maxPaperIn, Math.max(PRINT_LIMITS.minPaperIn, v));
    const w = clampDim(Number.isFinite(widthIn) ? widthIn : 8.5);
    const h = clampDim(Number.isFinite(heightIn) ? heightIn : 11);
    return { label: `Custom (${w} × ${h} in)`, widthIn: w, heightIn: h };
}

export interface PrintLayout {
    cols: number;
    rows: number;
    perPage: number;
    pages: number;
    /** Top-left of the (centered) card grid on the page, in inches. */
    originX: number;
    originY: number;
    cardW: number;
    cardH: number;
    /** Spacing between adjacent cards, in inches (0 = shared cut lines). */
    gap: number;
    paperW: number;
    paperH: number;
    totalCards: number;
}

/**
 * Lay out `totalCards` copies of a card on pages of the given paper.
 * `marginIn` is the minimum page margin (0 = borderless) and `gapIn` the
 * spacing between adjacent cards (0 butts them edge-to-edge for shared cut
 * lines; a positive gap leaves room for cutting or lamination). The grid is
 * centered on the page, which keeps the mirrored backs page symmetric for
 * duplex printing. Returns null when no card fits on the paper at all.
 */
export function computePrintLayout(
    cardW: number,
    cardH: number,
    paper: PaperSize,
    marginIn: number,
    gapIn: number,
    totalCards: number,
): PrintLayout | null {
    const margin = Math.max(0, marginIn);
    const gap = Math.max(0, gapIn);
    const usableW = paper.widthIn - margin * 2;
    const usableH = paper.heightIn - margin * 2;
    // n cards spanning n*card + (n-1)*gap must fit in the usable area.
    const cols = Math.floor((usableW + gap) / (cardW + gap));
    const rows = Math.floor((usableH + gap) / (cardH + gap));
    if (cols < 1 || rows < 1 || totalCards < 1) return null;

    const gridW = cols * cardW + (cols - 1) * gap;
    const gridH = rows * cardH + (rows - 1) * gap;
    const perPage = cols * rows;
    return {
        cols,
        rows,
        perPage,
        pages: Math.ceil(totalCards / perPage),
        originX: (paper.widthIn - gridW) / 2,
        originY: (paper.heightIn - gridH) / 2,
        cardW,
        cardH,
        gap,
        paperW: paper.widthIn,
        paperH: paper.heightIn,
        totalCards,
    };
}

/** Position of slot `index` (0-based, row-major) on a fronts page, in inches. */
export function frontPosition(layout: PrintLayout, index: number): { x: number; y: number } {
    const col = index % layout.cols;
    const row = Math.floor(index / layout.cols);
    return {
        x: layout.originX + col * (layout.cardW + layout.gap),
        y: layout.originY + row * (layout.cardH + layout.gap),
    };
}

/**
 * Position of slot `index` on the matching backs page. The page is printed
 * on the reverse side and flipped on the long edge, so X is mirrored about
 * the page center; Y is unchanged. Because the grid is centered, the mirror
 * of any slot lands exactly on the slot in the mirrored column.
 */
export function backPosition(layout: PrintLayout, index: number): { x: number; y: number } {
    const front = frontPosition(layout, index);
    return {
        x: layout.paperW - front.x - layout.cardW,
        y: front.y,
    };
}

/**
 * The distinct vertical cut positions (card left/right edges) across the
 * grid, in inches. With gap 0, adjacent cards share an edge and it is
 * reported once.
 */
export function cutPositionsX(layout: PrintLayout): number[] {
    return dedupePositions(layout.cols, layout.originX, layout.cardW, layout.gap);
}

/** The distinct horizontal cut positions (card top/bottom edges), in inches. */
export function cutPositionsY(layout: PrintLayout): number[] {
    return dedupePositions(layout.rows, layout.originY, layout.cardH, layout.gap);
}

function dedupePositions(count: number, origin: number, size: number, gap: number): number[] {
    const positions: number[] = [];
    for (let i = 0; i < count; i++) {
        const start = origin + i * (size + gap);
        positions.push(start);
        // With no gap the next card's leading edge coincides with this
        // trailing edge; report the shared line once.
        if (gap > 0 || i === count - 1) positions.push(start + size);
    }
    return positions;
}

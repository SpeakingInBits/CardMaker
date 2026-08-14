export type PaperId = 'letter' | 'a4';

export interface PaperSize {
    label: string;
    widthIn: number;
    heightIn: number;
}

export const PAPER_SIZES: Record<PaperId, PaperSize> = {
    letter: { label: 'Letter (8.5 × 11 in)', widthIn: 8.5, heightIn: 11 },
    a4: { label: 'A4 (210 × 297 mm)', widthIn: 8.2677, heightIn: 11.6929 },
};

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
    paperW: number;
    paperH: number;
    totalCards: number;
}

/**
 * Lay out `totalCards` copies of a card on pages of the given paper.
 * Cards are butted edge-to-edge (shared cut lines) and the grid is centered,
 * which keeps the mirrored backs page symmetric for duplex printing.
 * Returns null when the card does not fit on the paper at all.
 */
export function computePrintLayout(
    cardW: number,
    cardH: number,
    paper: PaperSize,
    marginIn: number,
    totalCards: number,
): PrintLayout | null {
    const usableW = paper.widthIn - marginIn * 2;
    const usableH = paper.heightIn - marginIn * 2;
    const cols = Math.floor(usableW / cardW);
    const rows = Math.floor(usableH / cardH);
    if (cols < 1 || rows < 1 || totalCards < 1) return null;

    const perPage = cols * rows;
    return {
        cols,
        rows,
        perPage,
        pages: Math.ceil(totalCards / perPage),
        originX: (paper.widthIn - cols * cardW) / 2,
        originY: (paper.heightIn - rows * cardH) / 2,
        cardW,
        cardH,
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
        x: layout.originX + col * layout.cardW,
        y: layout.originY + row * layout.cardH,
    };
}

/**
 * Position of slot `index` on the matching backs page. The page is printed
 * on the reverse side and flipped on the long edge, so X is mirrored about
 * the page center; Y is unchanged.
 */
export function backPosition(layout: PrintLayout, index: number): { x: number; y: number } {
    const front = frontPosition(layout, index);
    return {
        x: layout.paperW - front.x - layout.cardW,
        y: front.y,
    };
}

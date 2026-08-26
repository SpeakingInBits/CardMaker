import { describe, expect, it } from 'vitest';
import {
    backPosition,
    computePrintLayout,
    customPaper,
    cutPositionsX,
    cutPositionsY,
    frontPosition,
    PAPER_SIZES,
    PRINT_LIMITS,
} from './printLayout';

describe('PAPER_SIZES', () => {
    it('includes the standard sizes', () => {
        expect(Object.keys(PAPER_SIZES)).toEqual(
            expect.arrayContaining(['letter', 'legal', 'tabloid', 'a3', 'a4', 'a5']),
        );
    });

    it('has sane portrait dimensions', () => {
        for (const size of Object.values(PAPER_SIZES)) {
            expect(size.widthIn).toBeGreaterThan(0);
            expect(size.heightIn).toBeGreaterThanOrEqual(size.widthIn);
        }
    });
});

describe('customPaper', () => {
    it('builds a labeled paper size from dimensions', () => {
        const paper = customPaper(6, 9);
        expect(paper).toEqual({ label: 'Custom (6 × 9 in)', widthIn: 6, heightIn: 9 });
    });

    it('clamps dimensions to the allowed range', () => {
        expect(customPaper(0.1, 999)).toMatchObject({
            widthIn: PRINT_LIMITS.minPaperIn,
            heightIn: PRINT_LIMITS.maxPaperIn,
        });
    });

    it('falls back to Letter dimensions on non-finite input', () => {
        expect(customPaper(NaN, Infinity)).toMatchObject({ widthIn: 8.5, heightIn: 11 });
    });
});

describe('computePrintLayout', () => {
    it('fits 3x3 poker cards per Letter page (portrait grid of 2.5x3.5)', () => {
        const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0, 10);
        expect(layout).not.toBeNull();
        expect(layout!.cols).toBe(3);
        expect(layout!.rows).toBe(3);
        expect(layout!.perPage).toBe(9);
        expect(layout!.pages).toBe(2);
    });

    it('centers the card grid on the page', () => {
        const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0, 1)!;
        expect(layout.originX).toBeCloseTo((8.5 - 3 * 2.5) / 2);
        expect(layout.originY).toBeCloseTo((11 - 3 * 3.5) / 2);
    });

    it('returns null when the card cannot fit', () => {
        expect(computePrintLayout(9, 3.5, PAPER_SIZES.letter, 0.25, 0, 1)).toBeNull();
        expect(computePrintLayout(2.5, 12, PAPER_SIZES.letter, 0.25, 0, 1)).toBeNull();
        expect(computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0, 0)).toBeNull();
    });

    it('fits 4x4 poker cards on Tabloid', () => {
        const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.tabloid, 0.25, 0, 16)!;
        expect(layout.cols).toBe(4);
        expect(layout.rows).toBe(4);
        expect(layout.pages).toBe(1);
    });

    it('lays cards out on a custom paper size', () => {
        const layout = computePrintLayout(2.5, 3.5, customPaper(5.5, 8), 0.25, 0, 4)!;
        expect(layout.cols).toBe(2);
        expect(layout.rows).toBe(2);
        expect(layout.pages).toBe(1);
    });

    // Issue #4: custom margins / borderless printing.
    describe('margins', () => {
        it('a thinner margin can fit more cards per page', () => {
            // 3.5in-tall card on Legal: usable height 13.5 at 0.25 margin → 3 rows,
            // 14.0 borderless → 4 rows.
            const withMargin = computePrintLayout(2.5, 3.5, PAPER_SIZES.legal, 0.25, 0, 20)!;
            const borderless = computePrintLayout(2.5, 3.5, PAPER_SIZES.legal, 0, 0, 20)!;
            expect(withMargin.rows).toBe(3);
            expect(borderless.rows).toBe(4);
            expect(borderless.pages).toBeLessThan(withMargin.pages);
        });

        it('borderless (margin 0) uses the full page', () => {
            // 4.25 x 5.5 cards tile a Letter page exactly 2x2 with no margin.
            const layout = computePrintLayout(4.25, 5.5, PAPER_SIZES.letter, 0, 0, 4)!;
            expect(layout.cols).toBe(2);
            expect(layout.rows).toBe(2);
            expect(layout.originX).toBeCloseTo(0);
            expect(layout.originY).toBeCloseTo(0);
        });

        it('a large margin can make the card not fit', () => {
            // Letter at 3in margins leaves 2.5 x 5 usable: a 2.6in-wide card no longer fits.
            expect(computePrintLayout(2.6, 3.5, PAPER_SIZES.letter, 3, 0, 1)).toBeNull();
            expect(computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 3, 0, 1)).not.toBeNull();
        });

        it('treats a negative margin as 0', () => {
            const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, -1, 0, 1)!;
            expect(layout.cols).toBe(3);
            expect(layout.originX).toBeGreaterThanOrEqual(0);
        });

        it('the grid never intrudes into the margin', () => {
            const margin = 0.75;
            const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, margin, 0, 1)!;
            expect(layout.originX).toBeGreaterThanOrEqual(margin);
            expect(layout.originY).toBeGreaterThanOrEqual(margin);
            const gridRight = layout.originX + layout.cols * layout.cardW;
            expect(gridRight).toBeLessThanOrEqual(layout.paperW - margin + 1e-9);
        });
    });

    // Issue #6: adjustable gap between cards.
    describe('card gaps', () => {
        it('a gap reduces how many cards fit per page', () => {
            const noGap = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0, 9)!;
            const gapped = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0.25, 9)!;
            expect(noGap.perPage).toBe(9); // 3 x 3
            expect(gapped.cols).toBe(3); // 3 * 2.5 + 2 * 0.25 = 8.0 still fits
            expect(gapped.rows).toBe(2); // 3 * 3.5 + 2 * 0.25 = 11.0 > 10.5
            expect(gapped.perPage).toBe(6);
        });

        it('spaces cards by card size plus gap and stays centered', () => {
            const gap = 0.25;
            const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, gap, 6)!;
            const gridW = layout.cols * 2.5 + (layout.cols - 1) * gap;
            expect(layout.originX).toBeCloseTo((8.5 - gridW) / 2);

            const p0 = frontPosition(layout, 0);
            const p1 = frontPosition(layout, 1);
            expect(p1.x - p0.x).toBeCloseTo(2.5 + gap);
            const below = frontPosition(layout, layout.cols);
            expect(below.y - p0.y).toBeCloseTo(3.5 + gap);
        });

        it('treats a negative gap as 0', () => {
            const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, -1, 2)!;
            expect(layout.gap).toBe(0);
            const p0 = frontPosition(layout, 0);
            const p1 = frontPosition(layout, 1);
            expect(p1.x - p0.x).toBeCloseTo(2.5);
        });

        it('gapped cards never overlap the margins', () => {
            const margin = 0.5;
            const gap = 0.3;
            const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.tabloid, margin, gap, 50)!;
            for (let i = 0; i < layout.perPage; i++) {
                const { x, y } = frontPosition(layout, i);
                expect(x).toBeGreaterThanOrEqual(margin - 1e-9);
                expect(y).toBeGreaterThanOrEqual(margin - 1e-9);
                expect(x + layout.cardW).toBeLessThanOrEqual(layout.paperW - margin + 1e-9);
                expect(y + layout.cardH).toBeLessThanOrEqual(layout.paperH - margin + 1e-9);
            }
        });
    });
});

describe('front/back positions', () => {
    const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0, 6)!;

    it('lays fronts out row-major from the grid origin', () => {
        expect(frontPosition(layout, 0)).toEqual({ x: layout.originX, y: layout.originY });
        expect(frontPosition(layout, 1)).toEqual({ x: layout.originX + 2.5, y: layout.originY });
        expect(frontPosition(layout, 3)).toEqual({ x: layout.originX, y: layout.originY + 3.5 });
    });

    it('mirrors backs horizontally so duplex long-edge flips align', () => {
        for (let i = 0; i < layout.perPage; i++) {
            const front = frontPosition(layout, i);
            const back = backPosition(layout, i);
            // The back's rect must mirror the front's rect about the page's vertical center line.
            expect(back.x).toBeCloseTo(layout.paperW - front.x - layout.cardW);
            expect(back.y).toBe(front.y);
        }
        // Slot 0 (top-left front) must land at top-right on the backs page.
        const back0 = backPosition(layout, 0);
        const front2 = frontPosition(layout, 2); // top-right slot in a 3-wide grid
        expect(back0.x).toBeCloseTo(front2.x);
    });

    it('keeps duplex mirroring aligned to grid slots with a card gap', () => {
        const gapped = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0.2, 6)!;
        for (let i = 0; i < gapped.perPage; i++) {
            const col = i % gapped.cols;
            const row = Math.floor(i / gapped.cols);
            const mirroredSlot = row * gapped.cols + (gapped.cols - 1 - col);
            const back = backPosition(gapped, i);
            const mirroredFront = frontPosition(gapped, mirroredSlot);
            // Each back must land exactly on the mirrored column's slot.
            expect(back.x).toBeCloseTo(mirroredFront.x);
            expect(back.y).toBeCloseTo(mirroredFront.y);
        }
    });
});

describe('cut positions', () => {
    it('shares cut lines between adjacent cards when gap is 0', () => {
        const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0, 9)!;
        const xs = cutPositionsX(layout);
        // 3 columns butted together → 4 distinct vertical cut lines.
        expect(xs).toHaveLength(4);
        expect(xs[0]).toBeCloseTo(layout.originX);
        expect(xs[3]).toBeCloseTo(layout.originX + 3 * 2.5);
        expect(cutPositionsY(layout)).toHaveLength(4);
    });

    it('gives every card edge its own cut line when there is a gap', () => {
        const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0.25, 6)!;
        const xs = cutPositionsX(layout);
        // 3 columns with gaps → 6 distinct vertical cut lines (left+right per column).
        expect(xs).toHaveLength(6);
        expect(xs[0]).toBeCloseTo(layout.originX);
        expect(xs[1]).toBeCloseTo(layout.originX + 2.5);
        expect(xs[2]).toBeCloseTo(layout.originX + 2.5 + 0.25);
        // 2 rows with a gap → 4 horizontal cut lines.
        expect(cutPositionsY(layout)).toHaveLength(4);
    });
});

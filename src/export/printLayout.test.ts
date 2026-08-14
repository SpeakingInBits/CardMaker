import { describe, expect, it } from 'vitest';
import { backPosition, computePrintLayout, frontPosition, PAPER_SIZES } from './printLayout';

describe('computePrintLayout', () => {
    it('fits 3x3 poker cards per Letter page (portrait grid of 2.5x3.5)', () => {
        const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 10);
        expect(layout).not.toBeNull();
        expect(layout!.cols).toBe(3);
        expect(layout!.rows).toBe(3);
        expect(layout!.perPage).toBe(9);
        expect(layout!.pages).toBe(2);
    });

    it('centers the card grid on the page', () => {
        const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 1)!;
        expect(layout.originX).toBeCloseTo((8.5 - 3 * 2.5) / 2);
        expect(layout.originY).toBeCloseTo((11 - 3 * 3.5) / 2);
    });

    it('returns null when the card cannot fit', () => {
        expect(computePrintLayout(9, 3.5, PAPER_SIZES.letter, 0.25, 1)).toBeNull();
        expect(computePrintLayout(2.5, 12, PAPER_SIZES.letter, 0.25, 1)).toBeNull();
        expect(computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 0)).toBeNull();
    });
});

describe('front/back positions', () => {
    const layout = computePrintLayout(2.5, 3.5, PAPER_SIZES.letter, 0.25, 6)!;

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
});

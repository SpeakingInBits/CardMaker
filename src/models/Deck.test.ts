import { describe, expect, it } from 'vitest';
import { CARD_LIMITS, Deck } from './Deck';

describe('Deck', () => {
    it('has sensible poker-card defaults', () => {
        const deck = new Deck();
        expect(deck.name).toBe('Untitled');
        expect(deck.widthInches).toBe(2.5);
        expect(deck.heightInches).toBe(3.5);
        expect(deck.dpi).toBe(300);
    });

    it('derives pixel dimensions from inches and DPI', () => {
        const deck = new Deck();
        expect(deck.pxWidth).toBe(750);
        expect(deck.pxHeight).toBe(1050);

        deck.dpi = 72;
        expect(deck.pxWidth).toBe(180);
        expect(deck.pxHeight).toBe(252);
    });

    it('rounds pixel dimensions to whole pixels', () => {
        const deck = new Deck();
        deck.widthInches = 2.55;
        deck.dpi = 301;
        expect(deck.pxWidth).toBe(Math.round(2.55 * 301));
        expect(Number.isInteger(deck.pxWidth)).toBe(true);
    });

    it('converts between inches, pixels, and points', () => {
        const deck = new Deck();
        expect(deck.inToPx(2)).toBe(600);
        expect(deck.pxToIn(600)).toBe(2);
        // 72pt = 1in = dpi px.
        expect(deck.ptToPx(72)).toBe(300);
    });

    it('round-trips through JSON', () => {
        const deck = new Deck();
        deck.name = 'My Deck';
        deck.widthInches = 3;
        deck.heightInches = 4;
        deck.dpi = 150;

        const restored = Deck.fromJSON(deck.toJSON());
        expect(restored.toJSON()).toEqual(deck.toJSON());
    });

    describe('fromJSON with untrusted data', () => {
        it('returns defaults for undefined data', () => {
            expect(Deck.fromJSON(undefined).toJSON()).toEqual(new Deck().toJSON());
        });

        it('clamps out-of-range dimensions and DPI', () => {
            const deck = Deck.fromJSON({ widthInches: 999, heightInches: 0.01, dpi: 5 });
            expect(deck.widthInches).toBe(CARD_LIMITS.maxInches);
            expect(deck.heightInches).toBe(CARD_LIMITS.minInches);
            expect(deck.dpi).toBe(CARD_LIMITS.minDpi);
        });

        it('falls back on non-numeric values', () => {
            const deck = Deck.fromJSON({
                name: 42 as unknown as string,
                widthInches: 'wide' as unknown as number,
                dpi: NaN,
            });
            expect(deck.name).toBe('Untitled');
            expect(deck.widthInches).toBe(2.5);
            expect(deck.dpi).toBe(300);
        });

        it('rounds fractional DPI to an integer', () => {
            expect(Deck.fromJSON({ dpi: 150.7 }).dpi).toBe(151);
        });
    });
});

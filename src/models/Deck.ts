import type { DeckData } from '../types';
import { clamp, toFiniteNumber } from '../utils/dom';

export const CARD_LIMITS = {
    minInches: 0.5,
    maxInches: 20,
    minDpi: 72,
    maxDpi: 1200,
} as const;

/**
 * Deck-wide physical settings: card size, resolution, and project name.
 * All component positions are stored in inches so cards can be re-rendered
 * at any DPI; this class owns the unit conversions.
 */
export class Deck {
    name = 'Untitled';
    widthInches = 2.5;
    heightInches = 3.5;
    dpi = 300;

    get pxWidth(): number {
        return Math.round(this.widthInches * this.dpi);
    }

    get pxHeight(): number {
        return Math.round(this.heightInches * this.dpi);
    }

    inToPx(inches: number): number {
        return inches * this.dpi;
    }

    pxToIn(px: number): number {
        return px / this.dpi;
    }

    /** Convert a point size (1/72 in) to canvas pixels at this deck's DPI. */
    ptToPx(pt: number): number {
        return pt * (this.dpi / 72);
    }

    toJSON(): DeckData {
        return {
            name: this.name,
            widthInches: this.widthInches,
            heightInches: this.heightInches,
            dpi: this.dpi,
        };
    }

    /** Build a Deck from untrusted data, clamping to sane ranges. */
    static fromJSON(data: Partial<DeckData> | undefined): Deck {
        const deck = new Deck();
        if (!data) return deck;
        deck.name = typeof data.name === 'string' ? data.name : 'Untitled';
        deck.widthInches = clamp(
            toFiniteNumber(data.widthInches, 2.5),
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        deck.heightInches = clamp(
            toFiniteNumber(data.heightInches, 3.5),
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        deck.dpi = clamp(Math.round(toFiniteNumber(data.dpi, 300)), CARD_LIMITS.minDpi, CARD_LIMITS.maxDpi);
        return deck;
    }
}

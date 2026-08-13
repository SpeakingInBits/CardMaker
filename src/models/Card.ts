import type { BackgroundFit, CardData } from '../types';
import { clamp, loadImage, toFiniteNumber } from '../utils/dom';

export const CARD_LIMITS = {
    minInches: 0.5,
    maxInches: 20,
    minDpi: 72,
    maxDpi: 1200,
} as const;

/**
 * The card itself: physical size, resolution, and background.
 * All component positions are stored in inches so the card can be
 * re-rendered at any DPI; this class owns the unit conversions.
 */
export class Card {
    name = 'Untitled';
    widthInches = 2.5;
    heightInches = 3.5;
    dpi = 300;
    backgroundImageData: string | null = null;
    backgroundFit: BackgroundFit = 'cover';

    /** Runtime-only decoded image; never serialized. */
    backgroundImage: HTMLImageElement | null = null;

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

    /** Convert a point size (1/72 in) to canvas pixels at this card's DPI. */
    ptToPx(pt: number): number {
        return pt * (this.dpi / 72);
    }

    async setBackground(dataUrl: string): Promise<void> {
        this.backgroundImage = await loadImage(dataUrl);
        this.backgroundImageData = dataUrl;
    }

    removeBackground(): void {
        this.backgroundImageData = null;
        this.backgroundImage = null;
    }

    /** Decode the stored background data URL into a drawable image. */
    async loadRuntimeImage(): Promise<void> {
        if (!this.backgroundImageData) {
            this.backgroundImage = null;
            return;
        }
        try {
            this.backgroundImage = await loadImage(this.backgroundImageData);
        } catch {
            this.backgroundImage = null;
        }
    }

    toJSON(): CardData {
        return {
            name: this.name,
            widthInches: this.widthInches,
            heightInches: this.heightInches,
            dpi: this.dpi,
            backgroundImageData: this.backgroundImageData,
            backgroundFit: this.backgroundFit,
        };
    }

    /** Build a Card from untrusted data (imports, IndexedDB), clamping to sane ranges. */
    static fromJSON(data: Partial<CardData> | undefined): Card {
        const card = new Card();
        if (!data) return card;
        card.name = typeof data.name === 'string' ? data.name : 'Untitled';
        card.widthInches = clamp(
            toFiniteNumber(data.widthInches, 2.5),
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        card.heightInches = clamp(
            toFiniteNumber(data.heightInches, 3.5),
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        card.dpi = clamp(Math.round(toFiniteNumber(data.dpi, 300)), CARD_LIMITS.minDpi, CARD_LIMITS.maxDpi);
        card.backgroundImageData =
            typeof data.backgroundImageData === 'string' ? data.backgroundImageData : null;
        card.backgroundFit = data.backgroundFit === 'stretch' ? 'stretch' : 'cover';
        return card;
    }
}

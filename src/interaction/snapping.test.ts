import { describe, expect, it } from 'vitest';
import { computeSnap } from './snapping';

const CARD_W = 2.5;
const CARD_H = 3.5;
const THRESHOLD = 0.05;

describe('computeSnap', () => {
    it('snaps the component center to the card center', () => {
        // Component 1in wide; centered would be x = 0.75. Propose slightly off.
        const result = computeSnap(
            { x: 0.78, y: 1, w: 1, h: 0.5 },
            CARD_W,
            CARD_H,
            [],
            THRESHOLD,
        );
        expect(result.x).toBeCloseTo(0.75);
        expect(result.verticalGuideIn).toBeCloseTo(CARD_W / 2);
    });

    it('snaps edges to the card edges', () => {
        const result = computeSnap(
            { x: 0.03, y: 3.02, w: 1, h: 0.5 },
            CARD_W,
            CARD_H,
            [],
            THRESHOLD,
        );
        expect(result.x).toBeCloseTo(0); // left edge to card left
        expect(result.y).toBeCloseTo(3); // bottom edge (3.02 + 0.5 = 3.52) to card bottom 3.5
        expect(result.horizontalGuideIn).toBeCloseTo(CARD_H);
    });

    it('snaps to another component edge', () => {
        const other = { x: 0.5, y: 0.5, w: 1, h: 1 };
        const result = computeSnap(
            { x: 1.53, y: 2, w: 0.8, h: 0.4 },
            CARD_W,
            CARD_H,
            [other],
            THRESHOLD,
        );
        // Left edge 1.53 is near other's right edge 1.5.
        expect(result.x).toBeCloseTo(1.5);
        expect(result.verticalGuideIn).toBeCloseTo(1.5);
    });

    it('does not snap outside the threshold', () => {
        const result = computeSnap(
            { x: 0.6, y: 1.6, w: 1, h: 0.5 },
            CARD_W,
            CARD_H,
            [],
            THRESHOLD,
        );
        expect(result.x).toBe(0.6);
        expect(result.y).toBe(1.6);
        expect(result.verticalGuideIn).toBeNull();
        expect(result.horizontalGuideIn).toBeNull();
    });

    it('prefers the closest line when several are in range', () => {
        // Center at 1.29 is 0.04 from card center (1.25); left edge 0.79... nothing closer.
        // Add another component whose edge at 0.8 is only 0.01 from our left edge 0.79.
        const other = { x: 0.8, y: 0, w: 0.5, h: 0.5 };
        const result = computeSnap(
            { x: 0.79, y: 2, w: 1, h: 0.5 },
            CARD_W,
            CARD_H,
            [other],
            THRESHOLD,
        );
        expect(result.x).toBeCloseTo(0.8);
        expect(result.verticalGuideIn).toBeCloseTo(0.8);
    });
});

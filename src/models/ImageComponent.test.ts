import { describe, expect, it } from 'vitest';
import { Card } from './Card';
import { ImageComponent } from './ImageComponent';

function makeComp(): ImageComponent {
    const comp = new ImageComponent(1, 0, 0, 1, 1);
    // 200x100 fake decoded image; only width/height are read by clampOffsets.
    comp.image = { width: 200, height: 100 } as HTMLImageElement;
    return comp;
}

describe('ImageComponent.clampOffsets', () => {
    it('clamps offsets to the coverable overflow at zoom 1', () => {
        const card = new Card(); // 300 dpi → 1in = 300px square component
        const comp = makeComp();
        // Cover scale = max(300/200, 300/100) = 3 → 600x300 drawn in 300x300.
        // Max X offset = (600-300)/2 = 150; max Y offset = 0.
        comp.imageOffsetX = 9999;
        comp.imageOffsetY = -9999;
        comp.clampOffsets(card);
        expect(comp.imageOffsetX).toBe(150);
        expect(comp.imageOffsetY).toBeCloseTo(0);
    });

    it('allows more panning when zoomed in', () => {
        const card = new Card();
        const comp = makeComp();
        comp.imageScale = 2;
        comp.imageOffsetY = 9999;
        comp.clampOffsets(card);
        // Scaled height = 300*2 = 600 → max Y offset = 150.
        expect(comp.imageOffsetY).toBe(150);
    });

    it('is a no-op without a decoded image', () => {
        const card = new Card();
        const comp = new ImageComponent(1, 0, 0, 1, 1);
        comp.imageOffsetX = 42;
        comp.clampOffsets(card);
        expect(comp.imageOffsetX).toBe(42);
    });
});

describe('ImageComponent serialization', () => {
    it('round-trips through toJSON/fromJSON', () => {
        const comp = new ImageComponent(5, 0.1, 0.2, 1.5, 2);
        comp.imageData = 'data:image/png;base64,AAAA';
        comp.borderWidth = 1;
        comp.cornerRadius = 8;
        comp.imageOffsetX = 10;
        comp.imageOffsetY = -5;
        comp.imageScale = 1.5;

        const restored = ImageComponent.fromJSON(comp.toJSON());
        expect(restored.toJSON()).toEqual(comp.toJSON());
    });

    it('enforces minimum size and scale on malformed data', () => {
        const comp = ImageComponent.fromJSON({ id: 1, width: -3, height: 0, imageScale: 0 });
        expect(comp.width).toBeGreaterThanOrEqual(0.1);
        expect(comp.height).toBeGreaterThanOrEqual(0.1);
        expect(comp.imageScale).toBeGreaterThanOrEqual(0.1);
    });
});

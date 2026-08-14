import { describe, expect, it } from 'vitest';
import {
    computeTargetSize,
    dataUrlBytes,
    formatBytes,
    recommendedMaxDimension,
} from './imageProcessing';

describe('recommendedMaxDimension', () => {
    it('allows 2x the larger card dimension for zoom headroom', () => {
        // 2.5x3.5in @ 300dpi = 750x1050 → 2100
        expect(recommendedMaxDimension(750, 1050)).toBe(2100);
    });

    it('never drops below the floor for tiny cards', () => {
        // 1x1in @ 72dpi = 72x72 → clamped up to 1024
        expect(recommendedMaxDimension(72, 72)).toBe(1024);
    });

    it('caps huge card configurations at the ceiling', () => {
        // 20in @ 1200dpi = 24000 → clamped to 4096
        expect(recommendedMaxDimension(24000, 24000)).toBe(4096);
    });
});

describe('computeTargetSize', () => {
    it('downscales an 8K photo to the max dimension, preserving aspect', () => {
        const t = computeTargetSize(7680, 4320, 2100);
        expect(t.scaled).toBe(true);
        expect(t.width).toBe(2100);
        expect(t.height).toBe(Math.round(4320 * (2100 / 7680)));
    });

    it('scales by the larger dimension for portrait images', () => {
        const t = computeTargetSize(3000, 6000, 2100);
        expect(t.height).toBe(2100);
        expect(t.width).toBe(1050);
    });

    it('never upscales small images', () => {
        const t = computeTargetSize(800, 600, 2100);
        expect(t).toEqual({ width: 800, height: 600, scaled: false });
    });
});

describe('byte helpers', () => {
    it('estimates decoded bytes from base64 length', () => {
        // 4 base64 chars ≈ 3 bytes
        expect(dataUrlBytes('x'.repeat(4000))).toBe(3000);
    });

    it('formats sizes readably', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2 KB');
        expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
    });
});

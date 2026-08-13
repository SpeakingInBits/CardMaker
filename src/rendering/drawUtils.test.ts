import { describe, expect, it } from 'vitest';
import { hexToRgb } from './drawUtils';

describe('hexToRgb', () => {
    it('parses 6-digit hex colors with or without #', () => {
        expect(hexToRgb('#112233')).toEqual({ r: 17, g: 34, b: 51 });
        expect(hexToRgb('ffcc00')).toEqual({ r: 255, g: 204, b: 0 });
    });

    it('falls back to white for invalid input', () => {
        expect(hexToRgb('#12')).toEqual({ r: 255, g: 255, b: 255 });
        expect(hexToRgb('not-a-color')).toEqual({ r: 255, g: 255, b: 255 });
    });
});

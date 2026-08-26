import { describe, expect, it } from 'vitest';
import { clamp, escapeHtml, toFiniteNumber } from './dom';

describe('escapeHtml', () => {
    it('escapes the HTML special characters', () => {
        expect(escapeHtml('<b>"Fish & Chips"</b>')).toBe(
            '&lt;b&gt;&quot;Fish &amp; Chips&quot;&lt;/b&gt;',
        );
    });

    it('escapes ampersands first so entities are not double-escaped', () => {
        expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    });

    it('leaves plain text untouched', () => {
        expect(escapeHtml('Card 1')).toBe('Card 1');
    });
});

describe('clamp', () => {
    it('returns the value when in range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to the bounds', () => {
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(11, 0, 10)).toBe(10);
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
    });
});

describe('toFiniteNumber', () => {
    it('passes finite numbers through', () => {
        expect(toFiniteNumber(3.5, 0)).toBe(3.5);
        expect(toFiniteNumber(0, 9)).toBe(0);
        expect(toFiniteNumber(-2, 9)).toBe(-2);
    });

    it('parses numeric strings', () => {
        expect(toFiniteNumber('2.5', 0)).toBe(2.5);
        expect(toFiniteNumber('  7 ', 0)).toBe(7);
    });

    it('falls back for non-numeric or non-finite input', () => {
        expect(toFiniteNumber('abc', 4)).toBe(4);
        expect(toFiniteNumber(NaN, 4)).toBe(4);
        expect(toFiniteNumber(Infinity, 4)).toBe(4);
        expect(toFiniteNumber(undefined, 4)).toBe(4);
        expect(toFiniteNumber(null, 4)).toBe(4);
        expect(toFiniteNumber({}, 4)).toBe(4);
        expect(toFiniteNumber('', 4)).toBe(4);
    });
});

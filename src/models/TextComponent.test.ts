import { describe, expect, it } from 'vitest';
import { TextComponent, type TextMeasurer } from './TextComponent';

/** Fake measurer: every character is 10px wide. */
const measurer: TextMeasurer = {
    measureText: (text: string) => ({ width: text.length * 10 }),
};

describe('TextComponent.wrapLines', () => {
    it('returns a single line when text fits', () => {
        expect(TextComponent.wrapLines(measurer, 'hello', 100)).toEqual(['hello']);
    });

    it('wraps at word boundaries', () => {
        // "aaa bbb" = 70px > 40px, each word is 30px.
        expect(TextComponent.wrapLines(measurer, 'aaa bbb', 40)).toEqual(['aaa', 'bbb']);
    });

    it('preserves explicit newlines and empty lines', () => {
        expect(TextComponent.wrapLines(measurer, 'a\n\nb', 100)).toEqual(['a', '', 'b']);
    });

    it('breaks words longer than the max width instead of overflowing', () => {
        const lines = TextComponent.wrapLines(measurer, 'abcdefghij', 50);
        expect(lines).toEqual(['abcde', 'fghij']);
        for (const line of lines) {
            expect(measurer.measureText(line).width).toBeLessThanOrEqual(50);
        }
    });

    it('returns one empty line for empty text', () => {
        expect(TextComponent.wrapLines(measurer, '', 100)).toEqual(['']);
    });
});

describe('TextComponent serialization', () => {
    it('round-trips through toJSON/fromJSON', () => {
        const comp = new TextComponent(7, 0.25, 0.5, 2);
        comp.text = 'Hello\nWorld';
        comp.font = 'Georgia';
        comp.fontSize = 18;
        comp.color = '#112233';
        comp.bold = true;
        comp.align = 'center';
        comp.bgColor = '#445566';
        comp.bgOpacity = 0.5;
        comp.borderWidth = 2;
        comp.borderColor = '#778899';
        comp.padding = 6;
        comp.height = 1.5;

        const restored = TextComponent.fromJSON(comp.toJSON());
        expect(restored.toJSON()).toEqual(comp.toJSON());
    });

    it('fills safe defaults for missing or malformed fields', () => {
        const comp = TextComponent.fromJSON({
            id: 3,
            fontSize: Number.NaN,
            align: 'diagonal' as never,
            height: -2,
        });
        expect(comp.id).toBe(3);
        expect(comp.fontSize).toBe(24);
        expect(comp.align).toBe('left');
        expect(comp.height).toBeNull();
        expect(comp.width).toBeGreaterThanOrEqual(0.25);
    });
});

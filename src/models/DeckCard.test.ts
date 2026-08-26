import { describe, expect, it } from 'vitest';
import { DeckCard, MAX_COPIES } from './DeckCard';

describe('DeckCard', () => {
    it('starts with one copy and empty front/back faces', () => {
        const card = new DeckCard(1, 'Hero');
        expect(card.id).toBe(1);
        expect(card.name).toBe('Hero');
        expect(card.copies).toBe(1);
        expect(card.faces.front.components).toHaveLength(0);
        expect(card.faces.back.components).toHaveLength(0);
    });

    it('round-trips through JSON', () => {
        const card = new DeckCard(7, 'Dragon');
        card.copies = 4;
        const restored = DeckCard.fromJSON(card.toJSON());
        expect(restored.toJSON()).toEqual(card.toJSON());
    });

    describe('fromJSON with untrusted data', () => {
        it('defaults a missing or blank name', () => {
            expect(DeckCard.fromJSON({ id: 1 }).name).toBe('Card');
            expect(DeckCard.fromJSON({ id: 1, name: '   ' }).name).toBe('Card');
        });

        it('clamps copies to 1..MAX_COPIES and rounds fractions', () => {
            expect(DeckCard.fromJSON({ copies: 0 }).copies).toBe(1);
            expect(DeckCard.fromJSON({ copies: -5 }).copies).toBe(1);
            expect(DeckCard.fromJSON({ copies: MAX_COPIES + 100 }).copies).toBe(MAX_COPIES);
            expect(DeckCard.fromJSON({ copies: 2.6 }).copies).toBe(3);
            expect(DeckCard.fromJSON({ copies: NaN }).copies).toBe(1);
        });

        it('builds empty faces when the faces field is missing', () => {
            const card = DeckCard.fromJSON({ id: 3, name: 'X' });
            expect(card.faces.front.components).toHaveLength(0);
            expect(card.faces.back.components).toHaveLength(0);
        });

        it('restores components on both faces', () => {
            const card = new DeckCard(1, 'A');
            const data = card.toJSON();
            data.faces.front.components.push({
                id: 10,
                type: 'text',
                x: 0.5,
                y: 0.5,
                width: 1.5,
                borderWidth: 0,
                borderColor: '#000000',
                text: 'Front title',
                font: 'Arial',
                fontSize: 20,
                color: '#111111',
                bold: true,
                italic: false,
                underline: false,
                align: 'center',
                bgColor: '#ffffff',
                bgOpacity: 0,
                padding: 4,
                height: null,
            });

            const restored = DeckCard.fromJSON(data);
            expect(restored.faces.front.components).toHaveLength(1);
            expect(restored.faces.front.components[0].type).toBe('text');
        });
    });
});

import { describe, expect, it } from 'vitest';
import { Deck } from './Deck';
import { CardDocument, TEMPLATE_VERSION } from './CardDocument';
import type { LegacyTemplateData, TextComponentData } from '../types';

function textData(id: number, text: string): TextComponentData {
    return {
        id,
        type: 'text',
        x: 0,
        y: 0,
        width: 1,
        borderWidth: 0,
        borderColor: '#000000',
        text,
        font: 'Arial',
        fontSize: 24,
        color: '#000000',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        bgColor: '#ffffff',
        bgOpacity: 0,
        padding: 4,
        height: null,
    };
}

describe('Deck.fromJSON', () => {
    it('clamps out-of-range values', () => {
        const deck = Deck.fromJSON({ widthInches: 999, heightInches: -1, dpi: 10 });
        expect(deck.widthInches).toBe(20);
        expect(deck.heightInches).toBe(0.5);
        expect(deck.dpi).toBe(72);
    });

    it('keeps valid values as-is', () => {
        const deck = Deck.fromJSON({ widthInches: 3, heightInches: 4, dpi: 600, name: 'Poker' });
        expect(deck.widthInches).toBe(3);
        expect(deck.heightInches).toBe(4);
        expect(deck.dpi).toBe(600);
        expect(deck.name).toBe('Poker');
    });
});

describe('CardDocument deck operations', () => {
    it('starts with one card and can add more', () => {
        const doc = new CardDocument();
        expect(doc.cards).toHaveLength(1);
        const added = doc.addCard();
        expect(doc.cards).toHaveLength(2);
        expect(doc.activeCardId).toBe(added.id);
    });

    it('refuses to remove the last card', () => {
        const doc = new CardDocument();
        expect(doc.removeCard(doc.cards[0].id)).toBe(false);
        doc.addCard();
        expect(doc.removeCard(doc.cards[0].id)).toBe(true);
        expect(doc.cards).toHaveLength(1);
    });

    it('duplicates a card with fresh component ids', async () => {
        const doc = new CardDocument();
        const original = doc.cards[0];
        const comp = doc.addText();
        comp.text = 'Front text';
        doc.setActiveFace('back');
        doc.addText().text = 'Back text';

        const copy = await doc.duplicateCard(original.id);
        expect(copy).not.toBeNull();
        expect(doc.cards).toHaveLength(2);
        expect(copy!.name).toBe(`${original.name} copy`);
        expect(copy!.faces.front.components).toHaveLength(1);
        expect(copy!.faces.back.components).toHaveLength(1);

        const originalIds = new Set(
            [...original.faces.front.components, ...original.faces.back.components].map((c) => c.id),
        );
        for (const c of [...copy!.faces.front.components, ...copy!.faces.back.components]) {
            expect(originalIds.has(c.id)).toBe(false);
        }
    });

    it('tracks copies in the total print count', () => {
        const doc = new CardDocument();
        doc.cards[0].copies = 3;
        doc.addCard().copies = 2;
        expect(doc.totalPrintCount).toBe(5);
    });
});

describe('CardDocument faces and components', () => {
    it('keeps front and back component lists separate', () => {
        const doc = new CardDocument();
        doc.addText().text = 'front';
        doc.setActiveFace('back');
        expect(doc.components).toHaveLength(0);
        doc.addText().text = 'back';
        expect(doc.components).toHaveLength(1);
        doc.setActiveFace('front');
        expect(doc.components[0].label).toBe('front');
    });

    it('clears selection when switching cards or faces', () => {
        const doc = new CardDocument();
        doc.addText();
        expect(doc.selectedId).not.toBeNull();
        doc.setActiveFace('back');
        expect(doc.selectedId).toBeNull();
    });
});

describe('CardDocument serialization', () => {
    it('round-trips a multi-card deck through serialize/load', async () => {
        const doc = new CardDocument();
        doc.deck.name = 'My Deck';
        doc.addText().text = 'Hero card';
        doc.setActiveFace('back');
        doc.addText().text = 'Card back';
        doc.addCard();
        doc.cards[1].copies = 4;

        const data = doc.serialize();
        expect(data.version).toBe(TEMPLATE_VERSION);

        const reloaded = new CardDocument();
        await reloaded.load(data);
        expect(reloaded.deck.name).toBe('My Deck');
        expect(reloaded.cards).toHaveLength(2);
        expect(reloaded.cards[0].faces.front.components).toHaveLength(1);
        expect(reloaded.cards[0].faces.back.components).toHaveLength(1);
        expect(reloaded.cards[1].copies).toBe(4);
        expect(reloaded.serialize()).toEqual(data);
    });

    it('migrates legacy v2 single-card templates', async () => {
        const legacy: LegacyTemplateData = {
            version: 2,
            card: {
                name: 'Old Template',
                widthInches: 3,
                heightInches: 4,
                dpi: 150,
                backgroundImageData: null,
                backgroundFit: 'stretch',
            },
            components: [textData(41, 'legacy text')],
            nextId: 42,
        };

        const doc = new CardDocument();
        await doc.load(legacy);
        expect(doc.deck.name).toBe('Old Template');
        expect(doc.deck.dpi).toBe(150);
        expect(doc.cards).toHaveLength(1);
        expect(doc.cards[0].faces.front.backgroundFit).toBe('stretch');
        expect(doc.cards[0].faces.front.components).toHaveLength(1);
        expect(doc.cards[0].faces.back.components).toHaveLength(0);

        // New component ids continue past the legacy ones.
        const added = doc.addText();
        expect(added.id).toBe(42);
    });

    it('skips unknown component types when loading', async () => {
        const doc = new CardDocument();
        doc.addText().text = 'Keep me';
        const data = doc.serialize();
        data.cards[0].faces.front.components.push({ type: 'hologram' } as never);

        const reloaded = new CardDocument();
        await reloaded.load(data);
        expect(reloaded.cards[0].faces.front.components).toHaveLength(1);
    });
});

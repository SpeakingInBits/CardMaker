import { describe, expect, it } from 'vitest';
import { Card } from './Card';
import { CardDocument, TEMPLATE_VERSION } from './CardDocument';
import type { TemplateData } from '../types';

describe('Card.fromJSON', () => {
    it('clamps out-of-range values', () => {
        const card = Card.fromJSON({
            widthInches: 999,
            heightInches: -1,
            dpi: 10,
            backgroundFit: 'sideways' as never,
        });
        expect(card.widthInches).toBe(20);
        expect(card.heightInches).toBe(0.5);
        expect(card.dpi).toBe(72);
        expect(card.backgroundFit).toBe('cover');
    });

    it('keeps valid values as-is', () => {
        const card = Card.fromJSON({ widthInches: 3, heightInches: 4, dpi: 600, name: 'Poker' });
        expect(card.widthInches).toBe(3);
        expect(card.heightInches).toBe(4);
        expect(card.dpi).toBe(600);
        expect(card.name).toBe('Poker');
    });
});

describe('CardDocument', () => {
    it('adds text components with sequential ids and selects them', () => {
        const doc = new CardDocument();
        const a = doc.addText();
        const b = doc.addText();
        expect(a.id).toBe(1);
        expect(b.id).toBe(2);
        expect(doc.selectedId).toBe(b.id);
    });

    it('moves components within the z-order and clamps at the ends', () => {
        const doc = new CardDocument();
        const a = doc.addText();
        const b = doc.addText();
        doc.move(a.id, 1);
        expect(doc.components.map((c) => c.id)).toEqual([b.id, a.id]);
        doc.move(a.id, 1); // already at the end — no change
        expect(doc.components.map((c) => c.id)).toEqual([b.id, a.id]);
    });

    it('removes components and clears selection when the selected one is removed', () => {
        const doc = new CardDocument();
        const a = doc.addText();
        doc.remove(a.id);
        expect(doc.components).toHaveLength(0);
        expect(doc.selectedId).toBeNull();
    });

    it('serializes and reloads a document, skipping unknown component types', async () => {
        const doc = new CardDocument();
        doc.addText().text = 'Keep me';
        const data = doc.serialize();
        expect(data.version).toBe(TEMPLATE_VERSION);

        data.components.push({ type: 'hologram' } as never);
        const reloaded = new CardDocument();
        await reloaded.load(data);
        expect(reloaded.components).toHaveLength(1);
        expect(reloaded.components[0].label).toContain('Keep me');
    });

    it('recovers nextId from component ids when missing', async () => {
        const doc = new CardDocument();
        const data: TemplateData = {
            version: 2,
            card: new Card().toJSON(),
            components: [
                {
                    id: 41,
                    type: 'text',
                    x: 0,
                    y: 0,
                    width: 1,
                    borderWidth: 0,
                    borderColor: '#000000',
                    text: 'hi',
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
                },
            ],
            nextId: undefined as never,
        };
        await doc.load(data);
        const added = doc.addText();
        expect(added.id).toBe(42);
    });
});

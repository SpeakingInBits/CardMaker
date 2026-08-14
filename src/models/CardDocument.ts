import type { AnyTemplateData, FaceId, LegacyTemplateData, TemplateData } from '../types';
import { toFiniteNumber } from '../utils/dom';
import { CardFace } from './CardFace';
import { CardComponent } from './CardComponent';
import { Deck } from './Deck';
import { DeckCard } from './DeckCard';
import { ImageComponent } from './ImageComponent';
import { TextComponent } from './TextComponent';

export const TEMPLATE_VERSION = 3;
export const MAX_CARDS = 200;

/**
 * The full editable project: deck-wide settings plus a list of cards,
 * each with a front and back face. Editing operations target the active
 * card's active face.
 */
export class CardDocument {
    deck = new Deck();
    cards: DeckCard[] = [];
    activeCardId: number;
    activeFaceId: FaceId = 'front';
    selectedId: number | null = null;

    private nextCardId = 1;
    private nextComponentId = 1;

    constructor() {
        const first = new DeckCard(this.nextCardId++, 'Card 1');
        this.cards.push(first);
        this.activeCardId = first.id;
    }

    // ---------- Active card / face ----------
    get activeCard(): DeckCard {
        return this.cards.find((c) => c.id === this.activeCardId) ?? this.cards[0];
    }

    get activeFace(): CardFace {
        return this.activeCard.faces[this.activeFaceId];
    }

    /** Components of the active face (what the canvas edits). */
    get components(): CardComponent[] {
        return this.activeFace.components;
    }

    setActiveCard(id: number): void {
        if (id === this.activeCardId || !this.cards.some((c) => c.id === id)) return;
        this.activeCardId = id;
        this.selectedId = null;
    }

    setActiveFace(face: FaceId): void {
        if (face === this.activeFaceId) return;
        this.activeFaceId = face;
        this.selectedId = null;
    }

    // ---------- Deck card operations ----------
    addCard(): DeckCard {
        const card = new DeckCard(this.nextCardId++, `Card ${this.cards.length + 1}`);
        this.cards.push(card);
        this.activeCardId = card.id;
        this.selectedId = null;
        return card;
    }

    /** Deep-copy a card (fresh component ids) and insert it after the original. */
    async duplicateCard(id: number): Promise<DeckCard | null> {
        const source = this.cards.find((c) => c.id === id);
        if (!source) return null;

        const copy = DeckCard.fromJSON(source.toJSON());
        copy.id = this.nextCardId++;
        copy.name = `${source.name} copy`;
        for (const faceId of ['front', 'back'] as const) {
            for (const comp of copy.faces[faceId].components) {
                comp.id = this.nextComponentId++;
            }
        }
        await copy.loadRuntimeImages();

        this.cards.splice(this.cards.indexOf(source) + 1, 0, copy);
        this.activeCardId = copy.id;
        this.selectedId = null;
        return copy;
    }

    /** Remove a card; the last remaining card cannot be removed. */
    removeCard(id: number): boolean {
        if (this.cards.length <= 1) return false;
        const idx = this.cards.findIndex((c) => c.id === id);
        if (idx < 0) return false;
        this.cards.splice(idx, 1);
        if (this.activeCardId === id) {
            this.activeCardId = this.cards[Math.min(idx, this.cards.length - 1)].id;
            this.selectedId = null;
        }
        return true;
    }

    /** Total number of physical cards on the print sheet (sum of copies). */
    get totalPrintCount(): number {
        return this.cards.reduce((sum, c) => sum + c.copies, 0);
    }

    // ---------- Component operations (active face) ----------
    get selected(): CardComponent | null {
        return this.selectedId != null ? this.get(this.selectedId) : null;
    }

    get(id: number): CardComponent | null {
        return this.components.find((c) => c.id === id) ?? null;
    }

    select(id: number | null): void {
        this.selectedId = id;
    }

    addText(): TextComponent {
        const textCount = this.components.filter((c) => c.type === 'text').length;
        const comp = new TextComponent(
            this.nextComponentId++,
            this.deck.widthInches * 0.1,
            0.25 + textCount * 0.5,
            this.deck.widthInches * 0.8,
        );
        this.components.push(comp);
        this.selectedId = comp.id;
        return comp;
    }

    /** Add an already-decoded image, sized to fit within 60% x 50% of the card. */
    addImage(image: HTMLImageElement, dataUrl: string): ImageComponent {
        const maxW = this.deck.widthInches * 0.6;
        const maxH = this.deck.heightInches * 0.5;
        const aspect = image.width / image.height;
        let w = maxW;
        let h = maxW / aspect;
        if (h > maxH) {
            h = maxH;
            w = maxH * aspect;
        }

        const comp = new ImageComponent(
            this.nextComponentId++,
            (this.deck.widthInches - w) / 2,
            (this.deck.heightInches - h) / 2,
            w,
            h,
        );
        comp.imageData = dataUrl;
        comp.image = image;
        this.components.push(comp);
        this.selectedId = comp.id;
        return comp;
    }

    remove(id: number): void {
        this.activeFace.components = this.components.filter((c) => c.id !== id);
        if (this.selectedId === id) this.selectedId = null;
    }

    /** Move a component up (-1) or down (+1) in the z-order list. */
    move(id: number, dir: -1 | 1): void {
        const list = this.components;
        const idx = list.findIndex((c) => c.id === id);
        const to = idx + dir;
        if (idx < 0 || to < 0 || to >= list.length) return;
        [list[idx], list[to]] = [list[to], list[idx]];
    }

    /** Topmost component whose body contains the given canvas-pixel point. */
    topmostAt(px: number, py: number): CardComponent | null {
        const list = this.components;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].hitTest(this.deck, px, py)) return list[i];
        }
        return null;
    }

    // ---------- Serialization ----------
    serialize(): TemplateData {
        return {
            version: TEMPLATE_VERSION,
            deck: this.deck.toJSON(),
            cards: this.cards.map((c) => c.toJSON()),
            nextCardId: this.nextCardId,
            nextComponentId: this.nextComponentId,
        };
    }

    /** Replace the document with untrusted template data (v3 or legacy v2). */
    async load(data: AnyTemplateData): Promise<void> {
        const v3 = CardDocument.migrate(data);

        this.deck = Deck.fromJSON(v3.deck);
        this.cards = (Array.isArray(v3.cards) ? v3.cards : [])
            .slice(0, MAX_CARDS)
            .map((c) => DeckCard.fromJSON(c));
        if (!this.cards.length) this.cards.push(new DeckCard(1, 'Card 1'));

        const maxCardId = this.cards.reduce((m, c) => Math.max(m, c.id), 0);
        const maxCompId = this.cards.reduce(
            (m, c) =>
                Math.max(
                    m,
                    ...c.faces.front.components.map((x) => x.id),
                    ...c.faces.back.components.map((x) => x.id),
                    0,
                ),
            0,
        );
        this.nextCardId = Math.max(Math.round(toFiniteNumber(v3.nextCardId, 0)), maxCardId + 1, 1);
        this.nextComponentId = Math.max(
            Math.round(toFiniteNumber(v3.nextComponentId, 0)),
            maxCompId + 1,
            1,
        );

        this.activeCardId = this.cards[0].id;
        this.activeFaceId = 'front';
        this.selectedId = null;

        await Promise.all(this.cards.map((c) => c.loadRuntimeImages()));
    }

    /** Convert legacy (v2 single-card) template data to the v3 deck shape. */
    static migrate(data: AnyTemplateData): TemplateData {
        if ('deck' in data && data.deck) return data as TemplateData;

        const legacy = data as LegacyTemplateData;
        const legacyCard = legacy.card ?? ({} as LegacyTemplateData['card']);
        return {
            version: TEMPLATE_VERSION,
            deck: {
                name: typeof legacyCard.name === 'string' ? legacyCard.name : 'Untitled',
                widthInches: legacyCard.widthInches,
                heightInches: legacyCard.heightInches,
                dpi: legacyCard.dpi,
            },
            cards: [
                {
                    id: 1,
                    name: 'Card 1',
                    copies: 1,
                    faces: {
                        front: {
                            backgroundImageData: legacyCard.backgroundImageData ?? null,
                            backgroundFit: legacyCard.backgroundFit ?? 'cover',
                            components: Array.isArray(legacy.components) ? legacy.components : [],
                        },
                        back: { backgroundImageData: null, backgroundFit: 'cover', components: [] },
                    },
                },
            ],
            nextCardId: 2,
            nextComponentId: Math.max(Math.round(toFiniteNumber(legacy.nextId, 1)), 1),
        };
    }
}

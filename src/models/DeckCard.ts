import type { DeckCardData, FaceId } from '../types';
import { clamp, toFiniteNumber } from '../utils/dom';
import { CardFace } from './CardFace';

export const MAX_COPIES = 500;

/** One card design in the deck: a named front/back pair with a print count. */
export class DeckCard {
    id: number;
    name: string;
    copies = 1;
    faces: Record<FaceId, CardFace> = { front: new CardFace(), back: new CardFace() };

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }

    async loadRuntimeImages(): Promise<void> {
        await Promise.all([this.faces.front.loadRuntimeImages(), this.faces.back.loadRuntimeImages()]);
    }

    toJSON(): DeckCardData {
        return {
            id: this.id,
            name: this.name,
            copies: this.copies,
            faces: { front: this.faces.front.toJSON(), back: this.faces.back.toJSON() },
        };
    }

    static fromJSON(data: Partial<DeckCardData>): DeckCard {
        const card = new DeckCard(
            toFiniteNumber(data.id, 0),
            typeof data.name === 'string' && data.name.trim() ? data.name : 'Card',
        );
        card.copies = clamp(Math.round(toFiniteNumber(data.copies, 1)), 1, MAX_COPIES);
        card.faces = {
            front: CardFace.fromJSON(data.faces?.front),
            back: CardFace.fromJSON(data.faces?.back),
        };
        return card;
    }
}

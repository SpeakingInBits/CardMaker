import type { ComponentData, TemplateData } from '../types';
import { toFiniteNumber } from '../utils/dom';
import { Card } from './Card';
import { CardComponent } from './CardComponent';
import { ImageComponent } from './ImageComponent';
import { TextComponent } from './TextComponent';

export const TEMPLATE_VERSION = 2;

function componentFromJSON(data: ComponentData): CardComponent | null {
    if (!data || typeof data !== 'object') return null;
    if (data.type === 'text') return TextComponent.fromJSON(data);
    if (data.type === 'image') return ImageComponent.fromJSON(data);
    return null;
}

/**
 * The full editable document: the card plus its ordered components
 * (first = bottom of the z-order) and the current selection.
 */
export class CardDocument {
    card = new Card();
    components: CardComponent[] = [];
    selectedId: number | null = null;
    private nextId = 1;

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
            this.nextId++,
            this.card.widthInches * 0.1,
            0.25 + textCount * 0.5,
            this.card.widthInches * 0.8,
        );
        this.components.push(comp);
        this.selectedId = comp.id;
        return comp;
    }

    /** Add an already-decoded image, sized to fit within 60% x 50% of the card. */
    addImage(image: HTMLImageElement, dataUrl: string): ImageComponent {
        const maxW = this.card.widthInches * 0.6;
        const maxH = this.card.heightInches * 0.5;
        const aspect = image.width / image.height;
        let w = maxW;
        let h = maxW / aspect;
        if (h > maxH) {
            h = maxH;
            w = maxH * aspect;
        }

        const comp = new ImageComponent(
            this.nextId++,
            (this.card.widthInches - w) / 2,
            (this.card.heightInches - h) / 2,
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
        this.components = this.components.filter((c) => c.id !== id);
        if (this.selectedId === id) this.selectedId = null;
    }

    /** Move a component up (-1) or down (+1) in the z-order list. */
    move(id: number, dir: -1 | 1): void {
        const idx = this.components.findIndex((c) => c.id === id);
        const to = idx + dir;
        if (idx < 0 || to < 0 || to >= this.components.length) return;
        [this.components[idx], this.components[to]] = [this.components[to], this.components[idx]];
    }

    /** Topmost component whose body contains the given canvas-pixel point. */
    topmostAt(px: number, py: number): CardComponent | null {
        for (let i = this.components.length - 1; i >= 0; i--) {
            if (this.components[i].hitTest(this.card, px, py)) return this.components[i];
        }
        return null;
    }

    serialize(): TemplateData {
        return {
            version: TEMPLATE_VERSION,
            card: this.card.toJSON(),
            components: this.components.map((c) => c.toJSON()),
            nextId: this.nextId,
        };
    }

    /** Replace the document with untrusted template data and decode its images. */
    async load(data: TemplateData): Promise<void> {
        this.card = Card.fromJSON(data.card);
        this.components = (Array.isArray(data.components) ? data.components : [])
            .map(componentFromJSON)
            .filter((c): c is CardComponent => c !== null);

        const maxId = this.components.reduce((m, c) => Math.max(m, c.id), 0);
        this.nextId = Math.max(Math.round(toFiniteNumber(data.nextId, 0)), maxId + 1, 1);
        this.selectedId = null;

        await this.loadRuntimeImages();
    }

    /** Decode all stored image data URLs into drawable images. */
    async loadRuntimeImages(): Promise<void> {
        const jobs: Promise<void>[] = [this.card.loadRuntimeImage()];
        for (const comp of this.components) {
            if (comp instanceof ImageComponent) jobs.push(comp.loadRuntimeImage());
        }
        await Promise.all(jobs);
    }
}

import type { Bounds, ComponentData, ComponentType, HandleId, Point } from '../types';
import type { Card } from './Card';

/** Component geometry captured at the start of a resize drag (inches). */
export interface ResizeOrigin {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Base class for everything that can be placed on a card.
 * Subclasses own their drawing, bounds, hit-testing handles,
 * resize behavior, and (de)serialization.
 */
export abstract class CardComponent {
    abstract readonly type: ComponentType;

    id: number;
    /** Position and width in inches. */
    x: number;
    y: number;
    width: number;
    borderWidth = 0;
    borderColor = '#000000';

    protected constructor(id: number, x: number, y: number, width: number) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
    }

    /** Short label shown in the component list. */
    abstract get label(): string;

    /** Which resize handles this component exposes, in hit-test priority order. */
    abstract get handles(): readonly HandleId[];

    abstract draw(ctx: CanvasRenderingContext2D, card: Card): void;

    /** Pixel-space bounds on the card canvas. */
    abstract getBounds(card: Card): Bounds;

    abstract applyResize(handle: HandleId, origin: ResizeOrigin, dxIn: number, dyIn: number): void;

    abstract toJSON(): ComponentData;

    getResizeOrigin(card: Card): ResizeOrigin {
        const bounds = this.getBounds(card);
        return { x: this.x, y: this.y, w: this.width, h: card.pxToIn(bounds.h) };
    }

    /** Is the given canvas-pixel point inside this component's body? */
    hitTest(card: Card, px: number, py: number): boolean {
        const { x, y, w, h } = this.getBounds(card);
        return px >= x && px <= x + w && py >= y && py <= y + h;
    }

    /** Canvas-pixel position of a resize handle on the given bounds. */
    handlePoint(bounds: Bounds, handle: HandleId): Point {
        const { x, y, w, h } = bounds;
        switch (handle) {
            case 'tl':
                return { x, y };
            case 'tr':
                return { x: x + w, y };
            case 'bl':
                return { x, y: y + h };
            case 'br':
                return { x: x + w, y: y + h };
            case 'b':
                return { x: x + w / 2, y: y + h };
            case 'r':
                return { x: x + w, y: y + h / 2 };
        }
    }

    /** Which handle (if any) is within tolerance of the given canvas-pixel point. */
    hitHandle(card: Card, px: number, py: number, tolerance: number): HandleId | null {
        const bounds = this.getBounds(card);
        for (const handle of this.handles) {
            const p = this.handlePoint(bounds, handle);
            if (Math.abs(px - p.x) < tolerance && Math.abs(py - p.y) < tolerance) {
                return handle;
            }
        }
        return null;
    }
}

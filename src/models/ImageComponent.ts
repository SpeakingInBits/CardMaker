import type { Bounds, HandleId, ImageComponentData } from '../types';
import { loadImage, toFiniteNumber } from '../utils/dom';
import { drawCover, roundedRectPath } from '../rendering/drawUtils';
import { Deck } from './Deck';
import { CardComponent, type ResizeOrigin } from './CardComponent';

const MIN_SIZE_IN = 0.1;

export class ImageComponent extends CardComponent {
    readonly type = 'image' as const;

    /** Height in inches (images always have an explicit height). */
    height: number;
    imageData: string | null = null;
    /** Runtime-only decoded image; never serialized. */
    image: HTMLImageElement | null = null;
    /** Corner radius in points. */
    cornerRadius = 0;
    /** Content pan offset in canvas px. */
    imageOffsetX = 0;
    imageOffsetY = 0;
    imageScale = 1;

    constructor(id: number, x: number, y: number, width: number, height: number) {
        super(id, x, y, width);
        this.height = height;
    }

    get label(): string {
        return 'Image';
    }

    get handles(): readonly HandleId[] {
        return ['tl', 'tr', 'bl', 'br', 'b', 'r'];
    }

    async setImage(dataUrl: string): Promise<void> {
        this.image = await loadImage(dataUrl);
        this.imageData = dataUrl;
    }

    /** Decode the stored data URL into a drawable image. */
    async loadRuntimeImage(): Promise<void> {
        if (!this.imageData) {
            this.image = null;
            return;
        }
        try {
            this.image = await loadImage(this.imageData);
        } catch {
            this.image = null;
        }
    }

    /** Keep pan offsets within the range allowed by the current size and zoom. */
    clampOffsets(deck: Deck): void {
        if (!this.image) return;
        const w = deck.inToPx(this.width);
        const h = deck.inToPx(this.height);
        const s = Math.max(w / this.image.width, h / this.image.height) * (this.imageScale || 1);
        const sw = this.image.width * s;
        const sh = this.image.height * s;
        const maxOx = Math.max(0, (sw - w) / 2);
        const maxOy = Math.max(0, (sh - h) / 2);
        this.imageOffsetX = Math.max(-maxOx, Math.min(maxOx, this.imageOffsetX || 0));
        this.imageOffsetY = Math.max(-maxOy, Math.min(maxOy, this.imageOffsetY || 0));
    }

    draw(ctx: CanvasRenderingContext2D, deck: Deck): void {
        const x = deck.inToPx(this.x);
        const y = deck.inToPx(this.y);
        const w = deck.inToPx(this.width);
        const h = deck.inToPx(this.height);
        const r = this.cornerRadius > 0 ? deck.ptToPx(this.cornerRadius) : 0;

        if (this.image) {
            ctx.save();
            ctx.beginPath();
            if (r > 0) roundedRectPath(ctx, x, y, w, h, r);
            else ctx.rect(x, y, w, h);
            ctx.clip();
            drawCover(ctx, this.image, x, y, w, h, this.imageOffsetX, this.imageOffsetY, this.imageScale || 1);
            ctx.restore();
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.fillStyle = '#e0e0e0';
            if (r > 0) {
                roundedRectPath(ctx, x, y, w, h, r);
                ctx.fill();
            } else {
                ctx.fillRect(x, y, w, h);
            }
            ctx.restore();
            ctx.fillStyle = '#999';
            ctx.font = `${Math.max(14, Math.min(w, h) * 0.08)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Image', x + w / 2, y + h / 2);
            ctx.textAlign = 'left';
        }

        if (this.borderWidth > 0) {
            ctx.save();
            const bw = deck.ptToPx(this.borderWidth);
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = bw;
            if (r > 0) {
                ctx.beginPath();
                roundedRectPath(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2));
                ctx.stroke();
            } else {
                ctx.strokeRect(x + bw / 2, y + bw / 2, w - bw, h - bw);
            }
            ctx.restore();
        }
    }

    getBounds(deck: Deck): Bounds {
        return {
            x: deck.inToPx(this.x),
            y: deck.inToPx(this.y),
            w: deck.inToPx(this.width),
            h: deck.inToPx(this.height),
        };
    }

    applyResize(handle: HandleId, origin: ResizeOrigin, dxIn: number, dyIn: number): void {
        switch (handle) {
            case 'br':
                this.width = Math.max(MIN_SIZE_IN, origin.w + dxIn);
                this.height = Math.max(MIN_SIZE_IN, origin.h + dyIn);
                break;
            case 'bl':
                this.x = origin.x + dxIn;
                this.width = Math.max(MIN_SIZE_IN, origin.w - dxIn);
                this.height = Math.max(MIN_SIZE_IN, origin.h + dyIn);
                break;
            case 'tr':
                this.y = origin.y + dyIn;
                this.width = Math.max(MIN_SIZE_IN, origin.w + dxIn);
                this.height = Math.max(MIN_SIZE_IN, origin.h - dyIn);
                break;
            case 'tl':
                this.x = origin.x + dxIn;
                this.y = origin.y + dyIn;
                this.width = Math.max(MIN_SIZE_IN, origin.w - dxIn);
                this.height = Math.max(MIN_SIZE_IN, origin.h - dyIn);
                break;
            case 'b':
                this.height = Math.max(MIN_SIZE_IN, origin.h + dyIn);
                break;
            case 'r':
                this.width = Math.max(MIN_SIZE_IN, origin.w + dxIn);
                break;
        }
    }

    toJSON(): ImageComponentData {
        return {
            id: this.id,
            type: 'image',
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            borderWidth: this.borderWidth,
            borderColor: this.borderColor,
            imageData: this.imageData,
            cornerRadius: this.cornerRadius,
            imageOffsetX: this.imageOffsetX,
            imageOffsetY: this.imageOffsetY,
            imageScale: this.imageScale,
        };
    }

    static fromJSON(data: Partial<ImageComponentData>): ImageComponent {
        const comp = new ImageComponent(
            toFiniteNumber(data.id, 0),
            toFiniteNumber(data.x, 0),
            toFiniteNumber(data.y, 0),
            Math.max(MIN_SIZE_IN, toFiniteNumber(data.width, 1)),
            Math.max(MIN_SIZE_IN, toFiniteNumber(data.height, 1)),
        );
        comp.imageData = typeof data.imageData === 'string' ? data.imageData : null;
        comp.borderWidth = toFiniteNumber(data.borderWidth, 0);
        comp.borderColor = typeof data.borderColor === 'string' ? data.borderColor : '#000000';
        comp.cornerRadius = toFiniteNumber(data.cornerRadius, 0);
        comp.imageOffsetX = toFiniteNumber(data.imageOffsetX, 0);
        comp.imageOffsetY = toFiniteNumber(data.imageOffsetY, 0);
        comp.imageScale = Math.max(0.1, toFiniteNumber(data.imageScale, 1));
        return comp;
    }
}

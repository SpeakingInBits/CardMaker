import type { CardDocument } from '../models/CardDocument';
import type { CardComponent } from '../models/CardComponent';
import { drawCover } from './drawUtils';

const SELECTION_COLOR = '#4a90d9';

/** Draws the document onto the editor canvas. */
export class CardRenderer {
    private readonly ctx: CanvasRenderingContext2D;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly doc: CardDocument,
    ) {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        this.ctx = ctx;
    }

    /** Match the canvas pixel size to the card's physical size at its DPI. */
    resizeToCard(): void {
        this.canvas.width = this.doc.card.pxWidth;
        this.canvas.height = this.doc.card.pxHeight;
    }

    render(showHandles = true): void {
        const { ctx } = this;
        const card = this.doc.card;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        if (card.backgroundImage) {
            if (card.backgroundFit === 'stretch') {
                ctx.drawImage(card.backgroundImage, 0, 0, w, h);
            } else {
                drawCover(ctx, card.backgroundImage, 0, 0, w, h);
            }
        }

        for (const comp of this.doc.components) {
            comp.draw(ctx, card);
        }

        if (showHandles && this.doc.selected) {
            this.drawSelection(this.doc.selected);
        }
    }

    /** Render without selection UI and return a PNG data URL. */
    exportPngDataUrl(): string {
        this.render(false);
        const url = this.canvas.toDataURL('image/png');
        this.render(true);
        return url;
    }

    /** Size of resize handles in canvas px, scaled with DPI. */
    handleSize(): number {
        return Math.max(10, this.doc.card.dpi / 22);
    }

    private drawSelection(comp: CardComponent): void {
        const { ctx } = this;
        const bounds = comp.getBounds(this.doc.card);
        const { x, y, w, h } = bounds;
        const dash = Math.max(4, this.doc.card.dpi / 40);
        const lineWidth = Math.max(2, this.doc.card.dpi / 120);

        ctx.save();
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([dash, dash * 0.6]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.restore();

        const hs = this.handleSize();
        for (const handle of comp.handles) {
            const p = comp.handlePoint(bounds, handle);
            this.drawHandle(p.x - hs / 2, p.y - hs / 2, hs);
        }
    }

    private drawHandle(x: number, y: number, size: number): void {
        const { ctx } = this;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = Math.max(1, size / 5);
        ctx.strokeRect(x, y, size, size);
    }
}

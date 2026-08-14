import type { CardDocument } from '../models/CardDocument';
import type { CardComponent } from '../models/CardComponent';
import { renderFace } from './faceRenderer';

const SELECTION_COLOR = '#4a90d9';
const GUIDE_COLOR = '#e94560';

/** Alignment guide line to overlay on the canvas, in canvas pixels. */
export interface GuideLine {
    orientation: 'v' | 'h';
    positionPx: number;
}

/** Draws the active face of the active card onto the editor canvas. */
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

    /** Match the canvas pixel size to the deck's card size at its DPI. */
    resizeToCard(): void {
        this.canvas.width = this.doc.deck.pxWidth;
        this.canvas.height = this.doc.deck.pxHeight;
    }

    render(showHandles = true, guides: GuideLine[] = []): void {
        renderFace(this.ctx, this.doc.deck, this.doc.activeFace, this.canvas.width, this.canvas.height);

        if (showHandles && this.doc.selected) {
            this.drawSelection(this.doc.selected);
        }
        for (const guide of guides) {
            this.drawGuide(guide);
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
        return Math.max(10, this.doc.deck.dpi / 22);
    }

    private drawSelection(comp: CardComponent): void {
        const { ctx } = this;
        const bounds = comp.getBounds(this.doc.deck);
        const { x, y, w, h } = bounds;
        const dash = Math.max(4, this.doc.deck.dpi / 40);
        const lineWidth = Math.max(2, this.doc.deck.dpi / 120);

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

    private drawGuide(guide: GuideLine): void {
        const { ctx } = this;
        const dpi = this.doc.deck.dpi;
        ctx.save();
        ctx.strokeStyle = GUIDE_COLOR;
        ctx.lineWidth = Math.max(1, dpi / 150);
        ctx.setLineDash([Math.max(4, dpi / 30), Math.max(3, dpi / 60)]);
        ctx.beginPath();
        if (guide.orientation === 'v') {
            ctx.moveTo(guide.positionPx, 0);
            ctx.lineTo(guide.positionPx, this.canvas.height);
        } else {
            ctx.moveTo(0, guide.positionPx);
            ctx.lineTo(this.canvas.width, guide.positionPx);
        }
        ctx.stroke();
        ctx.restore();
    }
}

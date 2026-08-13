import type { Bounds, HandleId, TextAlign, TextComponentData } from '../types';
import { toFiniteNumber } from '../utils/dom';
import { hexToRgb } from '../rendering/drawUtils';
import { Card } from './Card';
import { CardComponent, type ResizeOrigin } from './CardComponent';

const LINE_HEIGHT_FACTOR = 1.35;

/** Minimal surface of CanvasRenderingContext2D needed for text measurement. */
export interface TextMeasurer {
    measureText(text: string): { width: number };
}

export class TextComponent extends CardComponent {
    readonly type = 'text' as const;

    text = 'New Text';
    font = 'Arial';
    fontSize = 24;
    color = '#000000';
    bold = false;
    italic = false;
    underline = false;
    align: TextAlign = 'left';
    bgColor = '#ffffff';
    bgOpacity = 0;
    /** Inner padding in points. */
    padding = 4;
    /** Explicit height in inches; null = auto-fit to content. */
    height: number | null = null;

    /** Height in canvas px measured during the last draw (auto-height support). */
    private cachedHeightPx: number | null = null;

    constructor(id: number, x: number, y: number, width: number) {
        super(id, x, y, width);
    }

    get label(): string {
        return this.text.substring(0, 22) + (this.text.length > 22 ? '…' : '');
    }

    get handles(): readonly HandleId[] {
        return ['b', 'r'];
    }

    private buildFontString(fontSizePx: number): string {
        let s = '';
        if (this.italic) s += 'italic ';
        if (this.bold) s += 'bold ';
        return `${s}${fontSizePx}px "${this.font}"`;
    }

    draw(ctx: CanvasRenderingContext2D, card: Card): void {
        const x = card.inToPx(this.x);
        const y = card.inToPx(this.y);
        const maxW = card.inToPx(this.width);
        const fontSize = card.ptToPx(this.fontSize);
        const lineH = fontSize * LINE_HEIGHT_FACTOR;
        const padding = card.ptToPx(this.padding || 0);

        ctx.font = this.buildFontString(fontSize);
        const lines = TextComponent.wrapLines(ctx, this.text, maxW - padding * 2);
        const autoH = lines.length * lineH + padding * 2;
        const totalH = this.height != null && this.height > 0 ? card.inToPx(this.height) : autoH;
        this.cachedHeightPx = totalH;

        if (this.bgOpacity > 0) {
            const rgb = hexToRgb(this.bgColor);
            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.bgOpacity})`;
            ctx.fillRect(x, y, maxW, totalH);
        }

        if (this.borderWidth > 0) {
            ctx.save();
            const bw = card.ptToPx(this.borderWidth);
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = bw;
            ctx.strokeRect(x + bw / 2, y + bw / 2, maxW - bw, totalH - bw);
            ctx.restore();
        }

        ctx.fillStyle = this.color;
        ctx.textBaseline = 'top';

        lines.forEach((line, i) => {
            let lx = x + padding;
            if (this.align === 'center') lx = x + (maxW - ctx.measureText(line).width) / 2;
            else if (this.align === 'right') lx = x + maxW - padding - ctx.measureText(line).width;

            ctx.fillText(line, lx, y + padding + i * lineH);

            if (this.underline) {
                const tw = ctx.measureText(line).width;
                ctx.save();
                ctx.strokeStyle = this.color;
                ctx.lineWidth = Math.max(1, fontSize / 18);
                ctx.beginPath();
                ctx.moveTo(lx, y + padding + i * lineH + fontSize + 2);
                ctx.lineTo(lx + tw, y + padding + i * lineH + fontSize + 2);
                ctx.stroke();
                ctx.restore();
            }
        });
    }

    getBounds(card: Card): Bounds {
        const h =
            this.height != null && this.height > 0
                ? card.inToPx(this.height)
                : (this.cachedHeightPx ?? card.ptToPx(this.fontSize) * LINE_HEIGHT_FACTOR);
        return { x: card.inToPx(this.x), y: card.inToPx(this.y), w: card.inToPx(this.width), h };
    }

    applyResize(handle: HandleId, origin: ResizeOrigin, dxIn: number, dyIn: number): void {
        if (handle === 'r') {
            this.width = Math.max(0.25, origin.w + dxIn);
        } else if (handle === 'b') {
            this.height = Math.max(0.1, origin.h + dyIn);
        }
    }

    /**
     * Greedy word wrap. Words wider than the available width are broken
     * character-by-character instead of overflowing the box.
     */
    static wrapLines(ctx: TextMeasurer, text: string, maxW: number): string[] {
        const out: string[] = [];
        for (const para of text.split('\n')) {
            if (para === '') {
                out.push('');
                continue;
            }
            let cur = '';
            for (const word of para.split(' ')) {
                const test = cur ? cur + ' ' + word : word;
                if (ctx.measureText(test).width <= maxW || !cur) {
                    cur = test;
                } else {
                    out.push(cur);
                    cur = word;
                }
                // Break a word that is too wide for the box on its own.
                while (ctx.measureText(cur).width > maxW && cur.length > 1) {
                    let cut = cur.length - 1;
                    while (cut > 1 && ctx.measureText(cur.slice(0, cut)).width > maxW) cut--;
                    out.push(cur.slice(0, cut));
                    cur = cur.slice(cut);
                }
            }
            if (cur) out.push(cur);
        }
        return out.length ? out : [''];
    }

    toJSON(): TextComponentData {
        return {
            id: this.id,
            type: 'text',
            x: this.x,
            y: this.y,
            width: this.width,
            borderWidth: this.borderWidth,
            borderColor: this.borderColor,
            text: this.text,
            font: this.font,
            fontSize: this.fontSize,
            color: this.color,
            bold: this.bold,
            italic: this.italic,
            underline: this.underline,
            align: this.align,
            bgColor: this.bgColor,
            bgOpacity: this.bgOpacity,
            padding: this.padding,
            height: this.height,
        };
    }

    static fromJSON(data: Partial<TextComponentData>): TextComponent {
        const comp = new TextComponent(
            toFiniteNumber(data.id, 0),
            toFiniteNumber(data.x, 0),
            toFiniteNumber(data.y, 0),
            Math.max(0.25, toFiniteNumber(data.width, 1)),
        );
        comp.text = typeof data.text === 'string' ? data.text : '';
        comp.font = typeof data.font === 'string' ? data.font : 'Arial';
        comp.fontSize = toFiniteNumber(data.fontSize, 24);
        comp.color = typeof data.color === 'string' ? data.color : '#000000';
        comp.bold = !!data.bold;
        comp.italic = !!data.italic;
        comp.underline = !!data.underline;
        comp.align = data.align === 'center' || data.align === 'right' ? data.align : 'left';
        comp.bgColor = typeof data.bgColor === 'string' ? data.bgColor : '#ffffff';
        comp.bgOpacity = toFiniteNumber(data.bgOpacity, 0);
        comp.borderWidth = toFiniteNumber(data.borderWidth, 0);
        comp.borderColor = typeof data.borderColor === 'string' ? data.borderColor : '#000000';
        comp.padding = toFiniteNumber(data.padding, 0);
        const h = toFiniteNumber(data.height, 0);
        comp.height = h > 0 ? h : null;
        return comp;
    }
}

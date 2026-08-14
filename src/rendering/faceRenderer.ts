import type { CardFace } from '../models/CardFace';
import type { Deck } from '../models/Deck';
import { drawCover } from './drawUtils';

/**
 * Draw one card face (background + components) into a context.
 * Shared by the editor canvas and the print-sheet exporter.
 */
export function renderFace(
    ctx: CanvasRenderingContext2D,
    deck: Deck,
    face: CardFace,
    w: number,
    h: number,
): void {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    if (face.backgroundImage) {
        if (face.backgroundFit === 'stretch') {
            ctx.drawImage(face.backgroundImage, 0, 0, w, h);
        } else {
            drawCover(ctx, face.backgroundImage, 0, 0, w, h);
        }
    }

    for (const comp of face.components) {
        comp.draw(ctx, deck);
    }
}

/** Render a face to a fresh offscreen canvas at the deck's full resolution. */
export function renderFaceToCanvas(deck: Deck, face: CardFace): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = deck.pxWidth;
    canvas.height = deck.pxHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    renderFace(ctx, deck, face, canvas.width, canvas.height);
    return canvas;
}

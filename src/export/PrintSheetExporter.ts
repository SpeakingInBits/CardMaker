import type { jsPDF } from 'jspdf';
import type { CardDocument } from '../models/CardDocument';
import type { DeckCard } from '../models/DeckCard';
import { renderFaceToCanvas } from '../rendering/faceRenderer';
import {
    backPosition,
    computePrintLayout,
    cutPositionsX,
    cutPositionsY,
    frontPosition,
    type PaperSize,
    type PrintLayout,
} from './printLayout';

export interface PrintOptions {
    /** Resolved paper size — a standard PAPER_SIZES entry or a custom one. */
    paper: PaperSize;
    /** Minimum page margin in inches; 0 for borderless printing. */
    marginIn: number;
    /** Spacing between adjacent cards in inches; 0 for shared cut lines. */
    gapIn: number;
    /** Add a mirrored backs page after each fronts page (flip on long edge). */
    duplex: boolean;
    cutLines: boolean;
}

export interface PrintResult {
    sheets: number;
    cards: number;
}

/** Generates a tiled, duplex-aligned PDF of the whole deck. */
export class PrintSheetExporter {
    /** Builds the PDF and triggers a download. Throws if the card doesn't fit the paper. */
    async export(doc: CardDocument, opts: PrintOptions): Promise<PrintResult> {
        const { paper } = opts;
        const { deck } = doc;
        const layout = computePrintLayout(
            deck.widthInches,
            deck.heightInches,
            paper,
            opts.marginIn,
            opts.gapIn,
            doc.totalPrintCount,
        );
        if (!layout) {
            throw new Error(
                `A ${deck.widthInches}×${deck.heightInches} in card does not fit on ${paper.label} with these margins.`,
            );
        }

        // Expand the deck into one entry per printed copy, then render each
        // unique card's faces once.
        const printQueue: DeckCard[] = doc.cards.flatMap((card) =>
            Array.from({ length: card.copies }, () => card),
        );
        const frontUrls = new Map<number, string>();
        const backUrls = new Map<number, string>();
        for (const card of doc.cards) {
            frontUrls.set(card.id, renderFaceToCanvas(deck, card.faces.front).toDataURL('image/png'));
            if (opts.duplex) {
                backUrls.set(card.id, renderFaceToCanvas(deck, card.faces.back).toDataURL('image/png'));
            }
        }

        // Loaded on demand: jsPDF is large and only needed for this export.
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({
            unit: 'in',
            format: [layout.paperW, layout.paperH],
            orientation: 'portrait',
        });

        for (let page = 0; page < layout.pages; page++) {
            const items = printQueue.slice(page * layout.perPage, (page + 1) * layout.perPage);
            if (page > 0) pdf.addPage([layout.paperW, layout.paperH], 'portrait');

            items.forEach((card, i) => {
                const { x, y } = frontPosition(layout, i);
                pdf.addImage(frontUrls.get(card.id)!, 'PNG', x, y, layout.cardW, layout.cardH);
            });
            if (opts.cutLines) this.drawCropMarks(pdf, layout);

            if (opts.duplex) {
                pdf.addPage([layout.paperW, layout.paperH], 'portrait');
                items.forEach((card, i) => {
                    const { x, y } = backPosition(layout, i);
                    pdf.addImage(backUrls.get(card.id)!, 'PNG', x, y, layout.cardW, layout.cardH);
                });
                if (opts.cutLines) this.drawCropMarks(pdf, layout);
            }
        }

        const fileName = `${deck.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_print_sheet.pdf`;
        pdf.save(fileName);
        return { sheets: layout.pages, cards: layout.totalCards };
    }

    /**
     * Crop marks outside the card grid: short ticks extending from each cut
     * line into the margins, so cuts can be lined up without printing lines
     * across the cards themselves. With a card gap, each card edge gets its
     * own tick; the marks are clipped to the page for small/borderless margins.
     */
    private drawCropMarks(pdf: jsPDF, layout: PrintLayout): void {
        const inner = 0.04; // gap between grid edge and mark start
        const outer = 0.18; // mark end, further into the margin
        const gridRight = layout.originX + layout.cols * layout.cardW + (layout.cols - 1) * layout.gap;
        const gridBottom = layout.originY + layout.rows * layout.cardH + (layout.rows - 1) * layout.gap;

        pdf.setDrawColor(140);
        pdf.setLineWidth(0.004);

        for (const x of cutPositionsX(layout)) {
            pdf.line(x, Math.max(0, layout.originY - outer), x, Math.max(0, layout.originY - inner));
            pdf.line(
                x,
                Math.min(layout.paperH, gridBottom + inner),
                x,
                Math.min(layout.paperH, gridBottom + outer),
            );
        }
        for (const y of cutPositionsY(layout)) {
            pdf.line(Math.max(0, layout.originX - outer), y, Math.max(0, layout.originX - inner), y);
            pdf.line(
                Math.min(layout.paperW, gridRight + inner),
                y,
                Math.min(layout.paperW, gridRight + outer),
                y,
            );
        }
    }
}

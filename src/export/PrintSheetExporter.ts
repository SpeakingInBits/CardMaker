import type { jsPDF } from 'jspdf';
import type { CardDocument } from '../models/CardDocument';
import type { DeckCard } from '../models/DeckCard';
import { renderFaceToCanvas } from '../rendering/faceRenderer';
import {
    backPosition,
    computePrintLayout,
    frontPosition,
    PAPER_SIZES,
    type PaperId,
    type PrintLayout,
} from './printLayout';

export interface PrintOptions {
    paper: PaperId;
    /** Add a mirrored backs page after each fronts page (flip on long edge). */
    duplex: boolean;
    cutLines: boolean;
}

export interface PrintResult {
    sheets: number;
    cards: number;
}

const PAGE_MARGIN_IN = 0.25;

/** Generates a tiled, duplex-aligned PDF of the whole deck. */
export class PrintSheetExporter {
    /** Builds the PDF and triggers a download. Throws if the card doesn't fit the paper. */
    async export(doc: CardDocument, opts: PrintOptions): Promise<PrintResult> {
        const paper = PAPER_SIZES[opts.paper];
        const { deck } = doc;
        const layout = computePrintLayout(
            deck.widthInches,
            deck.heightInches,
            paper,
            PAGE_MARGIN_IN,
            doc.totalPrintCount,
        );
        if (!layout) {
            throw new Error(
                `A ${deck.widthInches}×${deck.heightInches} in card does not fit on ${paper.label} with margins.`,
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
     * Crop marks outside the card grid: short ticks extending from each grid
     * line into the margins, so cuts can be lined up without printing lines
     * across the cards themselves.
     */
    private drawCropMarks(pdf: jsPDF, layout: PrintLayout): void {
        const inner = 0.04; // gap between grid edge and mark start
        const outer = 0.18; // mark end, further into the margin
        const gridRight = layout.originX + layout.cols * layout.cardW;
        const gridBottom = layout.originY + layout.rows * layout.cardH;

        pdf.setDrawColor(140);
        pdf.setLineWidth(0.004);

        for (let c = 0; c <= layout.cols; c++) {
            const x = layout.originX + c * layout.cardW;
            pdf.line(x, layout.originY - outer, x, layout.originY - inner);
            pdf.line(x, gridBottom + inner, x, gridBottom + outer);
        }
        for (let r = 0; r <= layout.rows; r++) {
            const y = layout.originY + r * layout.cardH;
            pdf.line(layout.originX - outer, y, layout.originX - inner, y);
            pdf.line(gridRight + inner, y, gridRight + outer, y);
        }
    }
}

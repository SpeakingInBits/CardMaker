import type { CardDocument } from '../models/CardDocument';
import { PrintSheetExporter } from '../export/PrintSheetExporter';
import { computePrintLayout, PAPER_SIZES, type PaperId } from '../export/printLayout';
import { byId } from '../utils/dom';

export interface PrintDialogCallbacks {
    onSuccess(message: string): void;
    onError(message: string): void;
}

const MARGIN_IN = 0.25;

/** Print-sheet options modal; generates the PDF via PrintSheetExporter. */
export class PrintDialog {
    private readonly overlay = byId<HTMLElement>('printModal');
    private readonly paperSelect = byId<HTMLSelectElement>('printPaper');
    private readonly duplexCheckbox = byId<HTMLInputElement>('printDuplex');
    private readonly cutLinesCheckbox = byId<HTMLInputElement>('printCutLines');
    private readonly info = byId<HTMLElement>('printLayoutInfo');
    private readonly generateBtn = byId<HTMLButtonElement>('printGenerateBtn');
    private readonly exporter = new PrintSheetExporter();

    constructor(
        private readonly doc: CardDocument,
        private readonly cb: PrintDialogCallbacks,
    ) {
        byId('printModalClose').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).id === 'printModal') this.close();
        });
        this.paperSelect.addEventListener('change', () => this.updateInfo());
        this.duplexCheckbox.addEventListener('change', () => this.updateInfo());
        this.generateBtn.addEventListener('click', () => void this.generate());
    }

    open(): void {
        this.updateInfo();
        this.overlay.classList.add('open');
    }

    close(): void {
        this.overlay.classList.remove('open');
    }

    private selectedPaper(): PaperId {
        return this.paperSelect.value === 'a4' ? 'a4' : 'letter';
    }

    private updateInfo(): void {
        const { deck } = this.doc;
        const paper = PAPER_SIZES[this.selectedPaper()];
        const total = this.doc.totalPrintCount;
        const layout = computePrintLayout(deck.widthInches, deck.heightInches, paper, MARGIN_IN, total);

        if (!layout) {
            this.info.textContent = `A ${deck.widthInches} × ${deck.heightInches} in card does not fit on this paper.`;
            this.generateBtn.disabled = true;
            return;
        }

        this.generateBtn.disabled = false;
        const duplex = this.duplexCheckbox.checked;
        const sheetWord = layout.pages === 1 ? 'sheet' : 'sheets';
        this.info.textContent =
            `${total} card${total === 1 ? '' : 's'} · ${layout.cols} × ${layout.rows} per page → ` +
            `${layout.pages} ${sheetWord}${duplex ? ' (each followed by its backs page — print double-sided, flip on long edge)' : ''}.`;
    }

    private async generate(): Promise<void> {
        this.generateBtn.disabled = true;
        this.generateBtn.textContent = 'Generating…';
        try {
            const result = await this.exporter.export(this.doc, {
                paper: this.selectedPaper(),
                duplex: this.duplexCheckbox.checked,
                cutLines: this.cutLinesCheckbox.checked,
            });
            this.cb.onSuccess(`Print sheet PDF created: ${result.cards} cards on ${result.sheets} sheet${result.sheets === 1 ? '' : 's'}.`);
            this.close();
        } catch (err) {
            console.error('Print sheet export failed:', err);
            this.cb.onError(err instanceof Error ? err.message : 'Failed to generate the print sheet.');
        } finally {
            this.generateBtn.disabled = false;
            this.generateBtn.textContent = 'Generate PDF';
        }
    }
}

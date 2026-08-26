import type { CardDocument } from '../models/CardDocument';
import { PrintSheetExporter } from '../export/PrintSheetExporter';
import {
    computePrintLayout,
    customPaper,
    PAPER_SIZES,
    PRINT_LIMITS,
    type PaperId,
    type PaperSize,
} from '../export/printLayout';
import { byId, clamp, toFiniteNumber } from '../utils/dom';

export interface PrintDialogCallbacks {
    onSuccess(message: string): void;
    onError(message: string): void;
}

const CUSTOM_PAPER_ID = 'custom';

/** Print-sheet options modal; generates the PDF via PrintSheetExporter. */
export class PrintDialog {
    private readonly overlay = byId<HTMLElement>('printModal');
    private readonly paperSelect = byId<HTMLSelectElement>('printPaper');
    private readonly customSizeRow = byId<HTMLElement>('printCustomSizeRow');
    private readonly customWidthInput = byId<HTMLInputElement>('printCustomWidth');
    private readonly customHeightInput = byId<HTMLInputElement>('printCustomHeight');
    private readonly marginInput = byId<HTMLInputElement>('printMargin');
    private readonly gapInput = byId<HTMLInputElement>('printGap');
    private readonly duplexCheckbox = byId<HTMLInputElement>('printDuplex');
    private readonly cutLinesCheckbox = byId<HTMLInputElement>('printCutLines');
    private readonly info = byId<HTMLElement>('printLayoutInfo');
    private readonly generateBtn = byId<HTMLButtonElement>('printGenerateBtn');
    private readonly exporter = new PrintSheetExporter();

    constructor(
        private readonly doc: CardDocument,
        private readonly cb: PrintDialogCallbacks,
    ) {
        this.populatePaperOptions();
        byId('printModalClose').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).id === 'printModal') this.close();
        });
        this.paperSelect.addEventListener('change', () => this.updateInfo());
        for (const input of [
            this.customWidthInput,
            this.customHeightInput,
            this.marginInput,
            this.gapInput,
        ]) {
            input.addEventListener('input', () => this.updateInfo());
        }
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

    /** Fill the paper dropdown from PAPER_SIZES so options stay in sync. */
    private populatePaperOptions(): void {
        this.paperSelect.innerHTML = '';
        for (const [id, size] of Object.entries(PAPER_SIZES)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = size.label;
            this.paperSelect.appendChild(option);
        }
        const custom = document.createElement('option');
        custom.value = CUSTOM_PAPER_ID;
        custom.textContent = 'Custom…';
        this.paperSelect.appendChild(custom);
    }

    private selectedPaper(): PaperSize {
        const id = this.paperSelect.value;
        if (id === CUSTOM_PAPER_ID) {
            return customPaper(
                toFiniteNumber(this.customWidthInput.value, 8.5),
                toFiniteNumber(this.customHeightInput.value, 11),
            );
        }
        return PAPER_SIZES[id as PaperId] ?? PAPER_SIZES.letter;
    }

    private marginIn(): number {
        return clamp(
            toFiniteNumber(this.marginInput.value, 0.25),
            PRINT_LIMITS.minMarginIn,
            PRINT_LIMITS.maxMarginIn,
        );
    }

    private gapIn(): number {
        return clamp(
            toFiniteNumber(this.gapInput.value, 0),
            PRINT_LIMITS.minGapIn,
            PRINT_LIMITS.maxGapIn,
        );
    }

    private updateInfo(): void {
        this.customSizeRow.style.display =
            this.paperSelect.value === CUSTOM_PAPER_ID ? '' : 'none';

        const { deck } = this.doc;
        const paper = this.selectedPaper();
        const total = this.doc.totalPrintCount;
        const layout = computePrintLayout(
            deck.widthInches,
            deck.heightInches,
            paper,
            this.marginIn(),
            this.gapIn(),
            total,
        );

        if (!layout) {
            this.info.textContent = `A ${deck.widthInches} × ${deck.heightInches} in card does not fit on this paper with these margins.`;
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
                marginIn: this.marginIn(),
                gapIn: this.gapIn(),
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

import { CARD_LIMITS, type Card } from '../models/Card';
import { byId, clamp } from '../utils/dom';

export interface CardSettingsCallbacks {
    /** Size or DPI committed — resize canvas, redraw, autosave. */
    onSizeChange(): void;
}

/** Card width/height/DPI inputs plus the pixel-dimension readout. */
export class CardSettingsPanel {
    private readonly widthInput = byId<HTMLInputElement>('cardWidth');
    private readonly heightInput = byId<HTMLInputElement>('cardHeight');
    private readonly dpiInput = byId<HTMLInputElement>('cardDpi');
    private readonly readout = byId<HTMLElement>('dimReadout');

    constructor(
        private readonly card: () => Card,
        private readonly cb: CardSettingsCallbacks,
    ) {
        for (const input of [this.widthInput, this.heightInput, this.dpiInput]) {
            input.addEventListener('change', () => this.commit());
            input.addEventListener('input', () => this.updateReadout());
        }
        this.updateReadout();
    }

    private commit(): void {
        const card = this.card();
        card.widthInches = clamp(
            parseFloat(this.widthInput.value) || card.widthInches,
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        card.heightInches = clamp(
            parseFloat(this.heightInput.value) || card.heightInches,
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        card.dpi = clamp(parseInt(this.dpiInput.value) || card.dpi, CARD_LIMITS.minDpi, CARD_LIMITS.maxDpi);
        this.syncFromCard();
        this.cb.onSizeChange();
    }

    /** Push current card values into the inputs (after load/import). */
    syncFromCard(): void {
        const card = this.card();
        this.widthInput.value = String(card.widthInches);
        this.heightInput.value = String(card.heightInches);
        this.dpiInput.value = String(card.dpi);
        this.updateReadout();
    }

    private updateReadout(): void {
        const w = parseFloat(this.widthInput.value) || this.card().widthInches;
        const h = parseFloat(this.heightInput.value) || this.card().heightInches;
        const d = parseInt(this.dpiInput.value) || this.card().dpi;
        this.readout.textContent = `${Math.round(w * d)} × ${Math.round(h * d)} px`;
    }
}

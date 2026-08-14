import { CARD_LIMITS, type Deck } from '../models/Deck';
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
        private readonly deck: () => Deck,
        private readonly cb: CardSettingsCallbacks,
    ) {
        for (const input of [this.widthInput, this.heightInput, this.dpiInput]) {
            input.addEventListener('change', () => this.commit());
            input.addEventListener('input', () => this.updateReadout());
        }
        this.updateReadout();
    }

    private commit(): void {
        const deck = this.deck();
        deck.widthInches = clamp(
            parseFloat(this.widthInput.value) || deck.widthInches,
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        deck.heightInches = clamp(
            parseFloat(this.heightInput.value) || deck.heightInches,
            CARD_LIMITS.minInches,
            CARD_LIMITS.maxInches,
        );
        deck.dpi = clamp(parseInt(this.dpiInput.value) || deck.dpi, CARD_LIMITS.minDpi, CARD_LIMITS.maxDpi);
        this.syncFromDeck();
        this.cb.onSizeChange();
    }

    /** Push current deck values into the inputs (after load/import). */
    syncFromDeck(): void {
        const deck = this.deck();
        this.widthInput.value = String(deck.widthInches);
        this.heightInput.value = String(deck.heightInches);
        this.dpiInput.value = String(deck.dpi);
        this.updateReadout();
    }

    private updateReadout(): void {
        const w = parseFloat(this.widthInput.value) || this.deck().widthInches;
        const h = parseFloat(this.heightInput.value) || this.deck().heightInches;
        const d = parseInt(this.dpiInput.value) || this.deck().dpi;
        this.readout.textContent = `${Math.round(w * d)} × ${Math.round(h * d)} px`;
    }
}

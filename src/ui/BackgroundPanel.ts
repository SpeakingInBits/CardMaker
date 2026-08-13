import type { Card } from '../models/Card';
import type { BackgroundFit } from '../types';
import { byId, readFileAsDataURL } from '../utils/dom';

export interface BackgroundCallbacks {
    /** Background image or fit changed — redraw and autosave. */
    onBackgroundChange(): void;
}

/** Background upload/remove/fit controls in the left sidebar. */
export class BackgroundPanel {
    private readonly area = byId<HTMLElement>('bgUploadArea');
    private readonly label = byId<HTMLElement>('bgUploadLabel');
    private readonly fileInput = byId<HTMLInputElement>('bgFileInput');
    private readonly removeBtn = byId<HTMLButtonElement>('removeBgBtn');
    private readonly fitSelect = byId<HTMLSelectElement>('bgFitSelect');

    constructor(
        private readonly card: () => Card,
        private readonly cb: BackgroundCallbacks,
    ) {
        this.area.addEventListener('click', () => this.fileInput.click());
        this.area.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.area.classList.add('drag-over');
        });
        this.area.addEventListener('dragleave', () => this.area.classList.remove('drag-over'));
        this.area.addEventListener('drop', (e) => {
            e.preventDefault();
            this.area.classList.remove('drag-over');
            const file = e.dataTransfer?.files[0];
            if (file) void this.loadFile(file);
        });
        this.fileInput.addEventListener('change', () => {
            const file = this.fileInput.files?.[0];
            if (file) void this.loadFile(file);
            this.fileInput.value = '';
        });
        this.removeBtn.addEventListener('click', () => {
            this.card().removeBackground();
            this.syncFromCard();
            this.cb.onBackgroundChange();
        });
        this.fitSelect.addEventListener('change', () => {
            this.card().backgroundFit = this.fitSelect.value as BackgroundFit;
            this.cb.onBackgroundChange();
        });
    }

    private async loadFile(file: File): Promise<void> {
        try {
            const dataUrl = await readFileAsDataURL(file);
            await this.card().setBackground(dataUrl);
            this.syncFromCard();
            this.cb.onBackgroundChange();
        } catch (err) {
            console.error('Failed to load background image:', err);
            alert('Could not load that image. Please try a different file.');
        }
    }

    /** Reflect the card's background state in the panel UI. */
    syncFromCard(): void {
        const hasBg = !!this.card().backgroundImageData;
        this.removeBtn.style.display = hasBg ? 'block' : 'none';
        this.area.classList.toggle('has-bg', hasBg);
        this.label.textContent = hasBg ? '✓ Background set (click to change)' : 'Click or drop image';
        this.fitSelect.value = this.card().backgroundFit;
    }
}

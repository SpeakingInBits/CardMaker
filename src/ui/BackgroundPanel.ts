import type { CardFace } from '../models/CardFace';
import type { BackgroundFit } from '../types';
import { byId } from '../utils/dom';
import { importImageFile, optimizationMessage } from '../utils/imageProcessing';

export interface BackgroundCallbacks {
    /** Background image or fit changed — redraw and autosave. */
    onBackgroundChange(): void;
    onInfo(message: string): void;
    onError(message: string): void;
}

/** Background upload/remove/fit controls for the active card face. */
export class BackgroundPanel {
    private readonly area = byId<HTMLElement>('bgUploadArea');
    private readonly label = byId<HTMLElement>('bgUploadLabel');
    private readonly fileInput = byId<HTMLInputElement>('bgFileInput');
    private readonly removeBtn = byId<HTMLButtonElement>('removeBgBtn');
    private readonly fitSelect = byId<HTMLSelectElement>('bgFitSelect');

    constructor(
        private readonly face: () => CardFace,
        private readonly maxImageDimension: () => number,
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
            this.face().removeBackground();
            this.syncFromFace();
            this.cb.onBackgroundChange();
        });
        this.fitSelect.addEventListener('change', () => {
            this.face().backgroundFit = this.fitSelect.value as BackgroundFit;
            this.cb.onBackgroundChange();
        });
    }

    private async loadFile(file: File): Promise<void> {
        try {
            const result = await importImageFile(file, this.maxImageDimension());
            const face = this.face();
            face.backgroundImageData = result.dataUrl;
            face.backgroundImage = result.image;
            const msg = optimizationMessage(result);
            if (msg) this.cb.onInfo(msg);
            this.syncFromFace();
            this.cb.onBackgroundChange();
        } catch (err) {
            console.error('Failed to load background image:', err);
            this.cb.onError('Could not load that image. Please try a different file.');
        }
    }

    /** Reflect the active face's background state in the panel UI. */
    syncFromFace(): void {
        const hasBg = !!this.face().backgroundImageData;
        this.removeBtn.style.display = hasBg ? 'block' : 'none';
        this.area.classList.toggle('has-bg', hasBg);
        this.label.textContent = hasBg ? '✓ Background set (click to change)' : 'Click or drop image';
        this.fitSelect.value = this.face().backgroundFit;
    }
}

const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const FIT_PADDING_PX = 40;

/**
 * Controls how large the card canvas appears on screen. "Fit" scales the
 * canvas to the viewport (never above 100%); +/- switch to explicit zoom
 * levels where 100% = one canvas pixel per CSS pixel.
 */
export class ViewportController {
    private mode: 'fit' | number = 'fit';

    constructor(
        private readonly viewport: HTMLElement,
        private readonly canvas: HTMLCanvasElement,
        private readonly onUpdate: (percent: number, isFit: boolean) => void,
    ) {
        // Re-fit whenever the viewport element changes size (window resize,
        // pane layout settling after load, sidebar changes, ...).
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => {
                if (this.mode === 'fit') this.apply();
            }).observe(viewport);
        } else {
            window.addEventListener('resize', () => {
                if (this.mode === 'fit') this.apply();
            });
        }
    }

    private fitScale(): number {
        const availW = Math.max(50, this.viewport.clientWidth - FIT_PADDING_PX);
        const availH = Math.max(50, this.viewport.clientHeight - FIT_PADDING_PX);
        if (!this.canvas.width || !this.canvas.height) return 1;
        return Math.min(availW / this.canvas.width, availH / this.canvas.height, 1);
    }

    currentScale(): number {
        return this.mode === 'fit' ? this.fitScale() : this.mode;
    }

    /** Re-apply the current mode (after card resize, face switch, etc.). */
    apply(): void {
        const scale = this.currentScale();
        this.canvas.style.width = `${this.canvas.width * scale}px`;
        this.canvas.style.height = `${this.canvas.height * scale}px`;
        this.onUpdate(Math.round(scale * 100), this.mode === 'fit');
    }

    zoomIn(): void {
        this.setZoom(this.currentScale() * ZOOM_STEP);
    }

    zoomOut(): void {
        this.setZoom(this.currentScale() / ZOOM_STEP);
    }

    fit(): void {
        this.mode = 'fit';
        this.apply();
    }

    private setZoom(scale: number): void {
        this.mode = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
        this.apply();
    }
}

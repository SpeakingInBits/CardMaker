import type { CardDocument } from '../models/CardDocument';
import { ImageComponent } from '../models/ImageComponent';
import { TextComponent } from '../models/TextComponent';
import type { TextAlign } from '../types';
import { clamp } from '../utils/dom';
import { importImageFile, optimizationMessage, recommendedMaxDimension } from '../utils/imageProcessing';

export const FONTS = [
    'Arial',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Comic Sans MS',
    'Impact',
    'Trebuchet MS',
    'Palatino Linotype',
    'Lucida Console',
] as const;

export interface PropertiesCallbacks {
    /** Value tweak — redraw + list + autosave without rebuilding this panel. */
    onLightChange(): void;
    /** Structural change (toggle, image swap) — full refresh including this panel. */
    onFullChange(): void;
    onDelete(id: number): void;
    onInfo(message: string): void;
    onError(message: string): void;
}

/** Right-sidebar editor for the selected component's properties. */
export class PropertiesPanel {
    constructor(
        private readonly container: HTMLElement,
        private readonly doc: CardDocument,
        private readonly cb: PropertiesCallbacks,
    ) {}

    render(): void {
        const comp = this.doc.selected;
        if (!comp) {
            this.container.innerHTML = '<p class="hint">Select a component to edit</p>';
            return;
        }
        if (comp instanceof TextComponent) this.renderText(comp);
        else if (comp instanceof ImageComponent) this.renderImage(comp);
    }

    /** Update position/size inputs live during nudges without rebuilding. */
    syncPosition(comp: { x: number; y: number }): void {
        const xEl = this.q<HTMLInputElement>('propX');
        const yEl = this.q<HTMLInputElement>('propY');
        if (xEl) xEl.value = comp.x.toFixed(3);
        if (yEl) yEl.value = comp.y.toFixed(3);
    }

    /** Update pan/zoom inputs live during canvas pan or wheel zoom. */
    syncPanZoom(comp: ImageComponent): void {
        const panX = this.q<HTMLInputElement>('propPanX');
        const panY = this.q<HTMLInputElement>('propPanY');
        const zoom = this.q<HTMLInputElement>('propZoom');
        if (panX) panX.value = String(Math.round(comp.imageOffsetX));
        if (panY) panY.value = String(Math.round(comp.imageOffsetY));
        if (zoom) zoom.value = String(Math.round(comp.imageScale * 100));
    }

    private q<T extends HTMLElement>(id: string): T | null {
        return this.container.querySelector<T>(`#${id}`);
    }

    private must<T extends HTMLElement>(id: string): T {
        const el = this.q<T>(id);
        if (!el) throw new Error(`Missing properties element #${id}`);
        return el;
    }

    /**
     * Bind a numeric input. Invalid text (e.g. mid-typing) is ignored instead
     * of being coerced to 0, and committed values are clamped to [min, max].
     */
    private bindNumber(
        id: string,
        apply: (value: number) => void,
        opts: { min?: number; max?: number; round?: boolean } = {},
    ): void {
        const el = this.must<HTMLInputElement>(id);
        const handler = () => {
            let v = parseFloat(el.value);
            if (!Number.isFinite(v)) return;
            if (opts.round) v = Math.round(v);
            if (opts.min != null) v = Math.max(opts.min, v);
            if (opts.max != null) v = Math.min(opts.max, v);
            apply(v);
            this.cb.onLightChange();
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    }

    private bindValue(id: string, apply: (value: string) => void): void {
        const el = this.must<HTMLInputElement>(id);
        const handler = () => {
            apply(el.value);
            this.cb.onLightChange();
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    }

    // ---------- Text ----------
    private renderText(comp: TextComponent): void {
        const fontOpts = FONTS.map(
            (f) => `<option value="${f}"${comp.font === f ? ' selected' : ''}>${f}</option>`,
        ).join('');

        this.container.innerHTML = `
            <div class="prop-section"><h4>Text Content</h4>
                <div class="form-group"><textarea id="propText" rows="4"></textarea></div>
            </div>
            <div class="prop-section"><h4>Position &amp; Size</h4>
                <div class="prop-row">
                    <label>X (in)<input type="number" id="propX" step="0.0625"></label>
                    <label>Y (in)<input type="number" id="propY" step="0.0625"></label>
                </div>
                <div class="prop-row">
                    <label>Width (in)<input type="number" id="propW" step="0.0625" min="0.25"></label>
                    <label>Height (in)<input type="number" id="propH" step="0.0625" min="0" placeholder="auto"></label>
                </div>
            </div>
            <div class="prop-section"><h4>Font</h4>
                <div class="form-group"><label>Family</label><select id="propFont">${fontOpts}</select></div>
                <div class="prop-row">
                    <label>Size (pt)<input type="number" id="propSize" min="4" max="400" step="1"></label>
                    <label>Color<input type="color" id="propColor"></label>
                </div>
            </div>
            <div class="prop-section"><h4>Background</h4>
                <div class="prop-row">
                    <label>Color<input type="color" id="propBgColor"></label>
                    <label>Opacity<input type="number" id="propBgOpacity" min="0" max="1" step="0.05"></label>
                </div>
            </div>
            <div class="prop-section"><h4>Border</h4>
                <div class="prop-row">
                    <label>Width (pt)<input type="number" id="propBorderW" min="0" max="50" step="0.5"></label>
                    <label>Color<input type="color" id="propBorderColor"></label>
                </div>
                <div class="prop-row">
                    <label>Padding (pt)<input type="number" id="propPadding" min="0" max="100" step="1"></label>
                </div>
            </div>
            <div class="prop-section"><h4>Style</h4>
                <div class="prop-toggle-row">
                    <button type="button" class="toggle-btn${comp.bold ? ' active' : ''}" id="tBold"><b>B</b></button>
                    <button type="button" class="toggle-btn${comp.italic ? ' active' : ''}" id="tItalic"><i>I</i></button>
                    <button type="button" class="toggle-btn${comp.underline ? ' active' : ''}" id="tUnder"><u>U</u></button>
                </div>
                <div class="prop-toggle-row">
                    <button type="button" class="toggle-btn${comp.align === 'left' ? ' active' : ''}" data-al="left">Left</button>
                    <button type="button" class="toggle-btn${comp.align === 'center' ? ' active' : ''}" data-al="center">Center</button>
                    <button type="button" class="toggle-btn${comp.align === 'right' ? ' active' : ''}" data-al="right">Right</button>
                </div>
            </div>
            <button type="button" class="delete-comp-btn" id="propDel">🗑️ Delete Component</button>`;

        // Set values via the DOM (not markup) to avoid encoding issues.
        this.must<HTMLTextAreaElement>('propText').value = comp.text;
        this.must<HTMLInputElement>('propX').value = comp.x.toFixed(3);
        this.must<HTMLInputElement>('propY').value = comp.y.toFixed(3);
        this.must<HTMLInputElement>('propW').value = comp.width.toFixed(3);
        this.must<HTMLInputElement>('propH').value =
            comp.height != null && comp.height > 0 ? comp.height.toFixed(3) : '';
        this.must<HTMLInputElement>('propSize').value = String(comp.fontSize);
        this.must<HTMLInputElement>('propColor').value = comp.color;
        this.must<HTMLInputElement>('propBgColor').value = comp.bgColor;
        this.must<HTMLInputElement>('propBgOpacity').value = String(comp.bgOpacity);
        this.must<HTMLInputElement>('propBorderW').value = String(comp.borderWidth);
        this.must<HTMLInputElement>('propBorderColor').value = comp.borderColor;
        this.must<HTMLInputElement>('propPadding').value = String(comp.padding);

        this.bindValue('propText', (v) => (comp.text = v));
        this.bindNumber('propX', (v) => (comp.x = v));
        this.bindNumber('propY', (v) => (comp.y = v));
        this.bindNumber('propW', (v) => (comp.width = v), { min: 0.25 });

        // Height: empty or 0 = auto.
        const heightEl = this.must<HTMLInputElement>('propH');
        const heightHandler = () => {
            const v = parseFloat(heightEl.value);
            comp.height = Number.isFinite(v) && v > 0 ? v : null;
            this.cb.onLightChange();
        };
        heightEl.addEventListener('input', heightHandler);
        heightEl.addEventListener('change', heightHandler);

        this.bindValue('propFont', (v) => (comp.font = v));
        this.bindNumber('propSize', (v) => (comp.fontSize = v), { min: 4, max: 400, round: true });
        this.bindValue('propColor', (v) => (comp.color = v));
        this.bindValue('propBgColor', (v) => (comp.bgColor = v));
        this.bindNumber('propBgOpacity', (v) => (comp.bgOpacity = v), { min: 0, max: 1 });
        this.bindNumber('propBorderW', (v) => (comp.borderWidth = v), { min: 0, max: 50 });
        this.bindValue('propBorderColor', (v) => (comp.borderColor = v));
        this.bindNumber('propPadding', (v) => (comp.padding = v), { min: 0, max: 100 });

        this.must('tBold').addEventListener('click', () => {
            comp.bold = !comp.bold;
            this.cb.onFullChange();
        });
        this.must('tItalic').addEventListener('click', () => {
            comp.italic = !comp.italic;
            this.cb.onFullChange();
        });
        this.must('tUnder').addEventListener('click', () => {
            comp.underline = !comp.underline;
            this.cb.onFullChange();
        });

        this.container.querySelectorAll<HTMLButtonElement>('[data-al]').forEach((btn) => {
            btn.addEventListener('click', () => {
                comp.align = btn.dataset.al as TextAlign;
                this.cb.onFullChange();
            });
        });

        this.must('propDel').addEventListener('click', () => this.cb.onDelete(comp.id));
    }

    // ---------- Image ----------
    private renderImage(comp: ImageComponent): void {
        this.container.innerHTML = `
            <div class="prop-section"><h4>Position &amp; Size</h4>
                <div class="prop-row">
                    <label>X (in)<input type="number" id="propX" step="0.0625"></label>
                    <label>Y (in)<input type="number" id="propY" step="0.0625"></label>
                </div>
                <div class="prop-row">
                    <label>Width (in)<input type="number" id="propW" step="0.0625" min="0.1"></label>
                    <label>Height (in)<input type="number" id="propH" step="0.0625" min="0.1"></label>
                </div>
            </div>
            <div class="prop-section"><h4>Border</h4>
                <div class="prop-row">
                    <label>Width (pt)<input type="number" id="propBorderW" min="0" max="50" step="0.5"></label>
                    <label>Color<input type="color" id="propBorderColor"></label>
                </div>
            </div>
            <div class="prop-section"><h4>Corner Radius</h4>
                <div class="prop-row">
                    <label>Radius (pt)<input type="number" id="propCornerRadius" min="0" max="500" step="1"></label>
                </div>
            </div>
            <div class="prop-section"><h4>Image Pan <span class="prop-hint">(Alt+drag on canvas)</span></h4>
                <div class="prop-row">
                    <label>Pan X (px)<input type="number" id="propPanX" step="1"></label>
                    <label>Pan Y (px)<input type="number" id="propPanY" step="1"></label>
                </div>
                <button type="button" class="small-btn" id="propResetPan">Reset Pan</button>
            </div>
            <div class="prop-section"><h4>Zoom <span class="prop-hint">(Scroll wheel on canvas)</span></h4>
                <div class="prop-row">
                    <label>Scale (%)<input type="number" id="propZoom" min="10" max="1000" step="5"></label>
                </div>
                <button type="button" class="small-btn" id="propResetZoom">Reset Zoom</button>
            </div>
            <div class="prop-section"><h4>Image</h4>
                <button type="button" class="small-btn" id="propChangeImg">Change Image</button>
                <input type="file" id="propImgInput" accept="image/*" style="display:none">
            </div>
            <button type="button" class="delete-comp-btn" id="propDel">🗑️ Delete Component</button>`;

        this.must<HTMLInputElement>('propX').value = comp.x.toFixed(3);
        this.must<HTMLInputElement>('propY').value = comp.y.toFixed(3);
        this.must<HTMLInputElement>('propW').value = comp.width.toFixed(3);
        this.must<HTMLInputElement>('propH').value = comp.height.toFixed(3);
        this.must<HTMLInputElement>('propBorderW').value = String(comp.borderWidth);
        this.must<HTMLInputElement>('propBorderColor').value = comp.borderColor;
        this.must<HTMLInputElement>('propCornerRadius').value = String(comp.cornerRadius);
        this.syncPanZoom(comp);

        this.bindNumber('propX', (v) => (comp.x = v));
        this.bindNumber('propY', (v) => (comp.y = v));
        this.bindNumber('propW', (v) => (comp.width = v), { min: 0.1 });
        this.bindNumber('propH', (v) => (comp.height = v), { min: 0.1 });
        this.bindNumber('propBorderW', (v) => (comp.borderWidth = v), { min: 0, max: 50 });
        this.bindValue('propBorderColor', (v) => (comp.borderColor = v));
        this.bindNumber('propCornerRadius', (v) => (comp.cornerRadius = v), { min: 0, max: 500 });

        // Pan inputs clamp to what the current size/zoom allows.
        const panXEl = this.must<HTMLInputElement>('propPanX');
        const panYEl = this.must<HTMLInputElement>('propPanY');
        const panHandler = () => {
            comp.imageOffsetX = parseFloat(panXEl.value) || 0;
            comp.imageOffsetY = parseFloat(panYEl.value) || 0;
            comp.clampOffsets(this.doc.deck);
            panXEl.value = String(Math.round(comp.imageOffsetX));
            panYEl.value = String(Math.round(comp.imageOffsetY));
            this.cb.onLightChange();
        };
        panXEl.addEventListener('input', panHandler);
        panXEl.addEventListener('change', panHandler);
        panYEl.addEventListener('input', panHandler);
        panYEl.addEventListener('change', panHandler);

        const zoomEl = this.must<HTMLInputElement>('propZoom');
        const zoomHandler = () => {
            const v = parseFloat(zoomEl.value);
            if (!Number.isFinite(v)) return;
            comp.imageScale = clamp(v / 100, 0.1, 10);
            comp.clampOffsets(this.doc.deck);
            panXEl.value = String(Math.round(comp.imageOffsetX));
            panYEl.value = String(Math.round(comp.imageOffsetY));
            this.cb.onLightChange();
        };
        zoomEl.addEventListener('input', zoomHandler);
        zoomEl.addEventListener('change', zoomHandler);

        this.must('propResetPan').addEventListener('click', () => {
            comp.imageOffsetX = 0;
            comp.imageOffsetY = 0;
            this.cb.onFullChange();
        });

        this.must('propResetZoom').addEventListener('click', () => {
            comp.imageScale = 1;
            comp.clampOffsets(this.doc.deck);
            this.cb.onFullChange();
        });

        const imgInput = this.must<HTMLInputElement>('propImgInput');
        this.must('propChangeImg').addEventListener('click', () => imgInput.click());
        imgInput.addEventListener('change', async () => {
            const file = imgInput.files?.[0];
            if (!file) return;
            try {
                const deck = this.doc.deck;
                const result = await importImageFile(file, recommendedMaxDimension(deck.pxWidth, deck.pxHeight));
                comp.imageData = result.dataUrl;
                comp.image = result.image;
                const msg = optimizationMessage(result);
                if (msg) this.cb.onInfo(msg);
                this.cb.onFullChange();
            } catch (err) {
                console.error('Failed to load image:', err);
                this.cb.onError('Could not load that image. Please try a different file.');
            }
        });

        this.must('propDel').addEventListener('click', () => this.cb.onDelete(comp.id));
    }
}

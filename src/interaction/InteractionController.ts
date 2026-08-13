import type { HandleId, Point } from '../types';
import type { CardDocument } from '../models/CardDocument';
import type { CardRenderer } from '../rendering/CardRenderer';
import { CardComponent, type ResizeOrigin } from '../models/CardComponent';
import { ImageComponent } from '../models/ImageComponent';
import { TextComponent } from '../models/TextComponent';

type Interaction =
    | { kind: 'drag'; comp: CardComponent; start: Point; origX: number; origY: number }
    | { kind: 'resize'; comp: CardComponent; handle: HandleId; start: Point; origin: ResizeOrigin }
    | { kind: 'pan'; comp: ImageComponent; start: Point; origOx: number; origOy: number };

const CURSOR_BY_HANDLE: Record<HandleId, string> = {
    tl: 'nwse-resize',
    br: 'nwse-resize',
    tr: 'nesw-resize',
    bl: 'nesw-resize',
    r: 'ew-resize',
    b: 'ns-resize',
};

export interface InteractionCallbacks {
    /** Selection changed via canvas click — refresh list + properties. */
    onSelectionChanged(): void;
    /** A live pan/zoom tweak — sync the matching property inputs without rebuilding. */
    onLiveChange(comp: ImageComponent): void;
    /** Something changed that should be persisted (debounced autosave). */
    onChanged(): void;
    /** A drag/resize/pan finished — persist and refresh properties. */
    onInteractionEnd(): void;
    /** Double-clicked a text component — open the inline editor. */
    onEditText(comp: TextComponent): void;
    /** Delete key pressed with a selection. */
    onDeleteSelected(): void;
}

/** Owns all mouse/keyboard interaction with the card canvas. */
export class InteractionController {
    private interaction: Interaction | null = null;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly doc: CardDocument,
        private readonly renderer: CardRenderer,
        private readonly cb: InteractionCallbacks,
    ) {
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', () => this.onMouseUp());
        canvas.addEventListener('dblclick', (e) => this.onDblClick(e));
        canvas.addEventListener('dragover', (e) => e.preventDefault());
        canvas.addEventListener('drop', (e) => e.preventDefault());
        canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    /** Convert a mouse event to canvas-pixel coordinates. */
    private canvasPoint(e: MouseEvent): Point {
        const r = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (this.canvas.width / r.width),
            y: (e.clientY - r.top) * (this.canvas.height / r.height),
        };
    }

    private handleTolerance(): number {
        return this.renderer.handleSize() * 1.6;
    }

    private onMouseDown(e: MouseEvent): void {
        const p = this.canvasPoint(e);
        const card = this.doc.card;
        const sel = this.doc.selected;

        // 1) Selected component: pan (Alt+drag on image) or resize handles.
        if (sel) {
            if (e.altKey && sel instanceof ImageComponent && sel.hitTest(card, p.x, p.y)) {
                this.interaction = {
                    kind: 'pan',
                    comp: sel,
                    start: p,
                    origOx: sel.imageOffsetX,
                    origOy: sel.imageOffsetY,
                };
                this.canvas.style.cursor = 'grabbing';
                return;
            }
            const handle = sel.hitHandle(card, p.x, p.y, this.handleTolerance());
            if (handle) {
                this.interaction = {
                    kind: 'resize',
                    comp: sel,
                    handle,
                    start: p,
                    origin: sel.getResizeOrigin(card),
                };
                return;
            }
        }

        // 2) Component bodies, topmost first.
        const hit = this.doc.topmostAt(p.x, p.y);
        if (hit) {
            this.doc.select(hit.id);
            this.interaction = { kind: 'drag', comp: hit, start: p, origX: hit.x, origY: hit.y };
            this.renderer.render();
            this.cb.onSelectionChanged();
            return;
        }

        // 3) Empty space: deselect.
        this.doc.select(null);
        this.interaction = null;
        this.renderer.render();
        this.cb.onSelectionChanged();
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.interaction) {
            this.updateCursor(e);
            return;
        }

        const p = this.canvasPoint(e);
        const card = this.doc.card;
        const it = this.interaction;

        if (it.kind === 'pan') {
            it.comp.imageOffsetX = it.origOx + (p.x - it.start.x);
            it.comp.imageOffsetY = it.origOy + (p.y - it.start.y);
            it.comp.clampOffsets(card);
            this.cb.onLiveChange(it.comp);
        } else if (it.kind === 'drag') {
            const comp = it.comp;
            comp.x = it.origX + card.pxToIn(p.x - it.start.x);
            comp.y = it.origY + card.pxToIn(p.y - it.start.y);
            // Keep at least part of the component reachable on the card.
            comp.x = Math.max(-comp.width * 0.5, Math.min(comp.x, card.widthInches));
            comp.y = Math.max(-0.5, comp.y);
        } else {
            const dxIn = card.pxToIn(p.x - it.start.x);
            const dyIn = card.pxToIn(p.y - it.start.y);
            it.comp.applyResize(it.handle, it.origin, dxIn, dyIn);
        }
        this.renderer.render();
    }

    private onMouseUp(): void {
        if (this.interaction) {
            this.interaction = null;
            this.cb.onInteractionEnd();
        }
    }

    private onWheel(e: WheelEvent): void {
        const sel = this.doc.selected;
        if (!(sel instanceof ImageComponent)) return;
        const p = this.canvasPoint(e);
        if (!sel.hitTest(this.doc.card, p.x, p.y)) return;

        e.preventDefault();
        const step = e.ctrlKey ? 0.01 : 0.05;
        const delta = e.deltaY < 0 ? step : -step;
        sel.imageScale = Math.max(0.1, Math.min(10, (sel.imageScale || 1) + delta));
        sel.clampOffsets(this.doc.card);
        this.cb.onLiveChange(sel);
        this.renderer.render();
        this.cb.onChanged();
    }

    private updateCursor(e: MouseEvent): void {
        const p = this.canvasPoint(e);
        const card = this.doc.card;
        const sel = this.doc.selected;

        if (sel) {
            const handle = sel.hitHandle(card, p.x, p.y, this.handleTolerance());
            if (handle) {
                this.canvas.style.cursor = CURSOR_BY_HANDLE[handle];
                return;
            }
            if (e.altKey && sel instanceof ImageComponent && sel.hitTest(card, p.x, p.y)) {
                this.canvas.style.cursor = 'grab';
                return;
            }
        }
        this.canvas.style.cursor = this.doc.topmostAt(p.x, p.y) ? 'move' : 'default';
    }

    private onDblClick(e: MouseEvent): void {
        const p = this.canvasPoint(e);
        for (let i = this.doc.components.length - 1; i >= 0; i--) {
            const comp = this.doc.components[i];
            if (comp instanceof TextComponent && comp.hitTest(this.doc.card, p.x, p.y)) {
                this.doc.select(comp.id);
                this.renderer.render();
                this.cb.onSelectionChanged();
                this.cb.onEditText(comp);
                return;
            }
        }
    }

    private onKeyDown(e: KeyboardEvent): void {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
        // Don't delete components while a modal dialog is open.
        if (document.querySelector('.modal-overlay.open')) return;

        if ((e.key === 'Delete' || e.key === 'Backspace') && this.doc.selectedId != null) {
            e.preventDefault();
            this.cb.onDeleteSelected();
        } else if (e.key === 'Escape' && this.doc.selectedId != null) {
            this.doc.select(null);
            this.renderer.render();
            this.cb.onSelectionChanged();
        }
    }
}

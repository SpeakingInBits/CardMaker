import type { HandleId, Point } from '../types';
import type { CardDocument } from '../models/CardDocument';
import type { CardRenderer, GuideLine } from '../rendering/CardRenderer';
import { CardComponent, type ResizeOrigin } from '../models/CardComponent';
import { ImageComponent } from '../models/ImageComponent';
import { TextComponent } from '../models/TextComponent';
import { computeSnap, type RectIn } from './snapping';

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

/** Snap distance in inches (independent of DPI). Hold Ctrl to disable. */
const SNAP_THRESHOLD_IN = 0.05;
/** Arrow-key nudge distances in inches (Shift = coarse). */
const NUDGE_FINE_IN = 1 / 64;
const NUDGE_COARSE_IN = 1 / 16;

export interface InteractionCallbacks {
    /** Selection changed via canvas click — refresh list + properties. */
    onSelectionChanged(): void;
    /** A live tweak (pan/zoom/nudge) — sync property inputs without rebuilding. */
    onLiveChange(comp: CardComponent): void;
    /** Something changed that should be persisted (debounced autosave + history). */
    onChanged(): void;
    /** A drag/resize/pan finished — persist and refresh properties. */
    onInteractionEnd(): void;
    /** Double-clicked a text component — open the inline editor. */
    onEditText(comp: TextComponent): void;
    /** Delete key pressed with a selection. */
    onDeleteSelected(): void;
    onUndo(): void;
    onRedo(): void;
}

/** Owns all mouse/keyboard interaction with the card canvas. */
export class InteractionController {
    private interaction: Interaction | null = null;
    private guides: GuideLine[] = [];

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
        const deck = this.doc.deck;
        const sel = this.doc.selected;

        // 1) Selected component: pan (Alt+drag on image) or resize handles.
        if (sel) {
            if (e.altKey && sel instanceof ImageComponent && sel.hitTest(deck, p.x, p.y)) {
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
            const handle = sel.hitHandle(deck, p.x, p.y, this.handleTolerance());
            if (handle) {
                this.interaction = {
                    kind: 'resize',
                    comp: sel,
                    handle,
                    start: p,
                    origin: sel.getResizeOrigin(deck),
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
        const deck = this.doc.deck;
        const it = this.interaction;

        if (it.kind === 'pan') {
            it.comp.imageOffsetX = it.origOx + (p.x - it.start.x);
            it.comp.imageOffsetY = it.origOy + (p.y - it.start.y);
            it.comp.clampOffsets(deck);
            this.cb.onLiveChange(it.comp);
        } else if (it.kind === 'drag') {
            const comp = it.comp;
            let x = it.origX + deck.pxToIn(p.x - it.start.x);
            let y = it.origY + deck.pxToIn(p.y - it.start.y);

            // Snap to card center/edges and other components (Ctrl disables).
            this.guides = [];
            if (!e.ctrlKey) {
                const bounds = comp.getBounds(deck);
                const rect: RectIn = { x, y, w: comp.width, h: deck.pxToIn(bounds.h) };
                const others: RectIn[] = this.doc.components
                    .filter((c) => c.id !== comp.id)
                    .map((c) => {
                        const b = c.getBounds(deck);
                        return { x: c.x, y: c.y, w: c.width, h: deck.pxToIn(b.h) };
                    });
                const snap = computeSnap(rect, deck.widthInches, deck.heightInches, others, SNAP_THRESHOLD_IN);
                x = snap.x;
                y = snap.y;
                if (snap.verticalGuideIn != null) {
                    this.guides.push({ orientation: 'v', positionPx: deck.inToPx(snap.verticalGuideIn) });
                }
                if (snap.horizontalGuideIn != null) {
                    this.guides.push({ orientation: 'h', positionPx: deck.inToPx(snap.horizontalGuideIn) });
                }
            }

            // Keep at least part of the component reachable on the card.
            comp.x = Math.max(-comp.width * 0.5, Math.min(x, deck.widthInches));
            comp.y = Math.max(-0.5, y);
        } else {
            const dxIn = deck.pxToIn(p.x - it.start.x);
            const dyIn = deck.pxToIn(p.y - it.start.y);
            it.comp.applyResize(it.handle, it.origin, dxIn, dyIn);
        }
        this.renderer.render(true, this.guides);
    }

    private onMouseUp(): void {
        if (this.interaction) {
            this.interaction = null;
            this.guides = [];
            this.renderer.render();
            this.cb.onInteractionEnd();
        }
    }

    private onWheel(e: WheelEvent): void {
        const sel = this.doc.selected;
        if (!(sel instanceof ImageComponent)) return;
        const p = this.canvasPoint(e);
        if (!sel.hitTest(this.doc.deck, p.x, p.y)) return;

        e.preventDefault();
        const step = e.ctrlKey ? 0.01 : 0.05;
        const delta = e.deltaY < 0 ? step : -step;
        sel.imageScale = Math.max(0.1, Math.min(10, (sel.imageScale || 1) + delta));
        sel.clampOffsets(this.doc.deck);
        this.cb.onLiveChange(sel);
        this.renderer.render();
        this.cb.onChanged();
    }

    private updateCursor(e: MouseEvent): void {
        const p = this.canvasPoint(e);
        const deck = this.doc.deck;
        const sel = this.doc.selected;

        if (sel) {
            const handle = sel.hitHandle(deck, p.x, p.y, this.handleTolerance());
            if (handle) {
                this.canvas.style.cursor = CURSOR_BY_HANDLE[handle];
                return;
            }
            if (e.altKey && sel instanceof ImageComponent && sel.hitTest(deck, p.x, p.y)) {
                this.canvas.style.cursor = 'grab';
                return;
            }
        }
        this.canvas.style.cursor = this.doc.topmostAt(p.x, p.y) ? 'move' : 'default';
    }

    private onDblClick(e: MouseEvent): void {
        const p = this.canvasPoint(e);
        const list = this.doc.components;
        for (let i = list.length - 1; i >= 0; i--) {
            const comp = list[i];
            if (comp instanceof TextComponent && comp.hitTest(this.doc.deck, p.x, p.y)) {
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
        // Don't act on editor shortcuts while a modal dialog is open.
        if (document.querySelector('.modal-overlay.open')) return;

        // Undo/redo.
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.cb.onUndo();
                return;
            }
            if (key === 'y' || (key === 'z' && e.shiftKey)) {
                e.preventDefault();
                this.cb.onRedo();
                return;
            }
        }

        if (this.doc.selectedId == null) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.cb.onDeleteSelected();
        } else if (e.key === 'Escape') {
            this.doc.select(null);
            this.renderer.render();
            this.cb.onSelectionChanged();
        } else if (e.key.startsWith('Arrow')) {
            const comp = this.doc.selected;
            if (!comp) return;
            e.preventDefault();
            const step = e.shiftKey ? NUDGE_COARSE_IN : NUDGE_FINE_IN;
            if (e.key === 'ArrowLeft') comp.x -= step;
            else if (e.key === 'ArrowRight') comp.x += step;
            else if (e.key === 'ArrowUp') comp.y -= step;
            else if (e.key === 'ArrowDown') comp.y += step;
            const deck = this.doc.deck;
            comp.x = Math.max(-comp.width * 0.5, Math.min(comp.x, deck.widthInches));
            comp.y = Math.max(-0.5, comp.y);
            this.renderer.render();
            this.cb.onLiveChange(comp);
            this.cb.onChanged();
        }
    }
}

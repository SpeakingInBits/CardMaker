import './styles.css';

import { CardDocument } from './models/CardDocument';
import { ImageComponent } from './models/ImageComponent';
import type { TextComponent } from './models/TextComponent';
import { CardRenderer } from './rendering/CardRenderer';
import { HistoryManager } from './history/HistoryManager';
import { InteractionController } from './interaction/InteractionController';
import { InlineTextEditor } from './interaction/InlineTextEditor';
import { TemplateStore } from './storage/TemplateStore';
import { BackgroundPanel } from './ui/BackgroundPanel';
import { CardListPanel } from './ui/CardListPanel';
import { CardSettingsPanel } from './ui/CardSettingsPanel';
import { ComponentListPanel } from './ui/ComponentListPanel';
import { PrintDialog } from './ui/PrintDialog';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { TemplateModal } from './ui/TemplateModal';
import { ToastManager } from './ui/ToastManager';
import { ViewportController } from './ui/ViewportController';
import type { AnyTemplateData, FaceId } from './types';
import { byId } from './utils/dom';
import { importImageFile, optimizationMessage, recommendedMaxDimension } from './utils/imageProcessing';

const AUTOSAVE_DELAY_MS = 400;
const HISTORY_DEBOUNCE_MS = 400;

/** Top-level application: owns the document and coordinates all UI pieces. */
class CardMakerApp {
    private readonly doc = new CardDocument();
    private readonly store = new TemplateStore();
    private readonly toasts = new ToastManager();
    private readonly history = new HistoryManager();
    private readonly canvas = byId<HTMLCanvasElement>('cardCanvas');
    private readonly renderer = new CardRenderer(this.canvas, this.doc);
    private readonly inlineEditor = new InlineTextEditor(byId('canvasScroller'), this.canvas);

    private readonly undoBtn = byId<HTMLButtonElement>('undoBtn');
    private readonly redoBtn = byId<HTMLButtonElement>('redoBtn');
    private readonly zoomReadout = byId<HTMLElement>('zoomReadout');
    private readonly faceButtons: Record<FaceId, HTMLButtonElement> = {
        front: byId<HTMLButtonElement>('faceFrontBtn'),
        back: byId<HTMLButtonElement>('faceBackBtn'),
    };

    private readonly viewport = new ViewportController(byId('canvasViewport'), this.canvas, (pct, isFit) => {
        this.zoomReadout.textContent = isFit ? `Fit · ${pct}%` : `${pct}%`;
    });

    private autoSaveTimer: number | null = null;
    private historyTimer: number | null = null;
    /** Unsaved changes since the last explicit save/load/import. */
    private dirty = false;
    /** True while an undo/redo snapshot is being applied. */
    private restoring = false;

    private readonly settingsPanel = new CardSettingsPanel(() => this.doc.deck, {
        onSizeChange: () => {
            this.renderer.resizeToCard();
            this.renderer.render();
            this.viewport.apply();
            this.markChanged(true);
        },
    });

    private readonly backgroundPanel = new BackgroundPanel(
        () => this.doc.activeFace,
        () => this.maxImageDimension(),
        {
            onBackgroundChange: () => {
                this.renderer.render();
                this.markChanged(true);
            },
            onInfo: (msg) => this.toasts.info(msg),
            onError: (msg) => this.toasts.error(msg),
        },
    );

    private readonly cardListPanel = new CardListPanel(this.doc, {
        onSelect: (id) => {
            this.doc.setActiveCard(id);
            this.refreshAll();
        },
        onAdd: () => {
            this.doc.addCard();
            this.refreshAll();
            this.markChanged(true);
        },
        onDuplicate: (id) => {
            void this.doc.duplicateCard(id).then((copy) => {
                if (!copy) return;
                this.refreshAll();
                this.markChanged(true);
            });
        },
        onDelete: (id) => {
            const name = this.doc.cards.find((c) => c.id === id)?.name ?? 'card';
            if (!this.doc.removeCard(id)) {
                this.toasts.info('A deck needs at least one card.');
                return;
            }
            this.refreshAll();
            this.markChanged(true);
            this.toasts.info(`Deleted "${name}" (Ctrl+Z to undo).`);
        },
        onRename: (id, name) => {
            const card = this.doc.cards.find((c) => c.id === id);
            if (card) card.name = name;
            this.cardListPanel.render();
            this.markChanged(true);
        },
        onCopiesChange: (id, copies) => {
            const card = this.doc.cards.find((c) => c.id === id);
            if (card) card.copies = copies;
            this.markChanged(false);
        },
    });

    private readonly componentListPanel = new ComponentListPanel(
        byId('componentList'),
        byId('compListHint'),
        this.doc,
        {
            onSelect: (id) => {
                this.doc.select(id);
                this.renderer.render();
                this.componentListPanel.render();
                this.propertiesPanel.render();
            },
            onMove: (id, dir) => {
                this.doc.move(id, dir);
                this.afterComponentChange();
            },
            onDelete: (id) => this.deleteComponent(id),
        },
    );

    private readonly propertiesPanel = new PropertiesPanel(byId('propertiesPanel'), this.doc, {
        onLightChange: () => {
            this.renderer.render();
            this.componentListPanel.render();
            this.markChanged(false);
        },
        onFullChange: () => this.afterComponentChange(),
        onDelete: (id) => this.deleteComponent(id),
        onInfo: (msg) => this.toasts.info(msg),
        onError: (msg) => this.toasts.error(msg),
    });

    private readonly modal = new TemplateModal(this.store, {
        serialize: () => this.doc.serialize(),
        getName: () => this.doc.deck.name,
        setName: (name) => (this.doc.deck.name = name),
        confirmLoad: () =>
            !this.dirty ||
            confirm('Loading a deck will replace your current work. Continue?'),
        onLoad: (data) => void this.loadTemplate(data),
        onSaved: (name) => {
            this.dirty = false;
            this.toasts.success(`Deck "${name}" saved.`);
        },
        onError: (msg) => this.toasts.error(msg),
    });

    private readonly printDialog = new PrintDialog(this.doc, {
        onSuccess: (msg) => this.toasts.success(msg),
        onError: (msg) => this.toasts.error(msg),
    });

    constructor() {
        new InteractionController(this.canvas, this.doc, this.renderer, {
            onSelectionChanged: () => {
                this.componentListPanel.render();
                this.propertiesPanel.render();
            },
            onLiveChange: (comp) => {
                this.propertiesPanel.syncPosition(comp);
                if (comp instanceof ImageComponent) this.propertiesPanel.syncPanZoom(comp);
            },
            onChanged: () => this.markChanged(false),
            onInteractionEnd: () => {
                this.propertiesPanel.render();
                this.markChanged(true);
            },
            onEditText: (comp) => this.editTextInline(comp),
            onDeleteSelected: () => {
                if (this.doc.selectedId != null) this.deleteComponent(this.doc.selectedId);
            },
            onUndo: () => void this.undo(),
            onRedo: () => void this.redo(),
        });
        this.wireToolbar();
        this.wireFaceSwitch();
        this.wireZoomControls();
    }

    async init(): Promise<void> {
        await this.loadAutoSave();
        this.renderer.resizeToCard();
        this.refreshAll();
        this.viewport.fit();
        this.history.reset(JSON.stringify(this.doc.serialize()));
        this.dirty = false;
        this.updateUndoRedoButtons();
    }

    // ---------- Toolbar ----------
    private wireToolbar(): void {
        byId('addTextBtn').addEventListener('click', () => {
            this.doc.addText();
            this.afterComponentChange();
        });

        const addImageInput = byId<HTMLInputElement>('addImageInput');
        byId('addImageBtn').addEventListener('click', () => addImageInput.click());
        addImageInput.addEventListener('change', async () => {
            const file = addImageInput.files?.[0];
            addImageInput.value = '';
            if (!file) return;
            try {
                const result = await importImageFile(file, this.maxImageDimension());
                this.doc.addImage(result.image, result.dataUrl);
                const msg = optimizationMessage(result);
                if (msg) this.toasts.info(msg);
                this.afterComponentChange();
            } catch (err) {
                console.error('Failed to load image:', err);
                this.toasts.error('Could not load that image. Please try a different file.');
            }
        });

        this.undoBtn.addEventListener('click', () => void this.undo());
        this.redoBtn.addEventListener('click', () => void this.redo());

        byId('saveTemplateBtn').addEventListener('click', () => this.modal.open('save'));
        byId('loadTemplateBtn').addEventListener('click', () => this.modal.open('load'));
        byId('exportTemplateBtn').addEventListener('click', () => this.exportTemplateJSON());

        const importInput = byId<HTMLInputElement>('importTemplateInput');
        byId('importTemplateBtn').addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', async () => {
            const file = importInput.files?.[0];
            importInput.value = '';
            if (!file) return;
            if (this.dirty && !confirm('Importing a deck will replace your current work. Continue?')) {
                return;
            }
            try {
                const data = JSON.parse(await file.text()) as AnyTemplateData;
                const looksV3 = 'deck' in data && !!data.deck && Array.isArray((data as { cards?: unknown }).cards);
                const looksV2 = 'card' in data && !!data.card && Array.isArray((data as { components?: unknown }).components);
                if (!data || typeof data !== 'object' || (!looksV3 && !looksV2)) {
                    this.toasts.error('Invalid deck file.');
                    return;
                }
                await this.loadTemplate(data);
                this.toasts.success('Deck imported.');
            } catch (err) {
                this.toasts.error(`Error reading deck: ${err instanceof Error ? err.message : err}`);
            }
        });

        byId('exportPngBtn').addEventListener('click', () => this.exportPng());
        byId('printSheetBtn').addEventListener('click', () => this.printDialog.open());
    }

    // ---------- Face switching ----------
    private wireFaceSwitch(): void {
        for (const face of ['front', 'back'] as const) {
            this.faceButtons[face].addEventListener('click', () => {
                this.doc.setActiveFace(face);
                this.refreshAll();
            });
        }
    }

    private syncFaceUI(): void {
        for (const face of ['front', 'back'] as const) {
            this.faceButtons[face].classList.toggle('active', this.doc.activeFaceId === face);
        }
        const tag = this.doc.activeFaceId;
        byId('bgFaceTag').textContent = tag;
        byId('compFaceTag').textContent = tag;
    }

    // ---------- Zoom ----------
    private wireZoomControls(): void {
        byId('zoomInBtn').addEventListener('click', () => this.viewport.zoomIn());
        byId('zoomOutBtn').addEventListener('click', () => this.viewport.zoomOut());
        byId('zoomFitBtn').addEventListener('click', () => this.viewport.fit());
    }

    // ---------- Shared refresh paths ----------
    /** Redraw everything and resync all panels to the current document. */
    private refreshAll(): void {
        this.renderer.render();
        this.cardListPanel.render();
        this.componentListPanel.render();
        this.propertiesPanel.render();
        this.backgroundPanel.syncFromFace();
        this.syncFaceUI();
    }

    private afterComponentChange(): void {
        this.renderer.render();
        this.componentListPanel.render();
        this.propertiesPanel.render();
        this.markChanged(true);
    }

    private deleteComponent(id: number): void {
        this.doc.remove(id);
        this.afterComponentChange();
    }

    private editTextInline(comp: TextComponent): void {
        this.inlineEditor.open(comp, this.doc.deck, () => this.afterComponentChange());
    }

    /** Largest image dimension worth storing for the current card size. */
    private maxImageDimension(): number {
        return recommendedMaxDimension(this.doc.deck.pxWidth, this.doc.deck.pxHeight);
    }

    /** Record a change: autosave (debounced), dirty flag, history commit. */
    private markChanged(immediateHistory: boolean): void {
        this.dirty = true;
        this.scheduleAutoSave();
        this.commitHistory(immediateHistory);
    }

    // ---------- Undo / redo ----------
    private commitHistory(immediate: boolean): void {
        if (this.restoring) return;
        if (this.historyTimer != null) {
            window.clearTimeout(this.historyTimer);
            this.historyTimer = null;
        }
        const doCommit = () => {
            this.historyTimer = null;
            if (this.history.commit(JSON.stringify(this.doc.serialize()))) {
                this.updateUndoRedoButtons();
            }
        };
        if (immediate) doCommit();
        else this.historyTimer = window.setTimeout(doCommit, HISTORY_DEBOUNCE_MS);
    }

    /** Flush a pending debounced history commit before undoing/redoing. */
    private flushHistory(): void {
        if (this.historyTimer != null) {
            window.clearTimeout(this.historyTimer);
            this.historyTimer = null;
            if (this.history.commit(JSON.stringify(this.doc.serialize()))) {
                this.updateUndoRedoButtons();
            }
        }
    }

    private async undo(): Promise<void> {
        if (this.restoring) return;
        this.flushHistory();
        const snapshot = this.history.undo();
        if (snapshot != null) await this.applySnapshot(snapshot);
    }

    private async redo(): Promise<void> {
        if (this.restoring) return;
        this.flushHistory();
        const snapshot = this.history.redo();
        if (snapshot != null) await this.applySnapshot(snapshot);
    }

    private async applySnapshot(snapshot: string): Promise<void> {
        this.restoring = true;
        try {
            const prevCardId = this.doc.activeCardId;
            const prevFaceId = this.doc.activeFaceId;
            await this.doc.load(JSON.parse(snapshot) as AnyTemplateData);
            // Stay on the same card/face when they still exist.
            if (this.doc.cards.some((c) => c.id === prevCardId)) this.doc.setActiveCard(prevCardId);
            this.doc.setActiveFace(prevFaceId);

            this.settingsPanel.syncFromDeck();
            this.renderer.resizeToCard();
            this.viewport.apply();
            this.refreshAll();
            this.dirty = true;
            this.scheduleAutoSave();
        } catch (err) {
            console.error('Failed to restore snapshot:', err);
            this.toasts.error('Undo failed to restore that state.');
        } finally {
            this.restoring = false;
        }
        this.updateUndoRedoButtons();
    }

    private updateUndoRedoButtons(): void {
        this.undoBtn.disabled = !this.history.canUndo;
        this.redoBtn.disabled = !this.history.canRedo;
    }

    // ---------- Templates ----------
    private async loadTemplate(data: AnyTemplateData): Promise<void> {
        await this.doc.load(data);
        this.settingsPanel.syncFromDeck();
        this.renderer.resizeToCard();
        this.viewport.apply();
        this.refreshAll();
        this.history.reset(JSON.stringify(this.doc.serialize()));
        this.updateUndoRedoButtons();
        this.dirty = false;
        this.scheduleAutoSave();
    }

    private exportFileName(suffix: string): string {
        return `${this.doc.deck.name.replace(/[^a-zA-Z0-9_-]/g, '_')}${suffix}`;
    }

    private exportTemplateJSON(): void {
        const blob = new Blob([JSON.stringify(this.doc.serialize(), null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.exportFileName('_deck.json');
        a.click();
        URL.revokeObjectURL(url);
        this.toasts.success('Deck exported as JSON.');
    }

    private exportPng(): void {
        const { deck } = this.doc;
        const card = this.doc.activeCard;
        const cardName = card.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const a = document.createElement('a');
        a.download = this.exportFileName(
            `_${cardName}_${this.doc.activeFaceId}_${deck.widthInches}x${deck.heightInches}in_${deck.dpi}dpi.png`,
        );
        a.href = this.renderer.exportPngDataUrl();
        a.click();
        this.toasts.success(`Exported ${card.name} (${this.doc.activeFaceId}) as PNG.`);
    }

    // ---------- Autosave ----------
    private scheduleAutoSave(): void {
        if (this.autoSaveTimer != null) window.clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = window.setTimeout(() => {
            this.store.saveAutosave(this.doc.serialize()).catch((err) => {
                console.warn('Auto-save failed:', err);
            });
        }, AUTOSAVE_DELAY_MS);
    }

    private async loadAutoSave(): Promise<void> {
        try {
            const data = await this.store.loadAutosave();
            if (!data || typeof data !== 'object') return;
            await this.doc.load(data);
            this.settingsPanel.syncFromDeck();
        } catch (err) {
            console.warn('Auto-save load failed:', err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    void new CardMakerApp().init();
});

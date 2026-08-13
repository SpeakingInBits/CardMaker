import './styles.css';

import { CardDocument } from './models/CardDocument';
import type { TextComponent } from './models/TextComponent';
import { CardRenderer } from './rendering/CardRenderer';
import { InteractionController } from './interaction/InteractionController';
import { InlineTextEditor } from './interaction/InlineTextEditor';
import { TemplateStore } from './storage/TemplateStore';
import { BackgroundPanel } from './ui/BackgroundPanel';
import { CardSettingsPanel } from './ui/CardSettingsPanel';
import { ComponentListPanel } from './ui/ComponentListPanel';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { TemplateModal } from './ui/TemplateModal';
import type { TemplateData } from './types';
import { byId, loadImage, readFileAsDataURL } from './utils/dom';

const AUTOSAVE_DELAY_MS = 400;

/** Top-level application: owns the document and coordinates all UI pieces. */
class CardMakerApp {
    private readonly doc = new CardDocument();
    private readonly store = new TemplateStore();
    private readonly canvas = byId<HTMLCanvasElement>('cardCanvas');
    private readonly renderer = new CardRenderer(this.canvas, this.doc);
    private readonly inlineEditor = new InlineTextEditor(byId('canvasScroller'), this.canvas);
    private autoSaveTimer: number | null = null;

    private readonly settingsPanel = new CardSettingsPanel(() => this.doc.card, {
        onSizeChange: () => {
            this.renderer.resizeToCard();
            this.renderer.render();
            this.scheduleAutoSave();
        },
    });

    private readonly backgroundPanel = new BackgroundPanel(() => this.doc.card, {
        onBackgroundChange: () => {
            this.renderer.render();
            this.scheduleAutoSave();
        },
    });

    private readonly listPanel = new ComponentListPanel(
        byId('componentList'),
        byId('compListHint'),
        this.doc,
        {
            onSelect: (id) => {
                this.doc.select(id);
                this.refreshSelectionUI();
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
            this.listPanel.render();
            this.scheduleAutoSave();
        },
        onFullChange: () => this.afterComponentChange(),
        onDelete: (id) => this.deleteComponent(id),
    });

    private readonly modal = new TemplateModal(this.store, {
        serialize: () => this.doc.serialize(),
        getName: () => this.doc.card.name,
        setName: (name) => (this.doc.card.name = name),
        onLoad: (data) => void this.loadTemplate(data),
    });

    constructor() {
        new InteractionController(this.canvas, this.doc, this.renderer, {
            onSelectionChanged: () => {
                this.listPanel.render();
                this.propertiesPanel.render();
            },
            onLiveChange: (comp) => this.propertiesPanel.syncPanZoom(comp),
            onChanged: () => this.scheduleAutoSave(),
            onInteractionEnd: () => {
                this.scheduleAutoSave();
                this.propertiesPanel.render();
            },
            onEditText: (comp) => this.editTextInline(comp),
            onDeleteSelected: () => {
                if (this.doc.selectedId != null) this.deleteComponent(this.doc.selectedId);
            },
        });
        this.wireToolbar();
    }

    async init(): Promise<void> {
        await this.loadAutoSave();
        this.renderer.resizeToCard();
        this.renderer.render();
        this.listPanel.render();
        this.propertiesPanel.render();
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
                const dataUrl = await readFileAsDataURL(file);
                this.doc.addImage(await loadImage(dataUrl), dataUrl);
                this.afterComponentChange();
            } catch (err) {
                console.error('Failed to load image:', err);
                alert('Could not load that image. Please try a different file.');
            }
        });

        byId('saveTemplateBtn').addEventListener('click', () => this.modal.open('save'));
        byId('loadTemplateBtn').addEventListener('click', () => this.modal.open('load'));
        byId('exportTemplateBtn').addEventListener('click', () => this.exportTemplateJSON());

        const importInput = byId<HTMLInputElement>('importTemplateInput');
        byId('importTemplateBtn').addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', async () => {
            const file = importInput.files?.[0];
            importInput.value = '';
            if (!file) return;
            try {
                const data = JSON.parse(await file.text()) as TemplateData;
                if (!data || typeof data !== 'object' || !data.card || !Array.isArray(data.components)) {
                    alert('Invalid template file.');
                    return;
                }
                await this.loadTemplate(data);
            } catch (err) {
                alert(`Error reading template: ${err instanceof Error ? err.message : err}`);
            }
        });

        byId('exportPngBtn').addEventListener('click', () => this.exportPng());
    }

    // ---------- Shared refresh paths ----------
    private afterComponentChange(): void {
        this.renderer.render();
        this.listPanel.render();
        this.propertiesPanel.render();
        this.scheduleAutoSave();
    }

    private refreshSelectionUI(): void {
        this.renderer.render();
        this.listPanel.render();
        this.propertiesPanel.render();
    }

    private deleteComponent(id: number): void {
        this.doc.remove(id);
        this.afterComponentChange();
    }

    private editTextInline(comp: TextComponent): void {
        this.inlineEditor.open(comp, this.doc.card, () => this.afterComponentChange());
    }

    // ---------- Templates ----------
    private async loadTemplate(data: TemplateData): Promise<void> {
        await this.doc.load(data);
        this.settingsPanel.syncFromCard();
        this.backgroundPanel.syncFromCard();
        this.renderer.resizeToCard();
        this.afterComponentChange();
    }

    private exportFileName(suffix: string): string {
        return `${this.doc.card.name.replace(/[^a-zA-Z0-9_-]/g, '_')}${suffix}`;
    }

    private exportTemplateJSON(): void {
        const blob = new Blob([JSON.stringify(this.doc.serialize(), null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.exportFileName('_template.json');
        a.click();
        URL.revokeObjectURL(url);
    }

    private exportPng(): void {
        const { card } = this.doc;
        const a = document.createElement('a');
        a.download = this.exportFileName(`_${card.widthInches}x${card.heightInches}in_${card.dpi}dpi.png`);
        a.href = this.renderer.exportPngDataUrl();
        a.click();
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
            if (!data || !data.card || !Array.isArray(data.components)) return;
            await this.doc.load(data);
            this.settingsPanel.syncFromCard();
            this.backgroundPanel.syncFromCard();
        } catch (err) {
            console.warn('Auto-save load failed:', err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    void new CardMakerApp().init();
});

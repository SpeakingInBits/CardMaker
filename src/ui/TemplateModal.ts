import type { TemplateStore } from '../storage/TemplateStore';
import type { TemplateData } from '../types';
import { byId, escapeHtml } from '../utils/dom';

export interface TemplateModalCallbacks {
    serialize(): TemplateData;
    getName(): string;
    setName(name: string): void;
    onLoad(data: TemplateData): void;
}

/** Save/Load template dialog backed by the TemplateStore. */
export class TemplateModal {
    private readonly overlay = byId<HTMLElement>('templateModal');
    private readonly title = byId<HTMLElement>('modalTitle');
    private readonly saveSection = byId<HTMLElement>('modalSaveSection');
    private readonly nameInput = byId<HTMLInputElement>('templateNameInput');
    private readonly list = byId<HTMLElement>('savedTemplatesList');

    constructor(
        private readonly store: TemplateStore,
        private readonly cb: TemplateModalCallbacks,
    ) {
        byId('modalClose').addEventListener('click', () => this.close());
        byId('modalSaveBtn').addEventListener('click', () => void this.save());
        this.overlay.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).id === 'templateModal') this.close();
        });
    }

    open(mode: 'save' | 'load'): void {
        this.title.textContent = mode === 'save' ? 'Save Template' : 'Load Template';
        this.saveSection.style.display = mode === 'save' ? 'block' : 'none';
        if (mode === 'save') this.nameInput.value = this.cb.getName();
        void this.renderList();
        this.overlay.classList.add('open');
    }

    close(): void {
        this.overlay.classList.remove('open');
    }

    private async save(): Promise<void> {
        const name = this.nameInput.value.trim() || 'Untitled';
        this.cb.setName(name);
        try {
            await this.store.saveTemplate({
                name,
                savedAt: new Date().toISOString(),
                data: this.cb.serialize(),
            });
            await this.renderList();
            this.close();
        } catch (err) {
            console.error('Failed to save template:', err);
            alert('Failed to save template. Please try again.');
        }
    }

    private async renderList(): Promise<void> {
        let templates: Awaited<ReturnType<TemplateStore['listTemplates']>> = [];
        try {
            templates = await this.store.listTemplates();
        } catch (err) {
            console.error('Failed to load templates:', err);
        }

        if (!templates.length) {
            this.list.innerHTML = '<p class="hint">No saved templates</p>';
            return;
        }

        this.list.innerHTML = templates
            .map(
                (t) => `
            <div class="template-item">
                <span class="template-item-name">${escapeHtml(t.name)}</span>
                <span class="template-item-date">${new Date(t.savedAt).toLocaleDateString()}</span>
                <button class="load-btn" data-name="${escapeHtml(t.name)}">Load</button>
                <button class="del-btn" data-name="${escapeHtml(t.name)}">✕</button>
            </div>`,
            )
            .join('');

        this.list.querySelectorAll<HTMLButtonElement>('.load-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = templates.find((t) => t.name === btn.dataset.name);
                if (t) {
                    this.cb.onLoad(t.data);
                    this.close();
                }
            });
        });
        this.list.querySelectorAll<HTMLButtonElement>('.del-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const name = btn.dataset.name ?? '';
                if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
                try {
                    await this.store.deleteTemplate(name);
                    await this.renderList();
                } catch (err) {
                    console.error('Failed to delete template:', err);
                }
            });
        });
    }
}

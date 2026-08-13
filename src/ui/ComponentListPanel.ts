import type { CardDocument } from '../models/CardDocument';
import { escapeHtml } from '../utils/dom';

export interface ComponentListCallbacks {
    onSelect(id: number): void;
    onMove(id: number, dir: -1 | 1): void;
    onDelete(id: number): void;
}

/** Left-sidebar list of components (z-order, selection, reorder, delete). */
export class ComponentListPanel {
    constructor(
        private readonly container: HTMLElement,
        private readonly hint: HTMLElement,
        private readonly doc: CardDocument,
        private readonly cb: ComponentListCallbacks,
    ) {}

    render(): void {
        this.container.innerHTML = '';
        this.hint.style.display = this.doc.components.length ? 'none' : 'block';

        for (const comp of this.doc.components) {
            const div = document.createElement('div');
            div.className = 'comp-item' + (comp.id === this.doc.selectedId ? ' selected' : '');

            const icon = comp.type === 'text' ? 'T' : '🖼️';
            div.innerHTML = `
                <span class="comp-item-icon">${icon}</span>
                <span class="comp-item-label">${escapeHtml(comp.label)}</span>
                <span class="comp-item-actions">
                    <button title="Move up"   data-act="up">▲</button>
                    <button title="Move down" data-act="down">▼</button>
                    <button title="Delete"    data-act="del">✕</button>
                </span>`;

            div.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                this.cb.onSelect(comp.id);
            });

            div.querySelectorAll('button').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const act = btn.dataset.act;
                    if (act === 'up') this.cb.onMove(comp.id, -1);
                    else if (act === 'down') this.cb.onMove(comp.id, 1);
                    else if (act === 'del') this.cb.onDelete(comp.id);
                });
            });

            this.container.appendChild(div);
        }
    }
}

import type { CardDocument } from '../models/CardDocument';
import { MAX_COPIES } from '../models/DeckCard';
import { byId, escapeHtml } from '../utils/dom';

export interface CardListCallbacks {
    onSelect(id: number): void;
    onAdd(): void;
    onDuplicate(id: number): void;
    onDelete(id: number): void;
    onRename(id: number, name: string): void;
    onCopiesChange(id: number, copies: number): void;
}

/** Left-sidebar list of the deck's cards (select, add, duplicate, rename, copies). */
export class CardListPanel {
    private readonly container = byId<HTMLElement>('cardList');

    constructor(
        private readonly doc: CardDocument,
        private readonly cb: CardListCallbacks,
    ) {
        byId('addCardBtn').addEventListener('click', () => this.cb.onAdd());
    }

    render(): void {
        this.container.innerHTML = '';
        const single = this.doc.cards.length === 1;

        for (const card of this.doc.cards) {
            const div = document.createElement('div');
            div.className = 'card-item' + (card.id === this.doc.activeCardId ? ' selected' : '');
            div.innerHTML = `
                <span class="card-item-name" title="Double-click to rename">${escapeHtml(card.name)}</span>
                <label class="card-copies" title="Copies on the print sheet">×<input type="number" min="1" max="${MAX_COPIES}" step="1"></label>
                <span class="card-item-actions">
                    <button title="Duplicate card" data-act="dup">⧉</button>
                    <button title="Delete card" data-act="del" ${single ? 'disabled' : ''}>✕</button>
                </span>`;

            const copiesInput = div.querySelector<HTMLInputElement>('.card-copies input')!;
            copiesInput.value = String(card.copies);
            copiesInput.addEventListener('click', (e) => e.stopPropagation());
            copiesInput.addEventListener('change', () => {
                const v = Math.round(parseFloat(copiesInput.value));
                const copies = Number.isFinite(v) ? Math.min(MAX_COPIES, Math.max(1, v)) : card.copies;
                copiesInput.value = String(copies);
                this.cb.onCopiesChange(card.id, copies);
            });

            div.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('button, input, .rename-input')) return;
                this.cb.onSelect(card.id);
            });

            const nameEl = div.querySelector<HTMLElement>('.card-item-name')!;
            nameEl.addEventListener('dblclick', () => this.startRename(card.id, nameEl));

            div.querySelectorAll('button').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (btn.dataset.act === 'dup') this.cb.onDuplicate(card.id);
                    else if (btn.dataset.act === 'del') this.cb.onDelete(card.id);
                });
            });

            this.container.appendChild(div);
        }
    }

    private startRename(id: number, nameEl: HTMLElement): void {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input';
        input.value = nameEl.textContent ?? '';
        input.maxLength = 60;
        nameEl.replaceWith(input);
        input.focus();
        input.select();

        let done = false;
        const commit = () => {
            if (done) return;
            done = true;
            const name = input.value.trim();
            if (name) this.cb.onRename(id, name);
            else this.render();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
                done = true;
                this.render();
            }
        });
    }
}

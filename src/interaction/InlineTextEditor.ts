import type { Card } from '../models/Card';
import type { TextComponent } from '../models/TextComponent';

/** Overlay textarea for editing a text component in place on the canvas. */
export class InlineTextEditor {
    constructor(
        private readonly scroller: HTMLElement,
        private readonly canvas: HTMLCanvasElement,
    ) {}

    open(comp: TextComponent, card: Card, onCommit: () => void): void {
        // Only one editor at a time.
        this.scroller.querySelectorAll('.inline-text-editor').forEach((el) => el.remove());

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        const bounds = comp.getBounds(card);

        const ta = document.createElement('textarea');
        ta.className = 'inline-text-editor';
        ta.value = comp.text;
        ta.style.left = `${bounds.x * scaleX}px`;
        ta.style.top = `${bounds.y * scaleY}px`;
        ta.style.width = `${Math.max(60, bounds.w * scaleX)}px`;
        ta.style.height = `${Math.max(30, bounds.h * scaleY)}px`;
        ta.style.fontSize = `${Math.max(10, card.ptToPx(comp.fontSize) * scaleY * 0.9)}px`;
        ta.style.fontFamily = comp.font;

        let committed = false;
        const commit = () => {
            if (committed) return;
            committed = true;
            comp.text = ta.value;
            ta.remove();
            onCommit();
        };

        ta.addEventListener('blur', commit);
        ta.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                committed = true;
                ta.remove();
            } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
                ev.preventDefault();
                commit();
            }
        });

        this.scroller.appendChild(ta);
        ta.focus();
        ta.select();
    }
}

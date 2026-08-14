export type ToastKind = 'info' | 'success' | 'error';

/** Non-blocking notifications, replacing alert(). */
export class ToastManager {
    private readonly container: HTMLElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
    }

    show(message: string, kind: ToastKind = 'info', durationMs = 3500): void {
        const toast = document.createElement('div');
        toast.className = `toast toast-${kind}`;
        toast.textContent = message;
        toast.addEventListener('click', () => this.dismiss(toast));
        this.container.appendChild(toast);

        // Trigger the enter transition on the next frame.
        requestAnimationFrame(() => toast.classList.add('toast-visible'));
        window.setTimeout(() => this.dismiss(toast), durationMs);
    }

    info(message: string): void {
        this.show(message, 'info');
    }

    success(message: string): void {
        this.show(message, 'success');
    }

    error(message: string): void {
        this.show(message, 'error', 5000);
    }

    private dismiss(toast: HTMLElement): void {
        if (!toast.isConnected) return;
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        // Fallback removal in case transitions are disabled.
        window.setTimeout(() => toast.remove(), 500);
    }
}

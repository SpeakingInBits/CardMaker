/** Get an element by id, throwing if it is missing (fail fast on broken markup). */
export function byId<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Decode cache so re-loading the same data URL (undo/redo, duplicate card,
// autosave restore) reuses the already-decoded image instead of decoding again.
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const IMAGE_CACHE_LIMIT = 48;

export function loadImage(src: string): Promise<HTMLImageElement> {
    const cached = imageCache.get(src);
    if (cached) return cached;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            imageCache.delete(src);
            reject(new Error('Failed to load image'));
        };
        img.src = src;
    });

    imageCache.set(src, promise);
    if (imageCache.size > IMAGE_CACHE_LIMIT) {
        const oldest = imageCache.keys().next().value;
        if (oldest !== undefined) imageCache.delete(oldest);
    }
    return promise;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Coerce an untrusted value to a finite number, falling back if invalid. */
export function toFiniteNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : fallback;
}

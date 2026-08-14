import type { BackgroundFit, ComponentData, FaceData } from '../types';
import { loadImage } from '../utils/dom';
import { CardComponent } from './CardComponent';
import { ImageComponent } from './ImageComponent';
import { TextComponent } from './TextComponent';

export function componentFromJSON(data: ComponentData): CardComponent | null {
    if (!data || typeof data !== 'object') return null;
    if (data.type === 'text') return TextComponent.fromJSON(data);
    if (data.type === 'image') return ImageComponent.fromJSON(data);
    return null;
}

/**
 * One side of a card: its background plus an ordered component list
 * (first = bottom of the z-order).
 */
export class CardFace {
    backgroundImageData: string | null = null;
    backgroundFit: BackgroundFit = 'cover';
    /** Runtime-only decoded image; never serialized. */
    backgroundImage: HTMLImageElement | null = null;

    components: CardComponent[] = [];

    async setBackground(dataUrl: string): Promise<void> {
        this.backgroundImage = await loadImage(dataUrl);
        this.backgroundImageData = dataUrl;
    }

    removeBackground(): void {
        this.backgroundImageData = null;
        this.backgroundImage = null;
    }

    /** True if this face has any visible content (used for print-sheet hints). */
    get hasContent(): boolean {
        return this.backgroundImageData != null || this.components.length > 0;
    }

    /** Decode all stored image data URLs into drawable images. */
    async loadRuntimeImages(): Promise<void> {
        const jobs: Promise<void>[] = [];
        if (this.backgroundImageData) {
            jobs.push(
                loadImage(this.backgroundImageData).then(
                    (img) => void (this.backgroundImage = img),
                    () => void (this.backgroundImage = null),
                ),
            );
        } else {
            this.backgroundImage = null;
        }
        for (const comp of this.components) {
            if (comp instanceof ImageComponent) jobs.push(comp.loadRuntimeImage());
        }
        await Promise.all(jobs);
    }

    toJSON(): FaceData {
        return {
            backgroundImageData: this.backgroundImageData,
            backgroundFit: this.backgroundFit,
            components: this.components.map((c) => c.toJSON()),
        };
    }

    static fromJSON(data: Partial<FaceData> | undefined): CardFace {
        const face = new CardFace();
        if (!data) return face;
        face.backgroundImageData =
            typeof data.backgroundImageData === 'string' ? data.backgroundImageData : null;
        face.backgroundFit = data.backgroundFit === 'stretch' ? 'stretch' : 'cover';
        face.components = (Array.isArray(data.components) ? data.components : [])
            .map(componentFromJSON)
            .filter((c): c is CardComponent => c !== null);
        return face;
    }
}

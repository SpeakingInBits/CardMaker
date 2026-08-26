import { describe, expect, it } from 'vitest';
import type { ComponentData, TextComponentData } from '../types';
import { CardFace, componentFromJSON } from './CardFace';
import { ImageComponent } from './ImageComponent';
import { TextComponent } from './TextComponent';

function textData(overrides: Partial<TextComponentData> = {}): TextComponentData {
    return {
        id: 1,
        type: 'text',
        x: 0.1,
        y: 0.2,
        width: 2,
        borderWidth: 0,
        borderColor: '#000000',
        text: 'Hello',
        font: 'Arial',
        fontSize: 24,
        color: '#000000',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        bgColor: '#ffffff',
        bgOpacity: 0,
        padding: 4,
        height: null,
        ...overrides,
    };
}

describe('componentFromJSON', () => {
    it('builds the right subclass per type', () => {
        expect(componentFromJSON(textData())).toBeInstanceOf(TextComponent);
        expect(
            componentFromJSON({
                id: 2,
                type: 'image',
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                borderWidth: 0,
                borderColor: '#000000',
                imageData: null,
                cornerRadius: 0,
                imageOffsetX: 0,
                imageOffsetY: 0,
                imageScale: 1,
            }),
        ).toBeInstanceOf(ImageComponent);
    });

    it('returns null for unknown or malformed data', () => {
        expect(componentFromJSON({ type: 'video' } as unknown as ComponentData)).toBeNull();
        expect(componentFromJSON(null as unknown as ComponentData)).toBeNull();
        expect(componentFromJSON('text' as unknown as ComponentData)).toBeNull();
    });
});

describe('CardFace', () => {
    it('starts empty with a cover background fit', () => {
        const face = new CardFace();
        expect(face.backgroundImageData).toBeNull();
        expect(face.backgroundFit).toBe('cover');
        expect(face.components).toHaveLength(0);
        expect(face.hasContent).toBe(false);
    });

    it('reports content when a component or background exists', () => {
        const face = new CardFace();
        face.components.push(new TextComponent(1, 0, 0, 1));
        expect(face.hasContent).toBe(true);

        const bgOnly = new CardFace();
        bgOnly.backgroundImageData = 'data:image/png;base64,xyz';
        expect(bgOnly.hasContent).toBe(true);
    });

    it('removeBackground clears both stored data and runtime image', () => {
        const face = new CardFace();
        face.backgroundImageData = 'data:image/png;base64,xyz';
        face.removeBackground();
        expect(face.backgroundImageData).toBeNull();
        expect(face.backgroundImage).toBeNull();
    });

    it('round-trips through JSON', () => {
        const face = new CardFace();
        face.backgroundFit = 'stretch';
        face.components = [componentFromJSON(textData())!];
        const restored = CardFace.fromJSON(face.toJSON());
        expect(restored.toJSON()).toEqual(face.toJSON());
    });

    describe('fromJSON with untrusted data', () => {
        it('returns an empty face for undefined data', () => {
            const face = CardFace.fromJSON(undefined);
            expect(face.components).toHaveLength(0);
            expect(face.hasContent).toBe(false);
        });

        it('defaults an invalid background fit to cover', () => {
            expect(CardFace.fromJSON({ backgroundFit: 'zoom' as never }).backgroundFit).toBe('cover');
            expect(CardFace.fromJSON({ backgroundFit: 'stretch' }).backgroundFit).toBe('stretch');
        });

        it('drops malformed components but keeps valid ones', () => {
            const face = CardFace.fromJSON({
                components: [
                    textData(),
                    { type: 'bogus' } as unknown as ComponentData,
                    null as unknown as ComponentData,
                ],
            });
            expect(face.components).toHaveLength(1);
            expect(face.components[0]).toBeInstanceOf(TextComponent);
        });

        it('ignores a non-string background image', () => {
            const face = CardFace.fromJSON({
                backgroundImageData: 123 as unknown as string,
            });
            expect(face.backgroundImageData).toBeNull();
        });
    });
});

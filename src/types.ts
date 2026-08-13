export type ComponentType = 'text' | 'image';
export type BackgroundFit = 'cover' | 'stretch';
export type TextAlign = 'left' | 'center' | 'right';
export type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 'r' | 'b';

export interface Point {
    x: number;
    y: number;
}

/** Pixel-space bounding box on the card canvas. */
export interface Bounds {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CardData {
    name: string;
    widthInches: number;
    heightInches: number;
    dpi: number;
    backgroundImageData: string | null;
    backgroundFit: BackgroundFit;
}

export interface BaseComponentData {
    id: number;
    type: ComponentType;
    x: number;
    y: number;
    width: number;
    borderWidth: number;
    borderColor: string;
}

export interface TextComponentData extends BaseComponentData {
    type: 'text';
    text: string;
    font: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: TextAlign;
    bgColor: string;
    bgOpacity: number;
    padding: number;
    /** Explicit height in inches, or null for auto (fit content). */
    height: number | null;
}

export interface ImageComponentData extends BaseComponentData {
    type: 'image';
    height: number;
    imageData: string | null;
    cornerRadius: number;
    imageOffsetX: number;
    imageOffsetY: number;
    imageScale: number;
}

export type ComponentData = TextComponentData | ImageComponentData;

export interface TemplateData {
    version: number;
    card: CardData;
    components: ComponentData[];
    nextId: number;
}

export interface TemplateRecord {
    name: string;
    savedAt: string;
    data: TemplateData;
}

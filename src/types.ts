export type ComponentType = 'text' | 'image';
export type BackgroundFit = 'cover' | 'stretch';
export type TextAlign = 'left' | 'center' | 'right';
export type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 'r' | 'b';
export type FaceId = 'front' | 'back';

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

/** Deck-wide physical settings; every card in a deck shares size and DPI. */
export interface DeckData {
    name: string;
    widthInches: number;
    heightInches: number;
    dpi: number;
}

export interface FaceData {
    backgroundImageData: string | null;
    backgroundFit: BackgroundFit;
    components: ComponentData[];
}

export interface DeckCardData {
    id: number;
    name: string;
    /** How many copies of this card to place on the print sheet. */
    copies: number;
    faces: Record<FaceId, FaceData>;
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

/** Current (version 3) template format: a deck of cards with front/back faces. */
export interface TemplateData {
    version: number;
    deck: DeckData;
    cards: DeckCardData[];
    nextCardId: number;
    nextComponentId: number;
}

/** Version ≤2 format: a single card face stored flat (migrated on load). */
export interface LegacyTemplateData {
    version?: number;
    card: DeckData & {
        backgroundImageData?: string | null;
        backgroundFit?: BackgroundFit;
    };
    components: ComponentData[];
    nextId?: number;
}

export type AnyTemplateData = TemplateData | LegacyTemplateData;

export interface TemplateRecord {
    name: string;
    savedAt: string;
    data: AnyTemplateData;
}

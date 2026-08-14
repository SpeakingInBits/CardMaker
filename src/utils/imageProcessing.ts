import { loadImage, readFileAsDataURL } from './dom';

/** Hard bounds for imported image size regardless of card configuration. */
const MIN_TARGET_PX = 1024;
const MAX_TARGET_PX = 4096;
/** Keep this much resolution headroom over the card size for zoom/pan/crop. */
const DETAIL_HEADROOM = 2;
const JPEG_QUALITY = 0.9;

export interface ProcessedImage {
    dataUrl: string;
    image: HTMLImageElement;
    /** True when the image was downscaled/re-encoded rather than stored as-is. */
    optimized: boolean;
    bytesBefore: number;
    bytesAfter: number;
}

/**
 * Largest image dimension worth storing for a card of the given pixel size:
 * enough for full-bleed print at the deck's DPI plus zoom headroom, never
 * more than the browser can comfortably re-encode.
 */
export function recommendedMaxDimension(cardPxW: number, cardPxH: number): number {
    const target = Math.max(cardPxW, cardPxH) * DETAIL_HEADROOM;
    return Math.min(MAX_TARGET_PX, Math.max(MIN_TARGET_PX, Math.round(target)));
}

/** Downscaled dimensions that fit maxDim, preserving aspect (never upscales). */
export function computeTargetSize(
    width: number,
    height: number,
    maxDim: number,
): { width: number; height: number; scaled: boolean } {
    const scale = maxDim / Math.max(width, height);
    if (scale >= 1) return { width, height, scaled: false };
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scaled: true,
    };
}

/** Approximate decoded byte size of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
    return Math.round((dataUrl.length * 3) / 4);
}

export function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}

/**
 * Import an image file for use on a card: decode it and, when it is larger
 * than the card could ever need, downscale and re-encode it before storing.
 * Transparency is preserved (PNG); opaque images become JPEG for size.
 */
export async function importImageFile(file: File, maxDimensionPx: number): Promise<ProcessedImage> {
    const originalUrl = await readFileAsDataURL(file);
    const original = await loadImage(originalUrl);

    const target = computeTargetSize(original.width, original.height, maxDimensionPx);
    const bytesBefore = dataUrlBytes(originalUrl);
    if (!target.scaled) {
        return { dataUrl: originalUrl, image: original, optimized: false, bytesBefore, bytesAfter: bytesBefore };
    }

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return { dataUrl: originalUrl, image: original, optimized: false, bytesBefore, bytesAfter: bytesBefore };
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(original, 0, 0, target.width, target.height);

    // JPEG flattens transparency, so only use it for fully opaque images.
    const useJpeg = file.type === 'image/jpeg' || !hasTransparency(ctx, target.width, target.height);
    const resizedUrl = useJpeg ? canvas.toDataURL('image/jpeg', JPEG_QUALITY) : canvas.toDataURL('image/png');

    // Keep the original if re-encoding didn't actually help.
    if (resizedUrl.length >= originalUrl.length) {
        return { dataUrl: originalUrl, image: original, optimized: false, bytesBefore, bytesAfter: bytesBefore };
    }

    const image = await loadImage(resizedUrl);
    return {
        dataUrl: resizedUrl,
        image,
        optimized: true,
        bytesBefore,
        bytesAfter: dataUrlBytes(resizedUrl),
    };
}

/** User-facing toast text for an optimized import, or null if stored as-is. */
export function optimizationMessage(result: ProcessedImage): string | null {
    if (!result.optimized) return null;
    return `Image optimized for card size: ${formatBytes(result.bytesBefore)} → ${formatBytes(result.bytesAfter)}`;
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) return true;
    }
    return false;
}

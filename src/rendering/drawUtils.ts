/**
 * Draw an image using "cover" semantics (fill the destination rect, cropping
 * overflow), with an optional pan offset (px) and zoom factor. Offsets are
 * clamped so the image always covers the rect when zoom >= 1.
 */
export function drawCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    offsetX = 0,
    offsetY = 0,
    zoom = 1,
): void {
    const s = Math.max(dw / img.width, dh / img.height) * (zoom || 1);
    const sw = img.width * s;
    const sh = img.height * s;
    const maxOx = Math.max(0, (sw - dw) / 2);
    const maxOy = Math.max(0, (sh - dh) / 2);
    const cx = Math.max(-maxOx, Math.min(maxOx, offsetX));
    const cy = Math.max(-maxOy, Math.min(maxOy, offsetY));
    ctx.drawImage(img, dx + (dw - sw) / 2 + cx, dy + (dh - sh) / 2 + cy, sw, sh);
}

export function roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export interface Rgb {
    r: number;
    g: number;
    b: number;
}

export function hexToRgb(hex: string): Rgb {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : { r: 255, g: 255, b: 255 };
}

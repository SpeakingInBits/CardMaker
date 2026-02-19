// =============================================
// Card Maker — Main Script
// =============================================

// ===== Constants =====
const DB_NAME = 'CardMakerDB';
const DB_VERSION = 1;
const FONTS = [
    'Arial', 'Georgia', 'Times New Roman', 'Courier New',
    'Verdana', 'Comic Sans MS', 'Impact', 'Trebuchet MS',
    'Palatino Linotype', 'Lucida Console',
];

// ===== State =====
const state = {
    card: {
        name: 'Untitled',
        widthInches: 2.5,
        heightInches: 3.5,
        dpi: 300,
        backgroundImageData: null,
        backgroundFit: 'cover',
    },
    components: [],   // { id, type:'text'|'image', ... }
    selectedId: null,
    nextId: 1,
};

// Runtime (not persisted)
let bgImg = null;                     // Image object for background
let interaction = null;               // current drag / resize op
let autoSaveTimer = null;

// ===== Coordinate helpers =====
function inToPx(inches)  { return inches * state.card.dpi; }
function pxToIn(px)      { return px / state.card.dpi; }
function ptToCanvasPx(pt){ return pt * (state.card.dpi / 72); }
function canvasW()       { return Math.round(state.card.widthInches * state.card.dpi); }
function canvasH()       { return Math.round(state.card.heightInches * state.card.dpi); }

function mouseToCanvas(e) {
    const c = document.getElementById('cardCanvas');
    const r = c.getBoundingClientRect();
    return {
        x: (e.clientX - r.left) * (c.width  / r.width),
        y: (e.clientY - r.top)  * (c.height / r.height),
    };
}

// ===== Initialisation =====
document.addEventListener('DOMContentLoaded', () => {
    wireUI();
    loadAutoSave();
    resizeCanvas();
    drawCard();
    refreshComponentList();
});

// ===== UI wiring =====
function wireUI() {
    // Card size
    const ids = ['cardWidth','cardHeight','cardDpi'];
    ids.forEach(id => document.getElementById(id).addEventListener('change', onCardSizeChange));
    ids.forEach(id => document.getElementById(id).addEventListener('input', updateDimReadout));

    // Background image
    const bgArea  = document.getElementById('bgUploadArea');
    const bgInput = document.getElementById('bgFileInput');
    bgArea.addEventListener('click', () => bgInput.click());
    document.getElementById('bgFitSelect').addEventListener('change', e => {
        state.card.backgroundFit = e.target.value;
        drawCard();
        scheduleAutoSave();
    });

    bgArea.addEventListener('dragover', e => { e.preventDefault(); bgArea.classList.add('drag-over'); });
    bgArea.addEventListener('dragleave', () => bgArea.classList.remove('drag-over'));
    bgArea.addEventListener('drop', e => {
        e.preventDefault(); bgArea.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) loadBgFile(e.dataTransfer.files[0]);
    });
    bgInput.addEventListener('change', e => { if (e.target.files[0]) loadBgFile(e.target.files[0]); });
    document.getElementById('removeBgBtn').addEventListener('click', removeBg);

    // Add components
    document.getElementById('addTextBtn').addEventListener('click', addTextComponent);
    document.getElementById('addImageBtn').addEventListener('click', () => document.getElementById('addImageInput').click());
    document.getElementById('addImageInput').addEventListener('change', onAddImageFile);

    // Template toolbar
    document.getElementById('saveTemplateBtn').addEventListener('click', () => openModal('save'));
    document.getElementById('loadTemplateBtn').addEventListener('click', () => openModal('load'));
    document.getElementById('exportTemplateBtn').addEventListener('click', exportTemplateJSON);
    document.getElementById('importTemplateBtn').addEventListener('click', () => document.getElementById('importTemplateInput').click());
    document.getElementById('importTemplateInput').addEventListener('change', importTemplateJSON);
    document.getElementById('exportPngBtn').addEventListener('click', exportPng);

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalSaveBtn').addEventListener('click', onSaveTemplate);
    document.getElementById('templateModal').addEventListener('click', e => {
        if (e.target.id === 'templateModal') closeModal();
    });

    // Canvas
    const canvas = document.getElementById('cardCanvas');
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('dblclick', onCanvasDblClick);
    canvas.addEventListener('dragover', e => e.preventDefault());
    canvas.addEventListener('drop', e => e.preventDefault());
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

    // Keyboard
    document.addEventListener('keydown', onKeyDown);

    updateDimReadout();
}

// ===========================
//  Card size
// ===========================
function onCardSizeChange() {
    state.card.widthInches  = parseFloat(document.getElementById('cardWidth').value)  || 2.5;
    state.card.heightInches = parseFloat(document.getElementById('cardHeight').value) || 3.5;
    state.card.dpi          = parseInt(document.getElementById('cardDpi').value)      || 300;
    resizeCanvas();
    drawCard();
    scheduleAutoSave();
}

function resizeCanvas() {
    const c = document.getElementById('cardCanvas');
    c.width  = canvasW();
    c.height = canvasH();
    updateDimReadout();
}

function updateDimReadout() {
    const w = parseFloat(document.getElementById('cardWidth').value)  || 2.5;
    const h = parseFloat(document.getElementById('cardHeight').value) || 3.5;
    const d = parseInt(document.getElementById('cardDpi').value)      || 300;
    const el = document.getElementById('dimReadout');
    if (el) el.textContent = `${Math.round(w*d)} × ${Math.round(h*d)} px`;
}

// ===========================
//  Background image
// ===========================
function loadBgFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        state.card.backgroundImageData = e.target.result;
        const img = new Image();
        img.onload = () => {
            bgImg = img;
            document.getElementById('removeBgBtn').style.display = 'block';
            document.getElementById('bgUploadArea').classList.add('has-bg');
            document.getElementById('bgUploadLabel').textContent = '✓ Background set (click to change)';
            drawCard();
            scheduleAutoSave();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeBg() {
    state.card.backgroundImageData = null;
    bgImg = null;
    document.getElementById('removeBgBtn').style.display = 'none';
    document.getElementById('bgUploadArea').classList.remove('has-bg');
    document.getElementById('bgUploadLabel').textContent = 'Click or drop image';
    drawCard();
    scheduleAutoSave();
}

// ===========================
//  Component CRUD
// ===========================
function addTextComponent() {
    const comp = {
        id: state.nextId++,
        type: 'text',
        x: state.card.widthInches * 0.1,
        y: 0.25 + state.components.filter(c => c.type === 'text').length * 0.5,
        width: state.card.widthInches * 0.8,
        text: 'New Text',
        font: 'Arial',
        fontSize: 24,
        color: '#000000',
        bold: false,
        italic: false,
        underline: false,
        align: 'left',
        bgColor: '#ffffff',
        bgOpacity: 0,
        borderWidth: 0,
        borderColor: '#000000',
        padding: 4,
        height: null,
    };
    state.components.push(comp);
    state.selectedId = comp.id;
    afterComponentChange();
}

function onAddImageFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const maxW = state.card.widthInches * 0.6;
            const maxH = state.card.heightInches * 0.5;
            const aspect = img.width / img.height;
            let w = maxW, h = maxW / aspect;
            if (h > maxH) { h = maxH; w = maxH * aspect; }

            const comp = {
                id: state.nextId++,
                type: 'image',
                x: (state.card.widthInches - w) / 2,
                y: (state.card.heightInches - h) / 2,
                width: w,
                height: h,
                imageData: ev.target.result,
                _img: img,
                borderWidth: 0,
                borderColor: '#000000',
                cornerRadius: 0,
                imageOffsetX: 0,
                imageOffsetY: 0,
                imageScale: 1,
            };
            state.components.push(comp);
            state.selectedId = comp.id;
            afterComponentChange();
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function deleteComponent(id) {
    state.components = state.components.filter(c => c.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    afterComponentChange();
}

function moveComponent(id, dir) {
    const idx = state.components.findIndex(c => c.id === id);
    const to  = idx + dir;
    if (idx < 0 || to < 0 || to >= state.components.length) return;
    [state.components[idx], state.components[to]] = [state.components[to], state.components[idx]];
    afterComponentChange();
}

function getComp(id) {
    return state.components.find(c => c.id === id);
}

function afterComponentChange() {
    drawCard();
    refreshComponentList();
    refreshProperties();
    scheduleAutoSave();
}

// ===========================
//  Canvas rendering
// ===========================
function drawCard(showHandles = true) {
    const canvas = document.getElementById('cardCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Background
    if (bgImg) {
        if (state.card.backgroundFit === 'stretch') {
            ctx.drawImage(bgImg, 0, 0, w, h);
        } else {
            drawCover(ctx, bgImg, 0, 0, w, h);
        }
    }

    // Components in order (first = bottom)
    state.components.forEach(comp => {
        if (comp.type === 'text')  drawTextComp(ctx, comp);
        if (comp.type === 'image') drawImageComp(ctx, comp);
    });

    // Selection
    if (showHandles && state.selectedId != null) {
        const sel = getComp(state.selectedId);
        if (sel) drawSelectionUI(ctx, sel);
    }
}

function drawCover(ctx, img, dx, dy, dw, dh) {
    drawCoverOffset(ctx, img, dx, dy, dw, dh, 0, 0);
}

function drawCoverOffset(ctx, img, dx, dy, dw, dh, ox, oy, zoom) {
    const s = Math.max(dw / img.width, dh / img.height) * (zoom || 1);
    const sw = img.width * s, sh = img.height * s;
    const maxOx = Math.max(0, (sw - dw) / 2);
    const maxOy = Math.max(0, (sh - dh) / 2);
    const cx = Math.max(-maxOx, Math.min(maxOx, ox));
    const cy = Math.max(-maxOy, Math.min(maxOy, oy));
    ctx.drawImage(img, dx + (dw - sw) / 2 + cx, dy + (dh - sh) / 2 + cy, sw, sh);
}

// ---------- Text component ----------
function drawTextComp(ctx, comp) {
    const x = inToPx(comp.x);
    const y = inToPx(comp.y);
    const maxW = inToPx(comp.width);
    const fontSize = ptToCanvasPx(comp.fontSize);
    const lineH = fontSize * 1.35;
    const padding = ptToCanvasPx(comp.padding || 0);

    // Calculate text dimensions with padding
    ctx.font = buildFont(comp, fontSize);
    const textMaxW = maxW - padding * 2;
    const lines = wrapLines(ctx, comp.text, textMaxW);
    const textH = lines.length * lineH;
    const totalH = textH + padding * 2;
    comp._cachedH = totalH;

    // Draw background if opacity > 0
    if (comp.bgOpacity > 0) {
        const rgb = hexToRgb(comp.bgColor);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${comp.bgOpacity})`;
        ctx.fillRect(x, y, maxW, totalH);
    }

    // Draw border if width > 0
    if (comp.borderWidth > 0) {
        ctx.save();
        const bw = ptToCanvasPx(comp.borderWidth);
        ctx.strokeStyle = comp.borderColor;
        ctx.lineWidth = bw;
        ctx.strokeRect(x + bw / 2, y + bw / 2, maxW - bw, totalH - bw);
        ctx.restore();
    }

    ctx.fillStyle = comp.color;
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
        let lx = x + padding;
        if (comp.align === 'center') lx = x + (maxW - ctx.measureText(line).width) / 2;
        else if (comp.align === 'right') lx = x + maxW - padding - ctx.measureText(line).width;

        ctx.fillText(line, lx, y + padding + i * lineH);

        if (comp.underline) {
            const tw = ctx.measureText(line).width;
            ctx.save();
            ctx.strokeStyle = comp.color;
            ctx.lineWidth = Math.max(1, fontSize / 18);
            ctx.beginPath();
            ctx.moveTo(lx, y + padding + i * lineH + fontSize + 2);
            ctx.lineTo(lx + tw, y + padding + i * lineH + fontSize + 2);
            ctx.stroke();
            ctx.restore();
        }
    });
}

function buildFont(comp, fontSize) {
    let s = '';
    if (comp.italic) s += 'italic ';
    if (comp.bold)   s += 'bold ';
    s += fontSize + 'px ';
    s += '"' + comp.font + '"';
    return s;
}

function wrapLines(ctx, text, maxW) {
    const out = [];
    text.split('\n').forEach(para => {
        if (para === '') { out.push(''); return; }
        const words = para.split(' ');
        let cur = '';
        words.forEach(w => {
            const test = cur ? cur + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && cur) {
                out.push(cur);
                cur = w;
            } else {
                cur = test;
            }
        });
        if (cur) out.push(cur);
    });
    return out.length ? out : [''];
}

// ---------- Image component ----------
function roundedRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
}

function drawImageComp(ctx, comp) {
    const x = inToPx(comp.x), y = inToPx(comp.y);
    const w = inToPx(comp.width), h = inToPx(comp.height);
    const r = (comp.cornerRadius > 0) ? ptToCanvasPx(comp.cornerRadius) : 0;
    const ox = comp.imageOffsetX || 0;
    const oy = comp.imageOffsetY || 0;
    const zoom = comp.imageScale || 1;

    if (comp._img) {
        ctx.save();
        ctx.beginPath();
        if (r > 0) { roundedRectPath(ctx, x, y, w, h, r); } else { ctx.rect(x, y, w, h); }
        ctx.clip();
        drawCoverOffset(ctx, comp._img, x, y, w, h, ox, oy, zoom);
        ctx.restore();
    } else {
        ctx.save();
        ctx.beginPath();
        if (r > 0) { roundedRectPath(ctx, x, y, w, h, r); ctx.fillStyle = '#e0e0e0'; ctx.fill(); } else { ctx.fillStyle = '#e0e0e0'; ctx.fillRect(x, y, w, h); }
        ctx.restore();
        ctx.fillStyle = '#999';
        ctx.font = `${Math.max(14, Math.min(w, h) * 0.08)}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Image', x + w / 2, y + h / 2);
        ctx.textAlign = 'left';
    }

    // Draw border if width > 0
    if (comp.borderWidth > 0) {
        ctx.save();
        const bw = ptToCanvasPx(comp.borderWidth);
        ctx.strokeStyle = comp.borderColor;
        ctx.lineWidth = bw;
        if (r > 0) {
            ctx.beginPath();
            roundedRectPath(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2));
            ctx.stroke();
        } else {
            ctx.strokeRect(x + bw / 2, y + bw / 2, w - bw, h - bw);
        }
        ctx.restore();
    }
}

// ---------- Selection / handles ----------
function drawSelectionUI(ctx, comp) {
    const bounds = compBounds(comp);
    const { x, y, w, h } = bounds;
    const dash = Math.max(4, state.card.dpi / 40);
    const lw   = Math.max(2, state.card.dpi / 120);

    ctx.save();
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = lw;
    ctx.setLineDash([dash, dash * 0.6]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.restore();

    const hs = handleSize();

    if (comp.type === 'image') {
        drawHandle(ctx, x - hs / 2, y - hs / 2, hs);
        drawHandle(ctx, x + w - hs / 2, y - hs / 2, hs);
        drawHandle(ctx, x - hs / 2, y + h - hs / 2, hs);
        drawHandle(ctx, x + w - hs / 2, y + h - hs / 2, hs);
    }
    // Right-edge handle (text width OR image right)
    drawHandle(ctx, x + w - hs / 2, y + h / 2 - hs / 2, hs);
    // Bottom-edge handle (images and text)
    if (comp.type === 'image' || comp.type === 'text') {
        drawHandle(ctx, x + w / 2 - hs / 2, y + h - hs / 2, hs);
    }
}

function drawHandle(ctx, x, y, s) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = Math.max(1, s / 5);
    ctx.strokeRect(x, y, s, s);
}

function handleSize() { return Math.max(10, state.card.dpi / 22); }

// ===========================
//  Hit testing
// ===========================
function compBounds(comp) {
    const x = inToPx(comp.x), y = inToPx(comp.y);
    let w, h;
    if (comp.type === 'image') {
        w = inToPx(comp.width);
        h = inToPx(comp.height);
    } else {
        w = inToPx(comp.width);
        h = (comp.height != null && comp.height > 0) ? inToPx(comp.height) : (comp._cachedH || ptToCanvasPx(comp.fontSize) * 1.35);
    }
    return { x, y, w, h };
}

function hitHandle(comp, mx, my) {
    const { x, y, w, h } = compBounds(comp);
    const tol = handleSize() * 1.6;

    if (comp.type === 'image') {
        if (near(mx, my, x, y, tol))         return 'tl';
        if (near(mx, my, x + w, y, tol))     return 'tr';
        if (near(mx, my, x, y + h, tol))     return 'bl';
        if (near(mx, my, x + w, y + h, tol)) return 'br';
    }
    // Bottom handle for both image and text
    if (near(mx, my, x + w / 2, y + h, tol)) return 'b';
    if (near(mx, my, x + w, y + h / 2, tol)) return 'r';
    return null;
}

function near(ax, ay, bx, by, tol) {
    return Math.abs(ax - bx) < tol && Math.abs(ay - by) < tol;
}

function hitBody(comp, mx, my) {
    const { x, y, w, h } = compBounds(comp);
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
}

// ===========================
//  Canvas mouse interaction
// ===========================
function onCanvasMouseDown(e) {
    const { x, y } = mouseToCanvas(e);

    // 1) Check selected component's handles / pan
    if (state.selectedId != null) {
        const sel = getComp(state.selectedId);
        if (sel) {
            // Alt+drag on a selected image → pan the image content
            if (e.altKey && sel.type === 'image' && hitBody(sel, x, y)) {
                interaction = {
                    type: 'pan', compId: sel.id,
                    startX: x, startY: y,
                    origOx: sel.imageOffsetX || 0,
                    origOy: sel.imageOffsetY || 0,
                };
                document.getElementById('cardCanvas').style.cursor = 'grabbing';
                return;
            }
            const h = hitHandle(sel, x, y);
            if (h) {
                const origH = sel.type === 'image'
                    ? sel.height
                    : (sel.height != null && sel.height > 0)
                        ? sel.height
                        : pxToIn(sel._cachedH || ptToCanvasPx(sel.fontSize) * 1.35);
                interaction = {
                    type: 'resize', compId: sel.id, handle: h,
                    startX: x, startY: y,
                    origX: sel.x, origY: sel.y,
                    origW: sel.width,
                    origH,
                };
                return;
            }
        }
    }

    // 2) Check bodies (top-most first)
    for (let i = state.components.length - 1; i >= 0; i--) {
        const comp = state.components[i];
        if (hitBody(comp, x, y)) {
            state.selectedId = comp.id;
            interaction = {
                type: 'drag', compId: comp.id,
                startX: x, startY: y,
                origX: comp.x, origY: comp.y,
            };
            drawCard();
            refreshComponentList();
            refreshProperties();
            return;
        }
    }

    // 3) Clicked empty → deselect
    state.selectedId = null;
    interaction = null;
    drawCard();
    refreshComponentList();
    refreshProperties();
}

function onCanvasMouseMove(e) {
    if (!interaction) { updateCursor(e); return; }

    const { x, y } = mouseToCanvas(e);
    const comp = getComp(interaction.compId);
    if (!comp) return;

    if (interaction.type === 'pan') {
        comp.imageOffsetX = interaction.origOx + (x - interaction.startX);
        comp.imageOffsetY = interaction.origOy + (y - interaction.startY);
        const pxEl = document.getElementById('propPanX');
        const pyEl = document.getElementById('propPanY');
        if (pxEl) pxEl.value = Math.round(comp.imageOffsetX);
        if (pyEl) pyEl.value = Math.round(comp.imageOffsetY);
        drawCard();
        return;
    }

    if (interaction.type === 'drag') {
        comp.x = interaction.origX + pxToIn(x - interaction.startX);
        comp.y = interaction.origY + pxToIn(y - interaction.startY);
        comp.x = Math.max(-comp.width * 0.5, Math.min(comp.x, state.card.widthInches));
        comp.y = Math.max(-0.5, comp.y);
    } else {
        const dxIn = pxToIn(x - interaction.startX);
        const dyIn = pxToIn(y - interaction.startY);

        if (comp.type === 'image') {
            switch (interaction.handle) {
                case 'br':
                    comp.width  = Math.max(0.1, interaction.origW + dxIn);
                    comp.height = Math.max(0.1, interaction.origH + dyIn);
                    break;
                case 'bl':
                    comp.x     = interaction.origX + dxIn;
                    comp.width = Math.max(0.1, interaction.origW - dxIn);
                    comp.height = Math.max(0.1, interaction.origH + dyIn);
                    break;
                case 'tr':
                    comp.y      = interaction.origY + dyIn;
                    comp.width  = Math.max(0.1, interaction.origW + dxIn);
                    comp.height = Math.max(0.1, interaction.origH - dyIn);
                    break;
                case 'tl':
                    comp.x      = interaction.origX + dxIn;
                    comp.y      = interaction.origY + dyIn;
                    comp.width  = Math.max(0.1, interaction.origW - dxIn);
                    comp.height = Math.max(0.1, interaction.origH - dyIn);
                    break;
                case 'b':
                    comp.height = Math.max(0.1, interaction.origH + dyIn);
                    break;
                case 'r':
                    comp.width = Math.max(0.1, interaction.origW + dxIn);
                    break;
            }
        } else {
            if (interaction.handle === 'r') {
                comp.width = Math.max(0.25, interaction.origW + dxIn);
            }
            if (interaction.handle === 'b') {
                comp.height = Math.max(0.1, interaction.origH + dyIn);
            }
        }
    }
    drawCard();
}

function onCanvasMouseUp() {
    if (interaction) {
        interaction = null;
        scheduleAutoSave();
        refreshProperties();
    }
}

function onCanvasWheel(e) {
    if (state.selectedId == null) return;
    const sel = getComp(state.selectedId);
    if (!sel || sel.type !== 'image') return;
    const { x, y } = mouseToCanvas(e);
    if (!hitBody(sel, x, y)) return;
    e.preventDefault();
    const step = e.ctrlKey ? 0.01 : 0.05;
    const delta = e.deltaY < 0 ? step : -step;
    sel.imageScale = Math.max(0.1, Math.min(10, (sel.imageScale || 1) + delta));
    const zoomEl = document.getElementById('propZoom');
    if (zoomEl) zoomEl.value = Math.round(sel.imageScale * 100);
    drawCard();
    scheduleAutoSave();
}

function updateCursor(e) {
    const canvas = document.getElementById('cardCanvas');
    try { var { x, y } = mouseToCanvas(e); } catch { canvas.style.cursor = 'default'; return; }

    if (state.selectedId != null) {
        const sel = getComp(state.selectedId);
        if (sel) {
            const h = hitHandle(sel, x, y);
            if (h) {
                const map = { tl:'nwse-resize', br:'nwse-resize', tr:'nesw-resize', bl:'nesw-resize', r:'ew-resize', b:'ns-resize' };
                canvas.style.cursor = map[h] || 'pointer';
                return;
            }
            if (e.altKey && sel.type === 'image' && hitBody(sel, x, y)) {
                canvas.style.cursor = 'grab';
                return;
            }
        }
    }
    for (let i = state.components.length - 1; i >= 0; i--) {
        if (hitBody(state.components[i], x, y)) { canvas.style.cursor = 'move'; return; }
    }
    canvas.style.cursor = 'default';
}

function onCanvasDblClick(e) {
    const { x, y } = mouseToCanvas(e);
    for (let i = state.components.length - 1; i >= 0; i--) {
        const comp = state.components[i];
        if (comp.type === 'text' && hitBody(comp, x, y)) {
            state.selectedId = comp.id;
            drawCard();
            refreshComponentList();
            refreshProperties();
            // Open inline editor
            openInlineEditor(comp);
            return;
        }
    }
}

function onKeyDown(e) {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId != null) {
        e.preventDefault();
        deleteComponent(state.selectedId);
    }
}

// ===========================
//  Inline text editor
// ===========================
function openInlineEditor(comp) {
    // Remove any existing editor
    document.querySelectorAll('.inline-text-editor').forEach(el => el.remove());

    const canvas  = document.getElementById('cardCanvas');
    const wrapper = document.getElementById('canvasScroller');
    const rect    = canvas.getBoundingClientRect();
    const scaleX  = rect.width  / canvas.width;
    const scaleY  = rect.height / canvas.height;

    const dispX = inToPx(comp.x) * scaleX;
    const dispY = inToPx(comp.y) * scaleY;
    const dispW = inToPx(comp.width) * scaleX;
    const dispH = Math.max(30, (comp._cachedH || ptToCanvasPx(comp.fontSize) * 1.35) * scaleY);

    const ta  = document.createElement('textarea');
    ta.className = 'inline-text-editor';
    ta.value = comp.text;
    ta.style.left     = dispX + 'px';
    ta.style.top      = dispY + 'px';
    ta.style.width    = Math.max(60, dispW) + 'px';
    ta.style.height   = Math.max(30, dispH) + 'px';
    ta.style.fontSize = Math.max(10, ptToCanvasPx(comp.fontSize) * scaleY * 0.9) + 'px';
    ta.style.fontFamily = comp.font;

    function commit() {
        if (ta._committed) return;
        ta._committed = true;
        comp.text = ta.value;
        ta.remove();
        afterComponentChange();
    }

    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') { ta._committed = true; ta.remove(); }
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); commit(); }
    });

    wrapper.appendChild(ta);
    ta.focus();
    ta.select();
}

// ===========================
//  Component list (left sidebar)
// ===========================
function refreshComponentList() {
    const container = document.getElementById('componentList');
    const hint      = document.getElementById('compListHint');
    container.innerHTML = '';
    hint.style.display = state.components.length ? 'none' : 'block';

    state.components.forEach(comp => {
        const div = document.createElement('div');
        div.className = 'comp-item' + (comp.id === state.selectedId ? ' selected' : '');

        const icon  = comp.type === 'text' ? 'T' : '🖼️';
        const label = comp.type === 'text'
            ? comp.text.substring(0, 22) + (comp.text.length > 22 ? '…' : '')
            : 'Image';

        div.innerHTML = `
            <span class="comp-item-icon">${icon}</span>
            <span class="comp-item-label">${esc(label)}</span>
            <span class="comp-item-actions">
                <button title="Move up"   data-act="up">▲</button>
                <button title="Move down" data-act="down">▼</button>
                <button title="Delete"    data-act="del">✕</button>
            </span>`;

        div.addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') return;
            state.selectedId = comp.id;
            drawCard(); refreshComponentList(); refreshProperties();
        });

        div.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (btn.dataset.act === 'up')  moveComponent(comp.id, -1);
                if (btn.dataset.act === 'down') moveComponent(comp.id, 1);
                if (btn.dataset.act === 'del') deleteComponent(comp.id);
            });
        });

        container.appendChild(div);
    });
}

// ===========================
//  Properties panel (right sidebar)
// ===========================
function refreshProperties() {
    const panel = document.getElementById('propertiesPanel');

    if (state.selectedId == null) {
        panel.innerHTML = '<p class="hint">Select a component to edit</p>';
        return;
    }
    const comp = getComp(state.selectedId);
    if (!comp) { panel.innerHTML = '<p class="hint">Select a component to edit</p>'; return; }

    if (comp.type === 'text')  buildTextProps(panel, comp);
    else                        buildImageProps(panel, comp);
}

function buildTextProps(panel, comp) {
    const fontOpts = FONTS.map(f => `<option value="${f}"${comp.font===f?' selected':''}>${f}</option>`).join('');

    panel.innerHTML = `
        <div class="prop-section"><h4>Text Content</h4>
            <div class="form-group"><textarea id="propText" rows="4"></textarea></div>
        </div>
        <div class="prop-section"><h4>Position &amp; Size</h4>
            <div class="prop-row">
                <label>X (in)<input type="number" id="propX" step="0.0625" min="0"></label>
                <label>Y (in)<input type="number" id="propY" step="0.0625" min="0"></label>
            </div>
            <div class="prop-row">
                <label>Width (in)<input type="number" id="propW" step="0.0625" min="0.25"></label>
                <label>Height (in)<input type="number" id="propH" step="0.0625" min="0" placeholder="auto"></label>
            </div>
        </div>
        <div class="prop-section"><h4>Font</h4>
            <div class="form-group"><label>Family</label><select id="propFont">${fontOpts}</select></div>
            <div class="prop-row">
                <label>Size (pt)<input type="number" id="propSize" min="4" max="400" step="1"></label>
                <label>Color<input type="color" id="propColor"></label>
            </div>
        </div>
        <div class="prop-section"><h4>Background</h4>
            <div class="prop-row">
                <label>Color<input type="color" id="propBgColor"></label>
                <label>Opacity<input type="number" id="propBgOpacity" min="0" max="1" step="0.05"></label>
            </div>
        </div>
        <div class="prop-section"><h4>Border</h4>
            <div class="prop-row">
                <label>Width (pt)<input type="number" id="propBorderW" min="0" max="50" step="0.5"></label>
                <label>Color<input type="color" id="propBorderColor"></label>
            </div>
            <div class="prop-row">
                <label>Padding (pt)<input type="number" id="propPadding" min="0" max="100" step="1"></label>
            </div>
        </div>
        <div class="prop-section"><h4>Style</h4>
            <div class="prop-toggle-row">
                <button type="button" class="toggle-btn${comp.bold?' active':''}" id="tBold"><b>B</b></button>
                <button type="button" class="toggle-btn${comp.italic?' active':''}" id="tItalic"><i>I</i></button>
                <button type="button" class="toggle-btn${comp.underline?' active':''}" id="tUnder"><u>U</u></button>
            </div>
            <div class="prop-toggle-row">
                <button type="button" class="toggle-btn${comp.align==='left'?' active':''}" data-al="left">Left</button>
                <button type="button" class="toggle-btn${comp.align==='center'?' active':''}" data-al="center">Center</button>
                <button type="button" class="toggle-btn${comp.align==='right'?' active':''}" data-al="right">Right</button>
            </div>
        </div>
        <button type="button" class="delete-comp-btn" id="propDel">🗑️ Delete Component</button>`;

    // Set values via JS to avoid encoding issues
    document.getElementById('propText').value  = comp.text;
    document.getElementById('propX').value     = comp.x.toFixed(3);
    document.getElementById('propY').value     = comp.y.toFixed(3);
    document.getElementById('propW').value     = comp.width.toFixed(3);
    document.getElementById('propH').value     = (comp.height != null && comp.height > 0) ? comp.height.toFixed(3) : '';
    document.getElementById('propSize').value  = comp.fontSize;
    document.getElementById('propColor').value = comp.color;
    document.getElementById('propBgColor').value   = comp.bgColor || '#ffffff';
    document.getElementById('propBgOpacity').value = comp.bgOpacity || 0;
    document.getElementById('propBorderW').value     = comp.borderWidth || 0;
    document.getElementById('propBorderColor').value = comp.borderColor || '#000000';
    document.getElementById('propPadding').value     = comp.padding || 0;

    // Bind inputs
    bindInput('propText',  comp, 'text',     'str');
    bindInput('propX',     comp, 'x',        'f');
    bindInput('propY',     comp, 'y',        'f');
    bindInput('propW',     comp, 'width',    'f');
    // Height: 0 or empty = auto
    const propHEl = document.getElementById('propH');
    const hHandler = () => {
        const val = parseFloat(propHEl.value);
        comp.height = (!isNaN(val) && val > 0) ? val : null;
        drawCard(); refreshComponentList(); scheduleAutoSave();
    };
    propHEl.addEventListener('input', hHandler);
    propHEl.addEventListener('change', hHandler);
    bindInput('propFont',  comp, 'font',     'str');
    bindInput('propSize',  comp, 'fontSize', 'i');
    bindInput('propColor', comp, 'color',    'str');
    bindInput('propBgColor',   comp, 'bgColor',   'str');
    bindInput('propBgOpacity', comp, 'bgOpacity', 'f');
    bindInput('propBorderW',     comp, 'borderWidth', 'f');
    bindInput('propBorderColor', comp, 'borderColor', 'str');
    bindInput('propPadding',     comp, 'padding', 'f');

    // Style toggles
    document.getElementById('tBold').addEventListener('click', () => { comp.bold = !comp.bold; afterComponentChange(); });
    document.getElementById('tItalic').addEventListener('click', () => { comp.italic = !comp.italic; afterComponentChange(); });
    document.getElementById('tUnder').addEventListener('click', () => { comp.underline = !comp.underline; afterComponentChange(); });

    document.querySelectorAll('[data-al]').forEach(btn => {
        btn.addEventListener('click', () => { comp.align = btn.dataset.al; afterComponentChange(); });
    });

    document.getElementById('propDel').addEventListener('click', () => deleteComponent(comp.id));
}

function buildImageProps(panel, comp) {
    panel.innerHTML = `
        <div class="prop-section"><h4>Position &amp; Size</h4>
            <div class="prop-row">
                <label>X (in)<input type="number" id="propX" step="0.0625" min="0"></label>
                <label>Y (in)<input type="number" id="propY" step="0.0625" min="0"></label>
            </div>
            <div class="prop-row">
                <label>Width (in)<input type="number" id="propW" step="0.0625" min="0.1"></label>
                <label>Height (in)<input type="number" id="propH" step="0.0625" min="0.1"></label>
            </div>
        </div>
        <div class="prop-section"><h4>Border</h4>
            <div class="prop-row">
                <label>Width (pt)<input type="number" id="propBorderW" min="0" max="50" step="0.5"></label>
                <label>Color<input type="color" id="propBorderColor"></label>
            </div>
        </div>
        <div class="prop-section"><h4>Corner Radius</h4>
            <div class="prop-row">
                <label>Radius (pt)<input type="number" id="propCornerRadius" min="0" max="500" step="1"></label>
            </div>
        </div>
        <div class="prop-section"><h4>Image Pan <span style="font-weight:normal;color:#666;font-size:10px">(Alt+drag on canvas)</span></h4>
            <div class="prop-row">
                <label>Pan X (px)<input type="number" id="propPanX" step="1"></label>
                <label>Pan Y (px)<input type="number" id="propPanY" step="1"></label>
            </div>
            <button type="button" class="small-btn" id="propResetPan">Reset Pan</button>
        </div>
        <div class="prop-section"><h4>Zoom <span style="font-weight:normal;color:#666;font-size:10px">(Scroll wheel on canvas)</span></h4>
            <div class="prop-row">
                <label>Scale (%)<input type="number" id="propZoom" min="10" max="1000" step="5"></label>
            </div>
            <button type="button" class="small-btn" id="propResetZoom">Reset Zoom</button>
        </div>
        <div class="prop-section"><h4>Image</h4>
            <button type="button" class="small-btn" id="propChangeImg">Change Image</button>
            <input type="file" id="propImgInput" accept="image/*" style="display:none">
        </div>
        <button type="button" class="delete-comp-btn" id="propDel">🗑️ Delete Component</button>`;

    document.getElementById('propX').value = comp.x.toFixed(3);
    document.getElementById('propY').value = comp.y.toFixed(3);
    document.getElementById('propW').value = comp.width.toFixed(3);
    document.getElementById('propH').value = comp.height.toFixed(3);
    document.getElementById('propBorderW').value     = comp.borderWidth || 0;
    document.getElementById('propBorderColor').value = comp.borderColor || '#000000';
    document.getElementById('propCornerRadius').value = comp.cornerRadius || 0;
    document.getElementById('propPanX').value = Math.round(comp.imageOffsetX || 0);
    document.getElementById('propPanY').value = Math.round(comp.imageOffsetY || 0);
    document.getElementById('propZoom').value  = Math.round((comp.imageScale || 1) * 100);

    bindInput('propX', comp, 'x',      'f');
    bindInput('propY', comp, 'y',      'f');
    bindInput('propW', comp, 'width',  'f');
    bindInput('propH', comp, 'height', 'f');
    bindInput('propBorderW',     comp, 'borderWidth',  'f');
    bindInput('propBorderColor', comp, 'borderColor',  'str');
    bindInput('propCornerRadius', comp, 'cornerRadius', 'f');
    bindInput('propPanX', comp, 'imageOffsetX', 'f');
    bindInput('propPanY', comp, 'imageOffsetY', 'f');

    const zoomEl = document.getElementById('propZoom');
    const zoomHandler = () => {
        comp.imageScale = Math.max(0.1, (parseFloat(zoomEl.value) || 100) / 100);
        drawCard(); scheduleAutoSave();
    };
    zoomEl.addEventListener('input',  zoomHandler);
    zoomEl.addEventListener('change', zoomHandler);

    document.getElementById('propResetPan').addEventListener('click', () => {
        comp.imageOffsetX = 0; comp.imageOffsetY = 0;
        document.getElementById('propPanX').value = 0;
        document.getElementById('propPanY').value = 0;
        afterComponentChange();
    });

    document.getElementById('propResetZoom').addEventListener('click', () => {
        comp.imageScale = 1;
        document.getElementById('propZoom').value = 100;
        afterComponentChange();
    });

    document.getElementById('propChangeImg').addEventListener('click', () => document.getElementById('propImgInput').click());
    document.getElementById('propImgInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => { comp.imageData = ev.target.result; comp._img = img; afterComponentChange(); };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('propDel').addEventListener('click', () => deleteComponent(comp.id));
}

function bindInput(elId, comp, prop, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    const handler = () => {
        if (type === 'f')      comp[prop] = parseFloat(el.value) || 0;
        else if (type === 'i') comp[prop] = parseInt(el.value)   || 0;
        else                   comp[prop] = el.value;
        drawCard();
        refreshComponentList();
        scheduleAutoSave();
    };
    el.addEventListener('input',  handler);
    el.addEventListener('change', handler);
}

function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===========================
//  IndexedDB helpers
// ===========================
let dbInstance = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) { resolve(dbInstance); return; }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => { dbInstance = req.result; resolve(dbInstance); };
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('templates')) {
                db.createObjectStore('templates', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('autosave')) {
                db.createObjectStore('autosave', { keyPath: 'id' });
            }
        };
    });
}

async function dbGet(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbPut(storeName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbGetAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbDelete(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ===========================
//  Template save / load
// ===========================
function openModal(mode) {
    const modal = document.getElementById('templateModal');
    document.getElementById('modalTitle').textContent = mode === 'save' ? 'Save Template' : 'Load Template';
    document.getElementById('modalSaveSection').style.display = mode === 'save' ? 'block' : 'none';
    if (mode === 'save') document.getElementById('templateNameInput').value = state.card.name;
    renderSavedList();
    modal.classList.add('open');
}

function closeModal() {
    document.getElementById('templateModal').classList.remove('open');
}



function serializeTemplate() {
    return {
        version: 2,
        card: { ...state.card },
        components: state.components.map(c => {
            const copy = { ...c };
            delete copy._img;
            delete copy._cachedH;
            return copy;
        }),
        nextId: state.nextId,
    };
}

async function onSaveTemplate() {
    const name = document.getElementById('templateNameInput').value.trim() || 'Untitled';
    state.card.name = name;

    const entry = { name, savedAt: new Date().toISOString(), data: serializeTemplate() };
    
    try {
        await dbPut('templates', entry);
        await renderSavedList();
        closeModal();
    } catch (err) {
        console.error('Failed to save template:', err);
        alert('Failed to save template. Please try again.');
    }
}

function loadTemplateData(data) {
    state.card       = { ...data.card };
    state.components = (data.components || []).map(c => ({ ...c }));
    state.nextId     = data.nextId || (state.components.length ? Math.max(...state.components.map(c=>c.id)) + 1 : 1);
    state.selectedId = null;

    // Sync UI inputs
    document.getElementById('cardWidth').value  = state.card.widthInches;
    document.getElementById('cardHeight').value = state.card.heightInches;
    document.getElementById('cardDpi').value    = state.card.dpi;
    const fitSel = document.getElementById('bgFitSelect');
    if (fitSel) fitSel.value = state.card.backgroundFit || 'cover';
    updateDimReadout();

    loadAllImages().then(() => {
        resizeCanvas();
        afterComponentChange();
    });
    closeModal();
}

async function deleteSavedTemplate(name) {
    try {
        await dbDelete('templates', name);
        await renderSavedList();
    } catch (err) {
        console.error('Failed to delete template:', err);
    }
}

async function renderSavedList() {
    const container  = document.getElementById('savedTemplatesList');
    let templates = [];
    
    try {
        templates = await dbGetAll('templates');
    } catch (err) {
        console.error('Failed to load templates:', err);
    }

    if (!templates.length) { container.innerHTML = '<p class="hint">No saved templates</p>'; return; }

    container.innerHTML = templates.map(t => `
        <div class="template-item">
            <span class="template-item-name">${esc(t.name)}</span>
            <span class="template-item-date">${new Date(t.savedAt).toLocaleDateString()}</span>
            <button class="load-btn" data-name="${esc(t.name)}">Load</button>
            <button class="del-btn" data-name="${esc(t.name)}">✕</button>
        </div>`).join('');

    container.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = templates.find(t => t.name === btn.dataset.name);
            if (t) loadTemplateData(t.data);
        });
    });
    container.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', async () => await deleteSavedTemplate(btn.dataset.name));
    });
}

// ===========================
//  Template export / import (file)
// ===========================
function exportTemplateJSON() {
    const data = serializeTemplate();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${state.card.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_template.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importTemplateJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.card || !Array.isArray(data.components)) { alert('Invalid template file.'); return; }
            loadTemplateData(data);
        } catch (err) {
            alert('Error reading template: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ===========================
//  PNG export
// ===========================
function exportPng() {
    drawCard(false);
    const canvas = document.getElementById('cardCanvas');
    const a = document.createElement('a');
    a.download = `${state.card.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${state.card.widthInches}x${state.card.heightInches}in_${state.card.dpi}dpi.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    drawCard(true);
}

// ===========================
//  Image loading helpers
// ===========================
function loadAllImages() {
    const promises = [];

    if (state.card.backgroundImageData) {
        promises.push(new Promise(res => {
            const img = new Image();
            img.onload = () => {
                bgImg = img;
                document.getElementById('removeBgBtn').style.display = 'block';
                document.getElementById('bgUploadArea').classList.add('has-bg');
                document.getElementById('bgUploadLabel').textContent = '✓ Background set (click to change)';
                res();
            };
            img.onerror = () => { bgImg = null; res(); };
            img.src = state.card.backgroundImageData;
        }));
    } else {
        bgImg = null;
        document.getElementById('removeBgBtn').style.display = 'none';
        document.getElementById('bgUploadArea').classList.remove('has-bg');
        document.getElementById('bgUploadLabel').textContent = 'Click or drop image';
    }

    state.components.forEach(comp => {
        if (comp.type === 'image' && comp.imageData) {
            promises.push(new Promise(res => {
                const img = new Image();
                img.onload = () => { comp._img = img; res(); };
                img.onerror = () => { comp._img = null; res(); };
                img.src = comp.imageData;
            }));
        }
    });

    return Promise.all(promises);
}

// ===========================
//  Auto-save
// ===========================
function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(autoSave, 400);
}

async function autoSave() {
    try {
        await dbPut('autosave', { id: 'current', data: serializeTemplate() });
    } catch (err) {
        console.warn('Auto-save failed:', err);
    }
}

async function loadAutoSave() {
    try {
        const record = await dbGet('autosave', 'current');
        if (!record || !record.data) return;
        const data = record.data;
        if (!data.card || !Array.isArray(data.components)) return;

        state.card       = { ...data.card };
        state.components = data.components.map(c => ({ ...c }));
        state.nextId     = data.nextId || 1;

        document.getElementById('cardWidth').value  = state.card.widthInches;
        document.getElementById('cardHeight').value = state.card.heightInches;
        document.getElementById('cardDpi').value    = state.card.dpi;
        const fitSelAS = document.getElementById('bgFitSelect');
        if (fitSelAS) fitSelAS.value = state.card.backgroundFit || 'cover';
        updateDimReadout();

        loadAllImages().then(() => {
            resizeCanvas();
            drawCard();
            refreshComponentList();
        });
    } catch (err) {
        console.warn('Auto-save load failed:', err);
    }
}

// Helper: convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

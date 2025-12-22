// State management
let uploadedPhotos = [];
let currentFrontImage = null;
let currentFrontBackground = null;
let currentBackBackground = null;
let frontImagePosition = { x: 75, y: 200, width: 600, height: 400 };
let frontTitlePosition = { x: 50, y: 50 };
let frontTextPosition = { x: 75, y: 640 };
let frontNumberPosition = { x: 610, y: 50 };
let backTextPosition = { x: 375, y: 450 };
let titleStyle = { font: 'Arial', size: 48, color: '#000000' };
let numberStyle = { font: 'Arial', size: 36, color: '#666666' };
let photoTransform = { scale: 1, offsetXRatio: 0, offsetYRatio: 0 };
let photoModalState = { scale: 1, offsetXRatio: 0, offsetYRatio: 0 };
const STORAGE_KEY = 'cardMakerStateV1';
let saveTimer = null;
let isResizing = false;
let resizeHandle = null;
let isDraggingElement = null;
let dragStartX = 0;
let dragStartY = 0;
let frontTextEditor = null;
let backTextEditor = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupUploadArea();
    setupCanvasDropZones();
    setupControls();
    initializeRichTextEditors();
    loadState();
    drawCards();
});

// Upload Area Setup
function setupUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Prevent browser from opening images when dropped outside
    ['dragover','drop'].forEach(evt => document.addEventListener(evt, (e) => e.preventDefault()))

    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const id = Date.now() + Math.random();
                    uploadedPhotos.push({ id, data: e.target.result, img });
                    displayUploadedImages();
                    scheduleSaveState();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

function saveState() {
    if (typeof localStorage === 'undefined') return;
    const state = {
        photos: uploadedPhotos.map(p => ({ id: p.id, data: p.data })),
        currentFrontImageId: currentFrontImage ? currentFrontImage.id : null,
        currentFrontBackgroundId: currentFrontBackground ? currentFrontBackground.id : null,
        currentBackBackgroundId: currentBackBackground ? currentBackBackground.id : null,
        frontImagePosition,
        frontTitlePosition,
        frontNumberPosition,
        frontTextPosition,
        backTextPosition,
        titleStyle,
        numberStyle,
        photoTransform,
        frontControls: {
            font: document.getElementById('frontFont').value,
            fontSize: document.getElementById('frontFontSize').value,
            color: document.getElementById('frontColor').value,
        },
        backControls: {
            font: document.getElementById('backFont').value,
            fontSize: document.getElementById('backFontSize').value,
            color: document.getElementById('backColor').value,
        },
        frontTitle: document.getElementById('frontTitle').value,
        cardNumber: document.getElementById('cardNumber').value,
        frontTextDelta: frontTextEditor ? frontTextEditor.getContents() : null,
        backTextDelta: backTextEditor ? backTextEditor.getContents() : null,
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        console.warn('Could not save state', err);
    }
}

function displayUploadedImages() {
    const container = document.getElementById('uploadedImages');
    container.innerHTML = '';
    
    uploadedPhotos.forEach(photo => {
        const div = document.createElement('div');
        div.className = 'uploaded-image';
        div.draggable = true;
        div.dataset.photoId = photo.id;
        
        div.innerHTML = `
            <img src="${photo.data}" alt="Uploaded">
            <button class="remove-btn" onclick="removePhoto(${photo.id})">×</button>
        `;
        
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('photoId', photo.id);
        });
        
        container.appendChild(div);
    });
}

function removePhoto(photoId) {
    uploadedPhotos = uploadedPhotos.filter(p => p.id !== photoId);
    if (currentFrontImage && currentFrontImage.id === photoId) {
        currentFrontImage = null;
    }
    if (currentFrontBackground && currentFrontBackground.id === photoId) {
        currentFrontBackground = null;
    }
    if (currentBackBackground && currentBackBackground.id === photoId) {
        currentBackBackground = null;
    }
    displayUploadedImages();
    drawCards();
    scheduleSaveState();
}

// Canvas Drop Zones
function setupCanvasDropZones() {
    const frontCanvas = document.getElementById('cardFront');
    const frontContainer = frontCanvas.parentElement;
    const backCanvas = document.getElementById('cardBack');
    const backContainer = backCanvas.parentElement;
    
    // Front canvas - drag image over canvas for main photo
    frontCanvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    frontCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const photoId = parseFloat(e.dataTransfer.getData('photoId'));
        const photo = uploadedPhotos.find(p => p.id === photoId);
        
        if (photo) {
            currentFrontImage = photo;
            photoTransform = { scale: 1, offsetXRatio: 0, offsetYRatio: 0 };
            openPhotoModal();
            drawCards();
            scheduleSaveState();
        }
    });

    // Front container - drag image over container background for background image
    frontContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        frontContainer.classList.add('drag-over');
    });

    frontContainer.addEventListener('dragleave', (e) => {
        if (e.target === frontContainer) {
            frontContainer.classList.remove('drag-over');
        }
    });

    frontContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        frontContainer.classList.remove('drag-over');
        const photoId = parseFloat(e.dataTransfer.getData('photoId'));
        const photo = uploadedPhotos.find(p => p.id === photoId);
        
        if (photo && e.target !== frontCanvas) {
            currentFrontBackground = photo;
            drawCards();
            scheduleSaveState();
        }
    });

    // Back canvas drop zone for background image
    backContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        backContainer.classList.add('drag-over');
    });

    backContainer.addEventListener('dragleave', (e) => {
        if (e.target === backContainer) {
            backContainer.classList.remove('drag-over');
        }
    });

    backContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        backContainer.classList.remove('drag-over');
        const photoId = parseFloat(e.dataTransfer.getData('photoId'));
        const photo = uploadedPhotos.find(p => p.id === photoId);
        
        if (photo) {
            currentBackBackground = photo;
            drawCards();
            scheduleSaveState();
        }
    });
    
    // Front canvas interactions - drag to resize photo, drag to move text
    frontCanvas.addEventListener('mousedown', (e) => {
        const rect = frontCanvas.getBoundingClientRect();
        const scaleX = frontCanvas.width / rect.width;
        const scaleY = frontCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Check if clicking on resize handle (edges of photo area)
        const photoX = frontImagePosition.x;
        const photoY = frontImagePosition.y;
        const photoW = frontImagePosition.width;
        const photoH = frontImagePosition.height;
        const handleSize = 15;

        // Right edge
        if (x >= photoX + photoW - handleSize && x <= photoX + photoW + handleSize &&
            y >= photoY && y <= photoY + photoH) {
            isResizing = true;
            resizeHandle = 'right';
            dragStartX = x;
            return;
        }
        // Bottom edge
        if (y >= photoY + photoH - handleSize && y <= photoY + photoH + handleSize &&
            x >= photoX && x <= photoX + photoW) {
            isResizing = true;
            resizeHandle = 'bottom';
            dragStartY = y;
            return;
        }
        // Bottom-right corner
        if (x >= photoX + photoW - handleSize && x <= photoX + photoW + handleSize &&
            y >= photoY + photoH - handleSize && y <= photoY + photoH + handleSize) {
            isResizing = true;
            resizeHandle = 'corner';
            dragStartX = x;
            dragStartY = y;
            return;
        }

        // Check if clicking inside photo area to move it
        if (x >= photoX && x <= photoX + photoW &&
            y >= photoY && y <= photoY + photoH) {
            isDraggingElement = 'photo';
            dragStartX = x - photoX;
            dragStartY = y - photoY;
            return;
        }

        // Check if clicking on text areas to move them
        // Title area
        if (x >= frontTitlePosition.x && x <= frontTitlePosition.x + 650 &&
            y >= frontTitlePosition.y && y <= frontTitlePosition.y + 120) {
            isDraggingElement = 'title';
            dragStartX = x - frontTitlePosition.x;
            dragStartY = y - frontTitlePosition.y;
            return;
        }

        // Card number area
        if (x >= frontNumberPosition.x && x <= frontNumberPosition.x + 100 &&
            y >= frontNumberPosition.y && y <= frontNumberPosition.y + 90) {
            isDraggingElement = 'number';
            dragStartX = x - frontNumberPosition.x;
            dragStartY = y - frontNumberPosition.y;
            return;
        }

        // Bottom text area
        if (x >= frontTextPosition.x && x <= frontTextPosition.x + 600 &&
            y >= frontTextPosition.y && y <= frontTextPosition.y + 350) {
            isDraggingElement = 'frontText';
            dragStartX = x - frontTextPosition.x;
            dragStartY = y - frontTextPosition.y;
            return;
        }
    });

    frontCanvas.addEventListener('mousemove', (e) => {
        const rect = frontCanvas.getBoundingClientRect();
        const scaleX = frontCanvas.width / rect.width;
        const scaleY = frontCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (isResizing) {
            if (resizeHandle === 'right') {
                frontImagePosition.width = Math.max(100, x - frontImagePosition.x);
            } else if (resizeHandle === 'bottom') {
                frontImagePosition.height = Math.max(100, y - frontImagePosition.y);
            } else if (resizeHandle === 'corner') {
                frontImagePosition.width = Math.max(100, x - frontImagePosition.x);
                frontImagePosition.height = Math.max(100, y - frontImagePosition.y);
            }
            drawCards();
            return;
        }

        if (isDraggingElement) {
            if (isDraggingElement === 'title') {
                frontTitlePosition.x = Math.max(10, Math.min(x - dragStartX, 500));
                frontTitlePosition.y = Math.max(10, Math.min(y - dragStartY, 500));
            } else if (isDraggingElement === 'number') {
                frontNumberPosition.x = Math.max(40, Math.min(x - dragStartX, 680));
                frontNumberPosition.y = Math.max(10, Math.min(y - dragStartY, 500));
            } else if (isDraggingElement === 'photo') {
                frontImagePosition.x = Math.max(40, Math.min(x - dragStartX, 710 - frontImagePosition.width));
                frontImagePosition.y = Math.max(40, Math.min(y - dragStartY, 1010 - frontImagePosition.height));
            } else if (isDraggingElement === 'frontText') {
                frontTextPosition.x = Math.max(40, Math.min(x - dragStartX, 200));
                frontTextPosition.y = Math.max(200, Math.min(y - dragStartY, 900));
            }
            drawCards();
            return;
        }

        // Update cursor based on hover area
        const photoX = frontImagePosition.x;
        const photoY = frontImagePosition.y;
        const photoW = frontImagePosition.width;
        const photoH = frontImagePosition.height;
        const handleSize = 15;

        if ((x >= photoX + photoW - handleSize && x <= photoX + photoW + handleSize &&
            y >= photoY && y <= photoY + photoH) ||
            (y >= photoY + photoH - handleSize && y <= photoY + photoH + handleSize &&
            x >= photoX && x <= photoX + photoW)) {
            frontCanvas.style.cursor = 'nwse-resize';
        } else if (x >= photoX && x <= photoX + photoW && y >= photoY && y <= photoY + photoH) {
            frontCanvas.style.cursor = 'move';
        } else {
            frontCanvas.style.cursor = 'default';
        }
    });

    frontCanvas.addEventListener('mouseup', () => {
        isResizing = false;
        resizeHandle = null;
        isDraggingElement = null;
        frontCanvas.style.cursor = 'default';
        scheduleSaveState();
    });

    frontCanvas.addEventListener('mouseleave', () => {
        isResizing = false;
        resizeHandle = null;
        isDraggingElement = null;
        frontCanvas.style.cursor = 'default';
        scheduleSaveState();
    });

    // Double-click to edit elements
    frontCanvas.addEventListener('dblclick', (e) => {
        const rect = frontCanvas.getBoundingClientRect();
        const scaleX = frontCanvas.width / rect.width;
        const scaleY = frontCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Title area
        if (x >= frontTitlePosition.x && x <= frontTitlePosition.x + 650 && 
            y >= frontTitlePosition.y && y <= frontTitlePosition.y + 120) {
            const container = frontCanvas.parentElement;
            const left = frontTitlePosition.x / scaleX;
            const top = frontTitlePosition.y / scaleY;
            const width = 650 / scaleX;
            const height = 120 / scaleY;
            showCanvasEditor(container, left, top, width, height, document.getElementById('frontTitle').value, false, (val) => {
                document.getElementById('frontTitle').value = val;
                drawCards();
            });
            return;
        }

        // Card number area
        if (x >= frontNumberPosition.x && x <= frontNumberPosition.x + 100 && 
            y >= frontNumberPosition.y && y <= frontNumberPosition.y + 90) {
            const container = frontCanvas.parentElement;
            const left = frontNumberPosition.x / scaleX;
            const top = frontNumberPosition.y / scaleY;
            const width = 100 / scaleX;
            const height = 40 / scaleY;
            showCanvasEditor(container, left, top, width, height, document.getElementById('cardNumber').value, false, (val) => {
                const n = parseInt(val) || 0;
                document.getElementById('cardNumber').value = n;
                drawCards();
            });
            return;
        }
    });

    // Back canvas click-to-edit (removed as text is now edited via Quill)
    const backCanvas_element = document.getElementById('cardBack');
}

// Generic inline editor for canvas text areas. container should be the .canvas-container
function showCanvasEditor(container, leftPx, topPx, widthPx, heightPx, initialValue, isMultiline, commit) {
    // container is positioned; inputs are placed in CSS pixels relative to container
    const editor = document.createElement(isMultiline ? 'textarea' : 'input');
    editor.className = 'canvas-input';
    if (!isMultiline) editor.type = 'text';
    editor.value = initialValue || '';
    editor.style.left = leftPx + 'px';
    editor.style.top = topPx + 'px';
    editor.style.width = Math.max(60, widthPx) + 'px';
    editor.style.height = Math.max(24, heightPx) + 'px';

    // Match parent font sizing roughly
    editor.style.fontSize = '16px';
    container.appendChild(editor);
    editor.focus();

    function commitAndRemove() {
        const val = editor.value;
        editor.remove();
        commit(val);
    }

    editor.addEventListener('blur', () => commitAndRemove());
    editor.addEventListener('keydown', (ev) => {
        if (!isMultiline && ev.key === 'Enter') {
            ev.preventDefault();
            commitAndRemove();
        }
        // For multiline, allow Ctrl+Enter to commit
        if (isMultiline && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
            ev.preventDefault();
            commitAndRemove();
        }
    });
}

// Initialize Rich Text Editors
function initializeRichTextEditors() {
    // Front text editor
    frontTextEditor = new Quill('#frontText', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'size': ['small', false, 'large', 'huge'] }],
                [{ 'color': [] }],
                [{ 'align': [] }]
            ]
        },
        placeholder: 'Enter description...'
    });

    frontTextEditor.on('text-change', () => {
        drawCards();
        scheduleSaveState();
    });

    // Back text editor
    backTextEditor = new Quill('#backText', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'size': ['small', false, 'large', 'huge'] }],
                [{ 'color': [] }],
                [{ 'align': [] }]
            ]
        },
        placeholder: 'Enter back text...'
    });

    backTextEditor.on('text-change', () => {
        drawCards();
        scheduleSaveState();
    });

    const editPhotoBtn = document.getElementById('editPhotoBtn');
    if (editPhotoBtn) {
        editPhotoBtn.addEventListener('click', () => openPhotoModal());
    }

    const photoZoom = document.getElementById('photoZoom');
    const photoModal = document.getElementById('photoModal');
    const photoApply = document.getElementById('photoApply');
    const photoCancel = document.getElementById('photoCancel');
    const photoPreview = document.getElementById('photoPreview');
    const photoPreviewImage = document.getElementById('photoPreviewImage');

    if (photoZoom) {
        photoZoom.addEventListener('input', () => {
            photoModalState.scale = parseFloat(photoZoom.value) || 1;
            updatePhotoPreview();
        });
    }

    if (photoApply) {
        photoApply.addEventListener('click', () => {
            photoTransform = { ...photoModalState };
            closePhotoModal();
            drawCards();
            scheduleSaveState();
        });
    }

    if (photoCancel) {
        photoCancel.addEventListener('click', () => {
            closePhotoModal();
        });
    }

    // Drag handling for preview
    if (photoPreview) {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        photoPreview.addEventListener('mousedown', (e) => {
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            photoPreview.style.cursor = 'grabbing';
        });
        window.addEventListener('mouseup', () => {
            dragging = false;
            photoPreview.style.cursor = 'grab';
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const rect = photoPreview.getBoundingClientRect();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            startX = e.clientX;
            startY = e.clientY;
            photoModalState.offsetXRatio += dx / rect.width;
            photoModalState.offsetYRatio += dy / rect.height;
            // Clamp to reasonable range
            photoModalState.offsetXRatio = Math.max(-1.5, Math.min(1.5, photoModalState.offsetXRatio));
            photoModalState.offsetYRatio = Math.max(-1.5, Math.min(1.5, photoModalState.offsetYRatio));
            updatePhotoPreview();
        });
    }
}

// Controls Setup
function setupControls() {
    // Front card controls
    document.getElementById('frontTitle').addEventListener('input', drawCards);
    document.getElementById('cardNumber').addEventListener('input', drawCards);
    // frontText now handled by Quill editor
    document.getElementById('frontFont').addEventListener('change', drawCards);
    document.getElementById('frontFontSize').addEventListener('input', function() {
        document.getElementById('frontFontSizeValue').textContent = this.value + 'px';
        drawCards();
        scheduleSaveState();
    });
    document.getElementById('frontColor').addEventListener('input', () => { drawCards(); scheduleSaveState(); });
    document.getElementById('titleFontFamily').addEventListener('change', (e) => { titleStyle.font = e.target.value; drawCards(); });
    document.getElementById('titleFontSize').addEventListener('input', (e) => { titleStyle.size = parseInt(e.target.value) || titleStyle.size; drawCards(); scheduleSaveState(); });
    document.getElementById('titleColor').addEventListener('input', (e) => { titleStyle.color = e.target.value; drawCards(); scheduleSaveState(); });
    document.getElementById('numberFontFamily').addEventListener('change', (e) => { numberStyle.font = e.target.value; drawCards(); scheduleSaveState(); });
    document.getElementById('numberFontSize').addEventListener('input', (e) => { numberStyle.size = parseInt(e.target.value) || numberStyle.size; drawCards(); scheduleSaveState(); });
    document.getElementById('numberColor').addEventListener('input', (e) => { numberStyle.color = e.target.value; drawCards(); scheduleSaveState(); });

    const styleToggle = document.getElementById('frontStyleToggle');
    const stylePanel = document.getElementById('frontStylePanel');
    styleToggle.addEventListener('click', () => {
        stylePanel.classList.toggle('open');
    });

    // Back card controls
    // backText now handled by Quill editor
    document.getElementById('backFont').addEventListener('change', () => { drawCards(); scheduleSaveState(); });
    document.getElementById('backFontSize').addEventListener('input', function() {
        document.getElementById('backFontSizeValue').textContent = this.value + 'px';
        drawCards();
        scheduleSaveState();
    });
    document.getElementById('backColor').addEventListener('input', () => { drawCards(); scheduleSaveState(); });
}

// Draw Cards
function drawCards() {
    drawCardFront();
    drawCardBack();
}

function drawCardFront() {
    const canvas = document.getElementById('cardFront');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background image (if set)
    if (currentFrontBackground && currentFrontBackground.img) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.clip();
        
        const img = currentFrontBackground.img;
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        ctx.restore();
    }
    
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Inner border
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
    
    // Title - transparent background (removed gray fill)
    const title = document.getElementById('frontTitle').value || 'Card Title';
    const titleFont = titleStyle.font;
    ctx.fillStyle = titleStyle.color;
    ctx.font = `bold ${titleStyle.size}px ${titleFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, frontTitlePosition.x + 325, frontTitlePosition.y + 60, canvas.width - 120);
    
    // Card Number
    const cardNum = document.getElementById('cardNumber').value || '1';
    const paddedNum = String(cardNum).padStart(3, '0');
    ctx.font = `bold ${numberStyle.size}px ${numberStyle.font}`;
    ctx.fillStyle = numberStyle.color;
    ctx.textAlign = 'right';
    ctx.fillText(`#${paddedNum}`, frontNumberPosition.x + 70, frontNumberPosition.y + 60);
    
    // Photo area with resize handles
    const photoX = frontImagePosition.x;
    const photoY = frontImagePosition.y;
    const photoWidth = frontImagePosition.width;
    const photoHeight = frontImagePosition.height;
    
    if (currentFrontImage && currentFrontImage.img) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(photoX, photoY, photoWidth, photoHeight);
        ctx.clip();
        
        const img = currentFrontImage.img;
        const baseScale = Math.max(photoWidth / img.width, photoHeight / img.height);
        const totalScale = baseScale * photoTransform.scale;
        const scaledWidth = img.width * totalScale;
        const scaledHeight = img.height * totalScale;
        const offsetX = photoTransform.offsetXRatio * photoWidth;
        const offsetY = photoTransform.offsetYRatio * photoHeight;
        const x = photoX + (photoWidth - scaledWidth) / 2 + offsetX;
        const y = photoY + (photoHeight - scaledHeight) / 2 + offsetY;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        ctx.restore();
    } else {
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(photoX, photoY, photoWidth, photoHeight);
        ctx.fillStyle = '#999999';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Drop photo here', canvas.width / 2, photoY + photoHeight / 2);
    }
    
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 3;
    ctx.strokeRect(photoX, photoY, photoWidth, photoHeight);
    
    // Draw resize handles
    ctx.fillStyle = '#667eea';
    ctx.fillRect(photoX + photoWidth - 10, photoY + photoHeight / 2 - 8, 10, 16);
    ctx.fillRect(photoX + photoWidth / 2 - 8, photoY + photoHeight - 10, 16, 10);
    
    // Bottom text area
    if (!frontTextEditor) return;
    
    const textX = frontTextPosition.x;
    const textY = frontTextPosition.y;
    const textWidth = 600;
    const baseFontSize = parseInt(document.getElementById('frontFontSize').value);
    const baseFontFamily = document.getElementById('frontFont').value;
    const baseColor = document.getElementById('frontColor').value;
    
    // Get rich text content from Quill
    const delta = frontTextEditor.getContents();
    renderRichTextOnCanvas(ctx, delta, textX, textY, textWidth, baseFontSize, baseFontFamily, baseColor);
}

function drawCardBack() {
    const canvas = document.getElementById('cardBack');
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background image (if set)
    if (currentBackBackground && currentBackBackground.img) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.clip();
        
        const img = currentBackBackground.img;
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        ctx.restore();
    }

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Inner border
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

    // Decorative pattern background (only if no background image)
    if (!currentBackBackground) {
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(50, 50, canvas.width - 100, canvas.height - 100);
    }

    // Center text area
    if (!backTextEditor) return;
    
    const textX = canvas.width / 2; // center
    const textY = backTextPosition.y;
    const textWidth = 550;
    const baseFontSize = parseInt(document.getElementById('backFontSize').value);
    const baseFontFamily = document.getElementById('backFont').value;
    const baseColor = document.getElementById('backColor').value;

    // Get rich text content from Quill
    const delta = backTextEditor.getContents();
    renderRichTextOnCanvas(ctx, delta, textX, textY, textWidth, baseFontSize, baseFontFamily, baseColor, 'center');
}

function wrapText(ctx, x, y, maxWidth, lineHeight) {
    // Backwards-compatible signature handled by callers below
}

// New wrapText with align support: wrapText(ctx, text, x, y, maxWidth, lineHeight, align)
function wrapText(ctx, text, x, y, maxWidth, lineHeight, align) {
    align = align || 'left';
    const words = String(text).split(' ');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + (i < words.length - 1 ? ' ' : '');
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line.length > 0) {
            // draw current line
            if (align === 'center') {
                ctx.textAlign = 'center';
                ctx.fillText(line.trim(), x, currentY);
            } else {
                ctx.textAlign = 'left';
                ctx.fillText(line.trim(), x, currentY);
            }
            line = words[i] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }

    if (line) {
        if (align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(line.trim(), x, currentY);
        } else {
            ctx.textAlign = 'left';
            ctx.fillText(line.trim(), x, currentY);
        }
    }
}

// Render rich text from Quill delta on canvas
function renderRichTextOnCanvas(ctx, delta, startX, startY, maxWidth, baseFontSize, baseFontFamily, baseColor, defaultAlign = 'left') {
    let currentY = startY;
    let lineSegments = [];
    let lineMaxFontSize = baseFontSize;
    let lineAlign = defaultAlign;

    function flushLine() {
        if (lineSegments.length === 0) return;
        const lineHeight = lineMaxFontSize * 1.4;
        drawLineSegments(ctx, lineSegments, startX, currentY, maxWidth, lineAlign);
        currentY += lineHeight;
        lineSegments = [];
        lineMaxFontSize = baseFontSize;
        lineAlign = defaultAlign;
    }

    // Process each operation in the delta
    delta.ops.forEach((op) => {
        if (typeof op.insert === 'string') {
            const text = op.insert;
            const attributes = op.attributes || {};
            const align = attributes.align || defaultAlign;

            // Handle line breaks
            const lines = text.split('\n');
            lines.forEach((lineText, lineIndex) => {
                if (lineText.length > 0) {
                    // Set font properties
                    const fontWeight = attributes.bold ? 'bold' : 'normal';
                    const fontStyle = attributes.italic ? 'italic' : 'normal';
                    let fontSize = baseFontSize;
                    if (attributes.size === 'small') fontSize = baseFontSize * 0.75;
                    else if (attributes.size === 'large') fontSize = baseFontSize * 1.5;
                    else if (attributes.size === 'huge') fontSize = baseFontSize * 2;
                    const color = attributes.color || baseColor;

                    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${baseFontFamily}`;
                    ctx.fillStyle = color;
                    lineMaxFontSize = Math.max(lineMaxFontSize, fontSize);
                    lineAlign = align || defaultAlign;

                    // Split text into words for wrapping
                    const words = lineText.split(' ');
                    let currentX = startX + lineSegments.reduce((sum, seg) => sum + seg.width, 0);
                    words.forEach((word, wordIndex) => {
                        const wordText = word + (wordIndex < words.length - 1 ? ' ' : '');
                        const wordWidth = ctx.measureText(wordText).width;

                        // Check if we need to wrap
                        if (currentX - startX + wordWidth > maxWidth && lineSegments.length > 0) {
                            flushLine();
                            currentX = startX;
                        }

                        // Add word to current line
                        lineSegments.push({
                            text: wordText,
                            font: ctx.font,
                            color: color,
                            width: wordWidth,
                            underline: attributes.underline
                        });
                        currentX += wordWidth;
                    });
                }

                // Handle line break
                if (lineIndex < lines.length - 1) {
                    flushLine();
                }
            });
        }
    });

    // Draw remaining segments
    flushLine();
}

function drawLineSegments(ctx, segments, startX, y, maxWidth, align) {
    // Calculate total width
    const totalWidth = segments.reduce((sum, seg) => sum + seg.width, 0);

    // Determine starting X based on alignment
    let currentX = startX;
    if (align === 'center') {
        currentX = startX + (maxWidth - totalWidth) / 2;
    } else if (align === 'right') {
        currentX = startX + maxWidth - totalWidth;
    }

    // Draw each segment
    segments.forEach(seg => {
        ctx.font = seg.font;
        ctx.fillStyle = seg.color;
        ctx.fillText(seg.text, currentX, y);

        // Draw underline if needed
        if (seg.underline) {
            const textMetrics = ctx.measureText(seg.text);
            ctx.beginPath();
            ctx.strokeStyle = seg.color;
            ctx.lineWidth = 1;
            ctx.moveTo(currentX, y + 2);
            ctx.lineTo(currentX + textMetrics.width, y + 2);
            ctx.stroke();
        }

        currentX += seg.width;
    });
}

function scheduleSaveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 300);
}

function loadState() {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const state = JSON.parse(raw);
        // Restore photos
        if (Array.isArray(state.photos)) {
            uploadedPhotos = [];
            const targetCount = state.photos.length;
            let loadedCount = 0;
            const pendingFrontId = state.currentFrontImageId;
            const pendingFrontBgId = state.currentFrontBackgroundId;
            const pendingBackBgId = state.currentBackBackgroundId;

            state.photos.forEach(p => {
                const img = new Image();
                img.onload = () => {
                    uploadedPhotos.push({ id: p.id, data: p.data, img });
                    loadedCount += 1;

                    if (pendingFrontId && p.id === pendingFrontId) currentFrontImage = { id: p.id, data: p.data, img };
                    if (pendingFrontBgId && p.id === pendingFrontBgId) currentFrontBackground = { id: p.id, data: p.data, img };
                    if (pendingBackBgId && p.id === pendingBackBgId) currentBackBackground = { id: p.id, data: p.data, img };

                    if (loadedCount === targetCount) {
                        displayUploadedImages();
                        drawCards();
                    }
                };
                img.src = p.data;
            });
        }

        // Restore references
        // (Handled during image load)

        // Restore positions and styles
        frontImagePosition = state.frontImagePosition || frontImagePosition;
        frontTitlePosition = state.frontTitlePosition || frontTitlePosition;
        frontNumberPosition = state.frontNumberPosition || frontNumberPosition;
        frontTextPosition = state.frontTextPosition || frontTextPosition;
        backTextPosition = state.backTextPosition || backTextPosition;
        titleStyle = state.titleStyle || titleStyle;
        numberStyle = state.numberStyle || numberStyle;
        photoTransform = state.photoTransform || photoTransform;

        // Restore controls
        if (state.frontControls) {
            document.getElementById('frontFont').value = state.frontControls.font || document.getElementById('frontFont').value;
            document.getElementById('frontFontSize').value = state.frontControls.fontSize || document.getElementById('frontFontSize').value;
            document.getElementById('frontFontSizeValue').textContent = `${document.getElementById('frontFontSize').value}px`;
            document.getElementById('frontColor').value = state.frontControls.color || document.getElementById('frontColor').value;
        }
        if (state.backControls) {
            document.getElementById('backFont').value = state.backControls.font || document.getElementById('backFont').value;
            document.getElementById('backFontSize').value = state.backControls.fontSize || document.getElementById('backFontSize').value;
            document.getElementById('backFontSizeValue').textContent = `${document.getElementById('backFontSize').value}px`;
            document.getElementById('backColor').value = state.backControls.color || document.getElementById('backColor').value;
        }

        // Restore title/number fields
        if (typeof state.frontTitle === 'string') {
            document.getElementById('frontTitle').value = state.frontTitle;
        }
        if (typeof state.cardNumber === 'string' || typeof state.cardNumber === 'number') {
            document.getElementById('cardNumber').value = state.cardNumber;
        }

        // Restore text editors
        if (state.frontTextDelta && frontTextEditor) {
            frontTextEditor.setContents(state.frontTextDelta);
        }
        if (state.backTextDelta && backTextEditor) {
            backTextEditor.setContents(state.backTextDelta);
        }

        drawCards();
    } catch (err) {
        console.warn('Could not load saved state', err);
    }
}

// Modal helpers
function openPhotoModal() {
    if (!currentFrontImage || !currentFrontImage.img) return;
    const photoModal = document.getElementById('photoModal');
    const photoZoom = document.getElementById('photoZoom');
    const photoPreviewImage = document.getElementById('photoPreviewImage');

    photoModalState = { ...photoTransform };
    if (photoZoom) photoZoom.value = photoModalState.scale;
    if (photoPreviewImage) {
        photoPreviewImage.src = currentFrontImage.data;
    }
    updatePhotoPreview();
    if (photoModal) {
        photoModal.classList.add('open');
        photoModal.setAttribute('aria-hidden', 'false');
    }
}

function closePhotoModal() {
    const photoModal = document.getElementById('photoModal');
    if (photoModal) {
        photoModal.classList.remove('open');
        photoModal.setAttribute('aria-hidden', 'true');
    }
}

function updatePhotoPreview() {
    const photoPreview = document.getElementById('photoPreview');
    const photoPreviewImage = document.getElementById('photoPreviewImage');
    if (!photoPreview || !photoPreviewImage || !currentFrontImage || !currentFrontImage.img) return;

    const rect = photoPreview.getBoundingClientRect();
    const targetW = rect.width;
    const targetH = rect.height;
    const img = currentFrontImage.img;

    const baseScale = Math.max(targetW / img.width, targetH / img.height);
    const totalScale = baseScale * photoModalState.scale;
    const scaledW = img.width * totalScale;
    const scaledH = img.height * totalScale;
    const offsetX = photoModalState.offsetXRatio * targetW;
    const offsetY = photoModalState.offsetYRatio * targetH;
    const x = (targetW - scaledW) / 2 + offsetX;
    const y = (targetH - scaledH) / 2 + offsetY;

    photoPreviewImage.style.width = `${scaledW}px`;
    photoPreviewImage.style.height = `${scaledH}px`;
    photoPreviewImage.style.left = `${x}px`;
    photoPreviewImage.style.top = `${y}px`;
}

// Export Functions
function exportCard(side) {
    const canvas = side === 'front' ? document.getElementById('cardFront') : document.getElementById('cardBack');
    const link = document.createElement('a');
    const title = side === 'front' ? document.getElementById('frontTitle').value : 'back';
    const filename = `trading-card-${side}-${title.replace(/\s+/g, '-').toLowerCase() || 'untitled'}.png`;
    
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

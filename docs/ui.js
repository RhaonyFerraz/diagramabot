/**
 * ui.js — Inspector panel & toolbar reactive UI
 */

const PALETTE = [
  { r: 37,  g: 99,  b: 235, a: 255 }, // Blue
  { r: 16,  g: 185, b: 129, a: 255 }, // Emerald
  { r: 245, g: 158, b: 11,  a: 255 }, // Amber Gold
  { r: 244, g: 63,  b: 94,  a: 255 }, // Coral Rose
  { r: 139, g: 92,  b: 246, a: 255 }, // Violet / Purple
  { r: 13,  g: 148, b: 136, a: 255 }, // Cyan / Teal
  { r: 234, g: 179, b: 8,   a: 255 }, // Warm Post-it Yellow
  { r: 51,  g: 65,  b: 85,  a: 255 }, // Deep Slate
  { r: 255, g: 255, b: 255, a: 255 }, // ⬜ Branco
];

// Returns true if color is "light" (needs dark text/border)
function _isLightColor(c) {
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return lum > 185;
}

const SHAPE_NAMES = {
  [ShapeType.PROCESS]:    'Processo',
  [ShapeType.DECISION]:   'Decisão',
  [ShapeType.TERMINATOR]: 'Início/Fim',
  [ShapeType.DATA]:       'Entrada/Saída',
  [ShapeType.DATABASE]:   'Banco Dados',
  [ShapeType.SUBPROCESS]: 'Subprocesso',
  [ShapeType.DOCUMENT]:   'Documento',
  [ShapeType.NOTE]:       'Nota',
  [ShapeType.IMAGE]:      'Imagem',
  [ShapeType.TEXT]:       'Caixa de Texto',
};

const SHAPE_CYCLE = [
  ShapeType.PROCESS, ShapeType.DECISION, ShapeType.TERMINATOR,
  ShapeType.DATA, ShapeType.DATABASE, ShapeType.SUBPROCESS, ShapeType.NOTE,
];

class UI {
  constructor(diagram, app) {
    this.diagram = diagram;
    this.app     = app; // reference to App for triggering redraws

    this._inspectorEl = document.getElementById('inspector-content');
    this._toastEl     = document.getElementById('toast');
    this._toastTimer  = null;
    this._coordsEl    = document.getElementById('status-coords');
    this._rightEl     = document.getElementById('status-right');
    this._zoomBtn     = document.getElementById('btn-zoom-reset');
    this._gridBtn     = document.getElementById('btn-grid');
    this._snapBtn     = document.getElementById('btn-snap');

    this._lastSelectedNode = null;
    this._lastSelectedConn = null;
    this._lastBgColor      = null;
  }

  updateStatusBar(camera, fps) {
    const mx = this.app.lastMouseWorld.x, my = this.app.lastMouseWorld.y;
    this._coordsEl.textContent = `X: ${mx.toFixed(0)}  Y: ${my.toFixed(0)}`;
    this._zoomBtn.textContent  = `${Math.round(camera.zoom * 100)}%`;
    this._rightEl.textContent  = `Zoom: ${Math.round(camera.zoom * 100)}%  |  Snap: ${this.diagram.snapToGrid ? 'ON' : 'OFF'}  |  FPS: ${fps}`;
    this._gridBtn.classList.toggle('active', this.diagram.showGrid);
    this._snapBtn.classList.toggle('active', this.diagram.snapToGrid);

    const isWhite = this.diagram.backgroundColor === 'white';
    document.body.classList.toggle('light-theme', isWhite);

    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      const targetLabel = isWhite ? '🌙 Modo Escuro' : '☀️ Modo Claro';
      if (themeBtn.textContent !== targetLabel) {
        themeBtn.textContent = targetLabel;
        themeBtn.classList.toggle('active', isWhite);
        themeBtn.classList.toggle('is-white', isWhite);
        themeBtn.title = isWhite ? 'Alternar para Modo Escuro' : 'Alternar para Modo Claro';
      }
    }
  }

  updateToast() {
    const d = this.diagram;
    if (d.toastTimer > 0) {
      let alpha = 1;
      if (d.toastTimer < 0.5) alpha = d.toastTimer / 0.5;
      this._toastEl.textContent = d.toastMessage;
      this._toastEl.style.opacity = alpha;
      this._toastEl.classList.add('visible');
    } else {
      this._toastEl.classList.remove('visible');
    }
  }

  updateInspector() {
    const d = this.diagram;
    const node = d.getNode(d.selectedNodeId);
    const conn = d.getConnection(d.selectedConnId);

    // Avoid rebuilding DOM if selection unchanged
    if (node && node === this._lastSelectedNode && conn === this._lastSelectedConn) {
      this._updateColorSwatches(node.fillColor);
      return;
    }
    // Avoid rebuilding summary if nothing was and still is selected and theme didn't change
    if (!node && !conn && this._lastSelectedNode === null && this._lastSelectedConn === null && this._lastBgColor === d.backgroundColor) {
      return;
    }
    this._lastSelectedNode = node || null;
    this._lastSelectedConn = conn || null;
    this._lastBgColor      = d.backgroundColor;

    const el = this._inspectorEl;
    el.innerHTML = '';

    if (node) {
      el.appendChild(this._buildNodeInspector(node));
    } else if (conn) {
      el.appendChild(this._buildConnInspector(conn));
    } else {
      el.appendChild(this._buildSummary());
    }
  }

  _buildNodeInspector(node) {
    if (node.type === ShapeType.IMAGE) {
      return this._buildImageInspector(node);
    }
    if (node.type === ShapeType.TEXT) {
      return this._buildTextInspector(node);
    }

    const d = this.diagram;
    const wrap = document.createElement('div');

    // Title
    const title = document.createElement('div');
    title.className = 'inspector-title';
    title.textContent = 'PROPRIEDADES DO BLOCO';
    wrap.appendChild(title);

    // Text
    const textRow = document.createElement('div');
    textRow.className = 'inspector-row';
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Texto / Título:';
    const textBtn = document.createElement('button');
    textBtn.className = 'inspector-btn';
    textBtn.textContent = node.text || '[Editar Texto]';
    textBtn.addEventListener('click', () => this.app.startEditing(node.id, true));
    textRow.appendChild(textLabel);
    textRow.appendChild(textBtn);
    wrap.appendChild(textRow);

    // Shape type
    const shapeRow = document.createElement('div');
    shapeRow.className = 'inspector-row';
    const shapeLabel = document.createElement('label');
    shapeLabel.textContent = 'Tipo de Forma:';
    const shapeBtn = document.createElement('button');
    shapeBtn.className = 'inspector-btn';
    shapeBtn.textContent = SHAPE_NAMES[node.type] || node.type;
    shapeBtn.title = 'Clique para ciclar o tipo';
    shapeBtn.addEventListener('click', () => {
      const idx = SHAPE_CYCLE.indexOf(node.type);
      node.type = SHAPE_CYCLE[(idx + 1) % SHAPE_CYCLE.length];
      shapeBtn.textContent = SHAPE_NAMES[node.type] || node.type;
      d._pushHistory();
    });
    shapeRow.appendChild(shapeLabel);
    shapeRow.appendChild(shapeBtn);
    wrap.appendChild(shapeRow);

    // Color palette
    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Cor de Preenchimento:';
    colorRow.appendChild(colorLabel);

    const palette = document.createElement('div');
    palette.className = 'color-palette';
    palette.id = 'node-palette';
    PALETTE.forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'color-swatch';
      sw.style.background = colorToCss(c);
      // White swatch: show dark border so it's visible on dark UI
      if (c.r === 255 && c.g === 255 && c.b === 255) {
        sw.style.border = '2px solid #64748b';
        sw.title = 'Branco';
      }
      if (_colorMatch(c, node.fillColor)) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        node.fillColor = { ...c };
        if (_isLightColor(c)) {
          // Light fill → dark border + dark text
          node.borderColor = { r: 100, g: 116, b: 139, a: 255 };
          node.textColor   = { r: 15,  g: 23,  b: 42,  a: 255 };
        } else {
          // Normal: auto-lighter border + white text
          node.borderColor = {
            r: Math.min(255, Math.round(c.r * 1.35)),
            g: Math.min(255, Math.round(c.g * 1.35)),
            b: Math.min(255, Math.round(c.b * 1.35)),
            a: 255,
          };
          node.textColor = { r: 255, g: 255, b: 255, a: 255 };
        }
        palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        d._pushHistory();
      });
      palette.appendChild(sw);
    });
    colorRow.appendChild(palette);
    wrap.appendChild(colorRow);

    // Dimensions
    const dimRow = document.createElement('div');
    dimRow.className = 'inspector-row';
    const dimLabel = document.createElement('label');
    dimLabel.textContent = `Largura: ${Math.round(node.w)}  |  Altura: ${Math.round(node.h)}`;
    dimRow.appendChild(dimLabel);
    const sizeBtns = document.createElement('div');
    sizeBtns.className = 'size-btns';
    const btnPlus  = document.createElement('button');
    btnPlus.className  = 'size-btn';
    btnPlus.textContent = '+ Tamanho';
    btnPlus.addEventListener('click', () => {
      node.w += 20; node.h += 10;
      dimLabel.textContent = `Largura: ${Math.round(node.w)}  |  Altura: ${Math.round(node.h)}`;
      d._pushHistory();
    });
    const btnMinus = document.createElement('button');
    btnMinus.className  = 'size-btn';
    btnMinus.textContent = '− Tamanho';
    btnMinus.addEventListener('click', () => {
      if (node.w > 60) node.w -= 20;
      if (node.h > 40) node.h -= 10;
      dimLabel.textContent = `Largura: ${Math.round(node.w)}  |  Altura: ${Math.round(node.h)}`;
      d._pushHistory();
    });
    sizeBtns.appendChild(btnPlus);
    sizeBtns.appendChild(btnMinus);
    dimRow.appendChild(sizeBtns);
    wrap.appendChild(dimRow);

    // Divider
    const div1 = document.createElement('div');
    div1.className = 'inspector-divider';
    wrap.appendChild(div1);

    // Duplicate
    const dupBtn = document.createElement('button');
    dupBtn.className = 'inspector-btn';
    dupBtn.textContent = 'Duplicar Bloco (Ctrl+D)';
    dupBtn.style.marginBottom = '8px';
    dupBtn.addEventListener('click', () => d.duplicateSelectedNode());
    wrap.appendChild(dupBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'inspector-danger';
    delBtn.textContent = 'Excluir Bloco (Del)';
    delBtn.addEventListener('click', () => d.removeNode(node.id));
    wrap.appendChild(delBtn);

    return wrap;
  }

  _buildImageInspector(node) {
    const d = this.diagram;
    const wrap = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'inspector-title';
    title.textContent = 'PROPRIEDADES DA IMAGEM';
    wrap.appendChild(title);

    // Image Preview & Replace Button
    const previewWrap = document.createElement('div');
    previewWrap.className = 'inspector-img-preview-wrap';
    if (node.imageData) {
      const img = document.createElement('img');
      img.src = node.imageData;
      img.className = 'inspector-img-thumb';
      previewWrap.appendChild(img);
    }

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'inspector-btn';
    replaceBtn.textContent = '🔄 Substituir Imagem…';
    replaceBtn.style.marginTop = '6px';
    replaceBtn.addEventListener('click', () => {
      const input = document.getElementById('image-file-input');
      if (input) {
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const tempImg = new Image();
            tempImg.onload = () => {
              node.imageData = ev.target.result;
              node.aspectRatio = tempImg.naturalWidth / tempImg.naturalHeight;
              d._pushHistory();
              d.setToast('Imagem substituída! 🖼️');
            };
            tempImg.src = ev.target.result;
          };
          reader.readAsDataURL(file);
          input.value = '';
        };
        input.click();
      }
    });
    previewWrap.appendChild(replaceBtn);
    wrap.appendChild(previewWrap);

    // Caption / Text
    const textRow = document.createElement('div');
    textRow.className = 'inspector-row';
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Legenda (Opcional):';
    const textBtn = document.createElement('button');
    textBtn.className = 'inspector-btn';
    textBtn.textContent = node.text || '[Adicionar Legenda]';
    textBtn.addEventListener('click', () => this.app.startEditing(node.id, true));
    textRow.appendChild(textLabel);
    textRow.appendChild(textBtn);
    wrap.appendChild(textRow);

    // Dimensions
    const dimRow = document.createElement('div');
    dimRow.className = 'inspector-row';
    const dimLabel = document.createElement('label');
    dimLabel.textContent = `Largura: ${Math.round(node.w)}  |  Altura: ${Math.round(node.h)}`;
    dimRow.appendChild(dimLabel);

    const sizeBtns = document.createElement('div');
    sizeBtns.className = 'size-btns';
    const btnPlus = document.createElement('button');
    btnPlus.className = 'size-btn';
    btnPlus.textContent = '+ Tamanho';
    btnPlus.addEventListener('click', () => {
      const ratio = node.aspectRatio || (node.w / node.h);
      node.w += 30;
      node.h = Math.round(node.w / ratio);
      dimLabel.textContent = `Largura: ${Math.round(node.w)}  |  Altura: ${Math.round(node.h)}`;
      d._pushHistory();
    });
    const btnMinus = document.createElement('button');
    btnMinus.className = 'size-btn';
    btnMinus.textContent = '− Tamanho';
    btnMinus.addEventListener('click', () => {
      if (node.w > 60) {
        const ratio = node.aspectRatio || (node.w / node.h);
        node.w = Math.max(60, node.w - 30);
        node.h = Math.round(node.w / ratio);
        dimLabel.textContent = `Largura: ${Math.round(node.w)}  |  Altura: ${Math.round(node.h)}`;
        d._pushHistory();
      }
    });
    sizeBtns.appendChild(btnPlus);
    sizeBtns.appendChild(btnMinus);
    dimRow.appendChild(sizeBtns);

    const resetRatioBtn = document.createElement('button');
    resetRatioBtn.className = 'inspector-btn';
    resetRatioBtn.textContent = '📐 Restaurar Proporção';
    resetRatioBtn.style.marginTop = '6px';
    resetRatioBtn.addEventListener('click', () => {
      if (node.aspectRatio) {
        node.h = Math.round(node.w / node.aspectRatio);
        dimLabel.textContent = `Largura: ${Math.round(node.w)}  |  Altura: ${Math.round(node.h)}`;
        d._pushHistory();
        d.setToast('Proporção original restaurada');
      }
    });
    dimRow.appendChild(resetRatioBtn);
    wrap.appendChild(dimRow);

    // Border color palette
    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Cor da Borda:';
    colorRow.appendChild(colorLabel);

    const palette = document.createElement('div');
    palette.className = 'color-palette';
    PALETTE.forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'color-swatch';
      sw.style.background = colorToCss(c);
      if (_colorMatch(c, node.borderColor)) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        node.borderColor = { ...c };
        palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        d._pushHistory();
      });
      palette.appendChild(sw);
    });
    colorRow.appendChild(palette);
    wrap.appendChild(colorRow);

    // Divider
    const div1 = document.createElement('div');
    div1.className = 'inspector-divider';
    wrap.appendChild(div1);

    // Duplicate
    const dupBtn = document.createElement('button');
    dupBtn.className = 'inspector-btn';
    dupBtn.textContent = 'Duplicar Imagem (Ctrl+D)';
    dupBtn.style.marginBottom = '8px';
    dupBtn.addEventListener('click', () => d.duplicateSelectedNode());
    wrap.appendChild(dupBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'inspector-danger';
    delBtn.textContent = 'Excluir Imagem (Del)';
    delBtn.addEventListener('click', () => d.removeNode(node.id));
    wrap.appendChild(delBtn);

    return wrap;
  }

  _buildTextInspector(node) {
    const d = this.diagram;
    const wrap = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'inspector-title';
    title.textContent = 'PROPRIEDADES DO TEXTO';
    wrap.appendChild(title);

    // Helper to update dimension label
    let dimLabel = null;
    const updateDimText = () => {
      if (dimLabel) {
        dimLabel.innerHTML = `Dimensões: ${Math.round(node.w)} × ${Math.round(node.h)}px <span class="inspector-badge-autofit">✨ Auto-fit</span>`;
      }
    };

    // 1. Textarea Content
    const textRow = document.createElement('div');
    textRow.className = 'inspector-row';
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Conteúdo do Texto:';
    textRow.appendChild(textLabel);

    const textarea = document.createElement('textarea');
    textarea.className = 'inspector-textarea';
    textarea.rows = 3;
    textarea.placeholder = 'Digite seu texto aqui...';
    textarea.value = node.text || '';
    textarea.addEventListener('input', () => {
      node.text = textarea.value;
      d.recomputeTextNodeDimensions(node);
      updateDimText();
      d._pushHistory();
    });
    textRow.appendChild(textarea);
    wrap.appendChild(textRow);

    // 2. Font Family
    const fontRow = document.createElement('div');
    fontRow.className = 'inspector-row';
    const fontLabel = document.createElement('label');
    fontLabel.textContent = 'Família da Fonte:';
    fontRow.appendChild(fontLabel);

    const fontSelect = document.createElement('select');
    fontSelect.className = 'inspector-select';
    const fontOptions = [
      { val: 'Inter, sans-serif', label: 'Inter (Moderna)' },
      { val: "'JetBrains Mono', monospace", label: 'JetBrains Mono (Código)' },
      { val: "'Outfit', sans-serif", label: 'Outfit (Geométrica)' },
      { val: "'Playfair Display', serif", label: 'Playfair (Elegante)' },
      { val: "'Caveat', cursive", label: 'Caveat (Manuscrita)' },
      { val: 'Georgia, serif', label: 'Georgia (Clássica)' },
    ];
    fontOptions.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.val;
      o.textContent = opt.label;
      if (node.fontFamily === opt.val) o.selected = true;
      fontSelect.appendChild(o);
    });
    fontSelect.addEventListener('change', () => {
      node.fontFamily = fontSelect.value;
      d.recomputeTextNodeDimensions(node);
      updateDimText();
      d._pushHistory();
    });
    fontRow.appendChild(fontSelect);
    wrap.appendChild(fontRow);

    // 3. Font Size Controls
    const sizeRow = document.createElement('div');
    sizeRow.className = 'inspector-row';
    const sizeLabel = document.createElement('label');
    const updateSizeLabel = () => {
      sizeLabel.innerHTML = `Tamanho da Letra: <span class="inspector-badge">${node.fontSize || 18}px</span>`;
    };
    updateSizeLabel();
    sizeRow.appendChild(sizeLabel);

    const sizeCtrls = document.createElement('div');
    sizeCtrls.className = 'size-btns';
    const btnMinus = document.createElement('button');
    btnMinus.className = 'size-btn';
    btnMinus.textContent = '− Menor';
    btnMinus.addEventListener('click', () => {
      node.fontSize = Math.max(10, (node.fontSize || 18) - 2);
      d.recomputeTextNodeDimensions(node);
      updateSizeLabel();
      updateDimText();
      d._pushHistory();
    });
    const btnPlus = document.createElement('button');
    btnPlus.className = 'size-btn';
    btnPlus.textContent = '+ Maior';
    btnPlus.addEventListener('click', () => {
      node.fontSize = Math.min(80, (node.fontSize || 18) + 2);
      d.recomputeTextNodeDimensions(node);
      updateSizeLabel();
      updateDimText();
      d._pushHistory();
    });
    sizeCtrls.appendChild(btnMinus);
    sizeCtrls.appendChild(btnPlus);
    sizeRow.appendChild(sizeCtrls);

    // Preset quick size chips
    const chipRow = document.createElement('div');
    chipRow.className = 'chips-row';
    [14, 18, 24, 32, 42].forEach(sz => {
      const chip = document.createElement('button');
      chip.className = 'chip' + ((node.fontSize || 18) === sz ? ' active' : '');
      chip.textContent = `${sz}px`;
      chip.addEventListener('click', () => {
        node.fontSize = sz;
        d.recomputeTextNodeDimensions(node);
        updateSizeLabel();
        updateDimText();
        chipRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        d._pushHistory();
      });
      chipRow.appendChild(chip);
    });
    sizeRow.appendChild(chipRow);
    wrap.appendChild(sizeRow);

    // 4. Text Color
    const textColorRow = document.createElement('div');
    textColorRow.className = 'inspector-row';
    const textColorLabel = document.createElement('label');
    textColorLabel.textContent = 'Cor da Letra:';
    textColorRow.appendChild(textColorLabel);

    const textColorPalette = document.createElement('div');
    textColorPalette.className = 'color-palette';
    const TEXT_COLORS = [
      { r: 255, g: 255, b: 255, a: 255, title: 'Branco' },
      { r: 15,  g: 23,  b: 42,  a: 255, title: 'Escuro / Preto' },
      { r: 148, g: 163, b: 184, a: 255, title: 'Cinza Claro' },
      { r: 96,  g: 165, b: 250, a: 255, title: 'Azul Céu' },
      { r: 52,  g: 211, b: 153, a: 255, title: 'Esmeralda' },
      { r: 251, g: 191, b: 36,  a: 255, title: 'Amarelo' },
      { r: 248, g: 113, b: 113, a: 255, title: 'Coral' },
      { r: 192, g: 132, b: 252, a: 255, title: 'Violeta' },
    ];
    TEXT_COLORS.forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'color-swatch';
      sw.style.background = colorToCss(c);
      sw.title = c.title;
      if (c.r === 255 && c.g === 255 && c.b === 255) sw.style.border = '1.5px solid #64748b';
      if (_colorMatch(c, node.textColor)) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        node.textColor = { ...c };
        textColorPalette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        d._pushHistory();
      });
      textColorPalette.appendChild(sw);
    });
    // Custom text color input
    const customTextColorInput = document.createElement('input');
    customTextColorInput.type = 'color';
    customTextColorInput.className = 'custom-color-input';
    customTextColorInput.title = 'Personalizar cor da letra';
    customTextColorInput.value = colorToHex(node.textColor || { r: 255, g: 255, b: 255, a: 255 });
    customTextColorInput.addEventListener('input', () => {
      const hex = customTextColorInput.value;
      const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
      node.textColor = { r, g, b, a: 255 };
      textColorPalette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      d._pushHistory();
    });
    textColorPalette.appendChild(customTextColorInput);
    textColorRow.appendChild(textColorPalette);
    wrap.appendChild(textColorRow);

    // 5. Background Fill Color
    const bgRow = document.createElement('div');
    bgRow.className = 'inspector-row';
    const bgLabel = document.createElement('label');
    bgLabel.textContent = 'Cor de Fundo:';
    bgRow.appendChild(bgLabel);

    const bgPalette = document.createElement('div');
    bgPalette.className = 'color-palette';

    // Transparent button
    const transBtn = document.createElement('button');
    transBtn.className = 'color-swatch-trans' + (node.fillColor && node.fillColor.a === 0 ? ' selected' : '');
    transBtn.innerHTML = '🚫';
    transBtn.title = 'Sem Fundo (Transparente)';
    transBtn.addEventListener('click', () => {
      node.fillColor = { r: 0, g: 0, b: 0, a: 0 };
      bgPalette.querySelectorAll('.color-swatch, .color-swatch-trans').forEach(s => s.classList.remove('selected'));
      transBtn.classList.add('selected');
      d._pushHistory();
    });
    bgPalette.appendChild(transBtn);

    const BG_COLORS = [
      { r: 30,  g: 41,  b: 59,  a: 220, title: 'Grafite Escuro' },
      { r: 15,  g: 23,  b: 42,  a: 255, title: 'Preto Profundo' },
      { r: 255, g: 255, b: 255, a: 255, title: 'Branco' },
      { r: 254, g: 240, b: 138, a: 255, title: 'Amarelo Post-it' },
      { r: 37,  g: 99,  b: 235, a: 255, title: 'Azul Real' },
      { r: 16,  g: 185, b: 129, a: 255, title: 'Esmeralda' },
      { r: 139, g: 92,  b: 246, a: 255, title: 'Violeta' },
      { r: 244, g: 63,  b: 94,  a: 255, title: 'Rosa Coral' },
    ];
    BG_COLORS.forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'color-swatch';
      sw.style.background = colorToCss(c);
      sw.title = c.title;
      if (c.r === 255 && c.g === 255 && c.b === 255) sw.style.border = '1.5px solid #64748b';
      if (node.fillColor && node.fillColor.a > 0 && _colorMatch(c, node.fillColor)) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        node.fillColor = { ...c };
        bgPalette.querySelectorAll('.color-swatch, .color-swatch-trans').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        d._pushHistory();
      });
      bgPalette.appendChild(sw);
    });

    const customBgInput = document.createElement('input');
    customBgInput.type = 'color';
    customBgInput.className = 'custom-color-input';
    customBgInput.title = 'Personalizar cor de fundo';
    customBgInput.value = colorToHex(node.fillColor && node.fillColor.a > 0 ? node.fillColor : { r: 30, g: 41, b: 59, a: 255 });
    customBgInput.addEventListener('input', () => {
      const hex = customBgInput.value;
      const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
      node.fillColor = { r, g, b, a: 230 };
      bgPalette.querySelectorAll('.color-swatch, .color-swatch-trans').forEach(s => s.classList.remove('selected'));
      d._pushHistory();
    });
    bgPalette.appendChild(customBgInput);
    bgRow.appendChild(bgPalette);
    wrap.appendChild(bgRow);

    // 6. Border Controls
    const borderRow = document.createElement('div');
    borderRow.className = 'inspector-row';
    const borderLabel = document.createElement('label');
    borderLabel.textContent = 'Borda:';
    borderRow.appendChild(borderLabel);

    const borderBtns = document.createElement('div');
    borderBtns.className = 'chips-row';
    [
      { label: 'Sem Borda', bw: 0 },
      { label: 'Fina', bw: 1.5 },
      { label: 'Média', bw: 3 },
    ].forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (node.borderWidth === b.bw ? ' active' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        node.borderWidth = b.bw;
        borderBtns.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        d._pushHistory();
      });
      borderBtns.appendChild(btn);
    });
    borderRow.appendChild(borderBtns);
    wrap.appendChild(borderRow);

    // 7. Dimensions & Auto-fit Status
    const dimRow = document.createElement('div');
    dimRow.className = 'inspector-row';
    dimLabel = document.createElement('label');
    updateDimText();
    dimRow.appendChild(dimLabel);

    const autoFitBtn = document.createElement('button');
    autoFitBtn.className = 'inspector-btn';
    autoFitBtn.innerHTML = '✨ Recalcular Auto-fit';
    autoFitBtn.style.marginTop = '4px';
    autoFitBtn.addEventListener('click', () => {
      d.recomputeTextNodeDimensions(node);
      updateDimText();
      d._pushHistory();
      d.setToast('Tamanho ajustado ao texto! ✨');
    });
    dimRow.appendChild(autoFitBtn);
    wrap.appendChild(dimRow);

    // Divider
    const div1 = document.createElement('div');
    div1.className = 'inspector-divider';
    wrap.appendChild(div1);

    // Duplicate
    const dupBtn = document.createElement('button');
    dupBtn.className = 'inspector-btn';
    dupBtn.textContent = 'Duplicar Bloco (Ctrl+D)';
    dupBtn.style.marginBottom = '8px';
    dupBtn.addEventListener('click', () => d.duplicateSelectedNode());
    wrap.appendChild(dupBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'inspector-danger';
    delBtn.textContent = 'Excluir Bloco (Del)';
    delBtn.addEventListener('click', () => d.removeNode(node.id));
    wrap.appendChild(delBtn);

    return wrap;
  }

  _buildConnInspector(conn) {
    const d = this.diagram;
    const wrap = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'inspector-title';
    title.textContent = 'PROPRIEDADES DA CONEXÃO';
    wrap.appendChild(title);

    // Label
    const labelRow = document.createElement('div');
    labelRow.className = 'inspector-row';
    const labelLabel = document.createElement('label');
    labelLabel.textContent = 'Rótulo / Texto:';
    const labelBtn = document.createElement('button');
    labelBtn.className = 'inspector-btn';
    labelBtn.textContent = conn.label || '[Definir Rótulo]';
    labelBtn.addEventListener('click', () => this.app.startEditing(conn.id, false));
    labelRow.appendChild(labelLabel);
    labelRow.appendChild(labelBtn);
    wrap.appendChild(labelRow);

    // Chips
    const chipRow = document.createElement('div');
    chipRow.className = 'inspector-row';
    const chipLabel = document.createElement('label');
    chipLabel.textContent = 'Rótulos Rápidos:';
    chipRow.appendChild(chipLabel);
    const chips = document.createElement('div');
    chips.className = 'chips';
    ['Sim', 'Não', 'OK', 'Erro'].forEach(text => {
      const ch = document.createElement('button');
      ch.className = 'chip';
      ch.textContent = text;
      ch.addEventListener('click', () => {
        conn.label = text;
        labelBtn.textContent = text;
        d._pushHistory();
      });
      chips.appendChild(ch);
    });
    chipRow.appendChild(chips);
    wrap.appendChild(chipRow);

    // Color
    const colorRow = document.createElement('div');
    colorRow.className = 'inspector-row';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Cor da Seta:';
    colorRow.appendChild(colorLabel);
    const palette = document.createElement('div');
    palette.className = 'color-palette';
    PALETTE.forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'color-swatch';
      sw.style.background = colorToCss(c);
      if (_colorMatch(c, conn.color)) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        conn.color = { ...c, a: 255 };
        palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        d._pushHistory();
      });
      palette.appendChild(sw);
    });
    colorRow.appendChild(palette);
    wrap.appendChild(colorRow);

    // Divider
    const div1 = document.createElement('div');
    div1.className = 'inspector-divider';
    wrap.appendChild(div1);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'inspector-danger';
    delBtn.textContent = 'Excluir Conexão (Del)';
    delBtn.addEventListener('click', () => d.removeConnection(conn.id));
    wrap.appendChild(delBtn);

    return wrap;
  }

  _buildSummary() {
    const d = this.diagram;
    const wrap = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'inspector-title';
    title.textContent = 'RESUMO DO DIAGRAMA';
    wrap.appendChild(title);

    const stat1 = document.createElement('div');
    stat1.className = 'summary-stat';
    stat1.textContent = `Total de Blocos: ${d.nodes.length}`;
    wrap.appendChild(stat1);

    const stat2 = document.createElement('div');
    stat2.className = 'summary-stat';
    stat2.textContent = `Total de Conexões: ${d.connections.length}`;
    wrap.appendChild(stat2);

    const div1 = document.createElement('div');
    div1.className = 'inspector-divider';
    wrap.appendChild(div1);

    // Canvas settings
    const configTitle = document.createElement('div');
    configTitle.className = 'inspector-title';
    configTitle.textContent = 'MODO DO EDITOR';
    wrap.appendChild(configTitle);

    const bgRow = document.createElement('div');
    bgRow.className = 'inspector-row';
    const bgLabel = document.createElement('label');
    bgLabel.textContent = 'Tema Visual:';
    
    const bgBtnGroup = document.createElement('div');
    bgBtnGroup.className = 'bg-theme-group';
    bgBtnGroup.style.display = 'flex';
    bgBtnGroup.style.gap = '6px';
    bgBtnGroup.style.marginTop = '6px';

    const isWhite = d.backgroundColor === 'white';
    const darkBtn = document.createElement('button');
    darkBtn.className = 'inspector-btn' + (!isWhite ? ' active' : '');
    darkBtn.innerHTML = '🌙 Modo Escuro';
    darkBtn.style.flex = '1';
    darkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      d.setBackgroundColor('dark');
      this.updateInspector();
    });

    const whiteBtn = document.createElement('button');
    whiteBtn.className = 'inspector-btn' + (isWhite ? ' active' : '');
    whiteBtn.innerHTML = '☀️ Modo Claro';
    whiteBtn.style.flex = '1';
    whiteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      d.setBackgroundColor('white');
      this.updateInspector();
    });

    bgBtnGroup.appendChild(darkBtn);
    bgBtnGroup.appendChild(whiteBtn);
    bgRow.appendChild(bgLabel);
    bgRow.appendChild(bgBtnGroup);
    wrap.appendChild(bgRow);

    const div2 = document.createElement('div');
    div2.className = 'inspector-divider';
    wrap.appendChild(div2);

    const how = document.createElement('div');
    how.className = 'inspector-title';
    how.textContent = 'COMO USAR:';
    wrap.appendChild(how);

    const tips = [
      '• Clique em uma forma na barra esquerda para adicionar ao centro.',
      '• Clique e arraste um bloco para reposicionar.',
      '• Clique duplo para editar o texto de qualquer elemento.',
      '• Arraste os pontos azuis nas bordas para ligar setas!',
      '• Use o botão direito ou Espaço para mover a tela.',
      '• Scroll do mouse para Zoom in / Zoom out.',
    ];
    tips.forEach(t => {
      const p = document.createElement('div');
      p.className = 'tip';
      p.textContent = t;
      wrap.appendChild(p);
    });

    return wrap;
  }

  _updateColorSwatches(fillColor) {
    const palette = document.getElementById('node-palette');
    if (!palette) return;
    palette.querySelectorAll('.color-swatch').forEach((sw, i) => {
      sw.classList.toggle('selected', _colorMatch(PALETTE[i], fillColor));
    });
  }
}

function _colorMatch(a, b) {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

/**
 * ui.js — Inspector panel & toolbar reactive UI
 */

const PALETTE = [
  { r: 37,  g: 99,  b: 235, a: 230 }, // Blue
  { r: 16,  g: 185, b: 129, a: 230 }, // Emerald
  { r: 217, g: 119, b: 6,   a: 230 }, // Amber
  { r: 225, g: 29,  b: 72,  a: 230 }, // Rose
  { r: 124, g: 58,  b: 237, a: 230 }, // Purple
  { r: 13,  g: 148, b: 136, a: 230 }, // Teal
  { r: 202, g: 138, b: 4,   a: 230 }, // Yellow
  { r: 71,  g: 85,  b: 105, a: 230 }, // Slate
];

const SHAPE_NAMES = {
  [ShapeType.PROCESS]:    'Processo',
  [ShapeType.DECISION]:   'Decisão',
  [ShapeType.TERMINATOR]: 'Início/Fim',
  [ShapeType.DATA]:       'Entrada/Saída',
  [ShapeType.DATABASE]:   'Banco Dados',
  [ShapeType.SUBPROCESS]: 'Subprocesso',
  [ShapeType.DOCUMENT]:   'Documento',
  [ShapeType.NOTE]:       'Nota',
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
  }

  updateStatusBar(camera, fps) {
    const mx = this.app.lastMouseWorld.x, my = this.app.lastMouseWorld.y;
    this._coordsEl.textContent = `X: ${mx.toFixed(0)}  Y: ${my.toFixed(0)}`;
    this._zoomBtn.textContent  = `${Math.round(camera.zoom * 100)}%`;
    this._rightEl.textContent  = `Zoom: ${Math.round(camera.zoom * 100)}%  |  Snap: ${this.diagram.snapToGrid ? 'ON' : 'OFF'}  |  FPS: ${fps}`;
    this._gridBtn.classList.toggle('active', this.diagram.showGrid);
    this._snapBtn.classList.toggle('active', this.diagram.snapToGrid);
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
    this._lastSelectedNode = node || null;
    this._lastSelectedConn = conn || null;

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
      if (_colorMatch(c, node.fillColor)) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        node.fillColor   = { ...c };
        node.borderColor = {
          r: Math.min(255, Math.round(c.r * 1.3)),
          g: Math.min(255, Math.round(c.g * 1.3)),
          b: Math.min(255, Math.round(c.b * 1.3)),
          a: 255,
        };
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

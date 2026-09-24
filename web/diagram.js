/**
 * diagram.js — Data model, mirroring diagram.h / diagram.c
 */

const MAX_NODES       = 256;
const MAX_CONNECTIONS = 512;
const MAX_HISTORY     = 32;

const ShapeType = {
  PROCESS:    'process',
  DECISION:   'decision',
  TERMINATOR: 'terminator',
  DATA:       'data',
  DATABASE:   'database',
  SUBPROCESS: 'subprocess',
  DOCUMENT:   'document',
  NOTE:       'note',
};

const PortIndex = { TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3, AUTO: 4 };

const LINE_BEZIER = 'bezier';

// Default colors per shape (RGBA)
function defaultFillColor(type) {
  switch (type) {
    case ShapeType.TERMINATOR: return { r: 16,  g: 185, b: 129, a: 230 };
    case ShapeType.PROCESS:    return { r: 37,  g: 99,  b: 235, a: 230 };
    case ShapeType.DECISION:   return { r: 217, g: 119, b: 6,   a: 230 };
    case ShapeType.DATA:       return { r: 13,  g: 148, b: 136, a: 230 };
    case ShapeType.DATABASE:   return { r: 124, g: 58,  b: 237, a: 230 };
    case ShapeType.SUBPROCESS: return { r: 79,  g: 70,  b: 229, a: 230 };
    case ShapeType.DOCUMENT:   return { r: 2,   g: 132, b: 199, a: 230 };
    case ShapeType.NOTE:       return { r: 202, g: 138, b: 4,   a: 230 };
    default:                   return { r: 71,  g: 85,  b: 105, a: 230 };
  }
}

function defaultBorderColor(type) {
  switch (type) {
    case ShapeType.TERMINATOR: return { r: 110, g: 231, b: 183, a: 255 };
    case ShapeType.PROCESS:    return { r: 147, g: 197, b: 253, a: 255 };
    case ShapeType.DECISION:   return { r: 252, g: 211, b: 77,  a: 255 };
    case ShapeType.DATA:       return { r: 94,  g: 234, b: 212, a: 255 };
    case ShapeType.DATABASE:   return { r: 196, g: 181, b: 253, a: 255 };
    case ShapeType.SUBPROCESS: return { r: 165, g: 180, b: 252, a: 255 };
    case ShapeType.DOCUMENT:   return { r: 125, g: 211, b: 252, a: 255 };
    case ShapeType.NOTE:       return { r: 253, g: 224, b: 71,  a: 255 };
    default:                   return { r: 203, g: 213, b: 225, a: 255 };
  }
}

function colorToCss(c) {
  return `rgba(${c.r},${c.g},${c.b},${c.a/255})`;
}

function colorToHex(c) {
  return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// ---- Diagram data class ----
class Diagram {
  constructor() {
    this.nodes = [];
    this.connections = [];
    this.nextNodeId = 1;
    this.nextConnId = 1;

    // Selection / hover
    this.selectedNodeId = -1;
    this.selectedConnId = -1;
    this.hoveredNodeId  = -1;
    this.hoveredConnId  = -1;
    this.hoveredPortNodeId = -1;
    this.hoveredPortIndex  = -1;

    // Drag
    this.dragState = 'none'; // 'none' | 'move' | 'connect' | 'pan' | 'box'
    this.dragStartPos = { x: 0, y: 0 };
    this.dragCurrentPos = { x: 0, y: 0 };
    this.initialNodeBounds = null;

    // Connection in progress
    this.connectStartNodeId = -1;
    this.connectStartPort   = PortIndex.RIGHT;
    this.connectTargetPos   = { x: 0, y: 0 };

    // Text editing
    this.isEditingText    = false;
    this.editingNode      = true;
    this.editingTargetId  = -1;
    this.editTextBuffer   = '';

    // Canvas settings
    this.snapToGrid = true;
    this.gridSize   = 20;
    this.showGrid   = true;

    // Toast
    this.toastMessage = '';
    this.toastTimer   = 0;

    // History
    this._history      = [];
    this._historyIndex = -1;

    this._pushHistory();
  }

  // ---- Node operations ----
  addNode(type, x, y, w, h, text) {
    if (this.nodes.length >= MAX_NODES) {
      this.setToast('Limite máximo de blocos atingido');
      return null;
    }
    if (this.snapToGrid && this.gridSize > 0) {
      x = Math.round(x / this.gridSize) * this.gridSize;
      y = Math.round(y / this.gridSize) * this.gridSize;
    }
    const n = {
      id: this.nextNodeId++,
      type,
      x, y, w, h,
      text: text || 'Bloco ' + this.nextNodeId,
      fillColor:   defaultFillColor(type),
      borderColor: defaultBorderColor(type),
      textColor:   { r: 255, g: 255, b: 255, a: 255 },
      borderWidth: 2,
      selected: false,
    };
    this.nodes.push(n);
    this.selectedNodeId = n.id;
    this.selectedConnId = -1;
    this._pushHistory();
    return n;
  }

  getNode(id) { return this.nodes.find(n => n.id === id) || null; }

  removeNode(id) {
    const idx = this.nodes.findIndex(n => n.id === id);
    if (idx === -1) return false;
    this.nodes.splice(idx, 1);
    this.connections = this.connections.filter(c => c.fromNodeId !== id && c.toNodeId !== id);
    if (this.selectedNodeId === id) this.selectedNodeId = -1;
    if (this.hoveredNodeId === id) this.hoveredNodeId = -1;
    if (this.isEditingText && this.editingTargetId === id) this.isEditingText = false;
    this._pushHistory();
    this.setToast('Bloco excluído');
    return true;
  }

  duplicateSelectedNode() {
    const orig = this.getNode(this.selectedNodeId);
    if (!orig) return;
    const dup = this.addNode(orig.type, orig.x + 30, orig.y + 30, orig.w, orig.h, orig.text);
    if (dup) {
      dup.fillColor   = { ...orig.fillColor };
      dup.borderColor = { ...orig.borderColor };
      dup.textColor   = { ...orig.textColor };
      this.selectedNodeId = dup.id;
      this.setToast('Bloco duplicado');
    }
  }

  // ---- Connection operations ----
  addConnection(fromId, toId, fromPort, toPort, label) {
    if (this.connections.length >= MAX_CONNECTIONS) {
      this.setToast('Limite máximo de conexões atingido');
      return null;
    }
    if (fromId === toId) return null;
    const existing = this.connections.find(c => c.fromNodeId === fromId && c.toNodeId === toId);
    if (existing) return existing;

    const c = {
      id: this.nextConnId++,
      fromNodeId: fromId,
      toNodeId:   toId,
      fromPort:   fromPort,
      toPort:     toPort,
      label:      label || '',
      color:      { r: 148, g: 163, b: 184, a: 255 },
      style:      LINE_BEZIER,
      selected:   false,
    };
    this.connections.push(c);
    this.selectedConnId = c.id;
    this.selectedNodeId = -1;
    this._pushHistory();
    this.setToast('Conexão criada');
    return c;
  }

  getConnection(id) { return this.connections.find(c => c.id === id) || null; }

  removeConnection(id) {
    const idx = this.connections.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.connections.splice(idx, 1);
    if (this.selectedConnId === id) this.selectedConnId = -1;
    if (this.hoveredConnId === id) this.hoveredConnId = -1;
    this._pushHistory();
    this.setToast('Conexão removida');
    return true;
  }

  // ---- Port positions ----
  getPortPosition(node, port) {
    switch (port) {
      case PortIndex.TOP:    return { x: node.x + node.w * 0.5, y: node.y };
      case PortIndex.RIGHT:  return { x: node.x + node.w, y: node.y + node.h * 0.5 };
      case PortIndex.BOTTOM: return { x: node.x + node.w * 0.5, y: node.y + node.h };
      case PortIndex.LEFT:   return { x: node.x, y: node.y + node.h * 0.5 };
      default:               return { x: node.x + node.w * 0.5, y: node.y + node.h * 0.5 };
    }
  }

  getClosestPort(from, to) {
    const fc = { x: from.x + from.w * 0.5, y: from.y + from.h * 0.5 };
    const tc = { x: to.x   + to.w   * 0.5, y: to.y   + to.h   * 0.5 };
    const dx = tc.x - fc.x, dy = tc.y - fc.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? PortIndex.RIGHT : PortIndex.LEFT;
    return dy > 0 ? PortIndex.BOTTOM : PortIndex.TOP;
  }

  // ---- Hit testing ----
  findNodeAt(wx, wy) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (n.type === ShapeType.DECISION) {
        if (_pointInDiamond(wx, wy, n)) return n.id;
      } else if (n.type === ShapeType.TERMINATOR) {
        if (_pointInEllipse(wx, wy, n)) return n.id;
      } else {
        if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h) return n.id;
      }
    }
    return -1;
  }

  findPortAt(wx, wy) {
    const RADIUS = 10;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      for (let p = 0; p < 4; p++) {
        const pos = this.getPortPosition(n, p);
        const dx = wx - pos.x, dy = wy - pos.y;
        if (dx*dx + dy*dy <= RADIUS*RADIUS) return { nodeId: n.id, portIndex: p };
      }
    }
    return null;
  }

  findConnectionAt(wx, wy, threshold = 8) {
    for (const c of this.connections) {
      const from = this.getNode(c.fromNodeId);
      const to   = this.getNode(c.toNodeId);
      if (!from || !to) continue;
      const fp = c.fromPort === PortIndex.AUTO ? this.getClosestPort(from, to) : c.fromPort;
      const tp = c.toPort   === PortIndex.AUTO ? this.getClosestPort(to, from) : c.toPort;
      const p1 = this.getPortPosition(from, fp);
      const p2 = this.getPortPosition(to,   tp);
      const [cp1, cp2] = bezierControlPoints(p1, p2, fp, tp);
      const SAMPLES = 24;
      let prev = p1;
      for (let s = 1; s <= SAMPLES; s++) {
        const t = s / SAMPLES;
        const curr = bezierPoint(p1, cp1, cp2, p2, t);
        if (distPointSegment({ x: wx, y: wy }, prev, curr) <= threshold) return c.id;
        prev = curr;
      }
    }
    return -1;
  }

  getBoundingBox(padding = 60) {
    if (this.nodes.length === 0) return { x: 0, y: 0, w: 800, h: 600 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    return { x: minX - padding, y: minY - padding, w: maxX - minX + padding * 2, h: maxY - minY + padding * 2 };
  }

  clear() {
    this.nodes = [];
    this.connections = [];
    this.selectedNodeId = -1;
    this.selectedConnId = -1;
    this.hoveredNodeId  = -1;
    this.hoveredConnId  = -1;
    this.isEditingText  = false;
    this._pushHistory();
    this.setToast('Novo diagrama criado');
  }

  // ---- Toast ----
  setToast(msg) {
    this.toastMessage = msg;
    this.toastTimer   = 2.5;
  }

  updateToast(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer < 0) this.toastTimer = 0;
    }
  }

  // ---- History ----
  _pushHistory() {
    // Truncate redo future
    if (this._historyIndex < this._history.length - 1) {
      this._history.splice(this._historyIndex + 1);
    }
    // Cap at MAX_HISTORY
    if (this._history.length >= MAX_HISTORY) {
      this._history.shift();
      this._historyIndex = this._history.length - 1;
    }
    const snap = {
      nodes:       JSON.parse(JSON.stringify(this.nodes)),
      connections: JSON.parse(JSON.stringify(this.connections)),
      nextNodeId:  this.nextNodeId,
      nextConnId:  this.nextConnId,
    };
    this._history.push(snap);
    this._historyIndex = this._history.length - 1;
  }

  undo() {
    if (this._historyIndex > 0) {
      this._historyIndex--;
      this._applySnap(this._history[this._historyIndex]);
      this.setToast('Desfazer (Undo)');
      return true;
    }
    return false;
  }

  redo() {
    if (this._historyIndex < this._history.length - 1) {
      this._historyIndex++;
      this._applySnap(this._history[this._historyIndex]);
      this.setToast('Refazer (Redo)');
      return true;
    }
    return false;
  }

  _applySnap(snap) {
    this.nodes       = JSON.parse(JSON.stringify(snap.nodes));
    this.connections = JSON.parse(JSON.stringify(snap.connections));
    this.nextNodeId  = snap.nextNodeId;
    this.nextConnId  = snap.nextConnId;
    this.selectedNodeId = -1;
    this.selectedConnId = -1;
    this.isEditingText  = false;
  }
}

// ---- Geometry helpers ----
function _pointInDiamond(px, py, n) {
  const cx = n.x + n.w * 0.5, cy = n.y + n.h * 0.5;
  return Math.abs(px - cx) / (n.w * 0.5) + Math.abs(py - cy) / (n.h * 0.5) <= 1;
}

function _pointInEllipse(px, py, n) {
  const cx = n.x + n.w * 0.5, cy = n.y + n.h * 0.5;
  const rx = n.w * 0.5, ry = n.h * 0.5;
  if (rx <= 0 || ry <= 0) return false;
  return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
}

function portNormal(port) {
  switch (port) {
    case PortIndex.TOP:    return { x: 0,  y: -1 };
    case PortIndex.RIGHT:  return { x: 1,  y: 0  };
    case PortIndex.BOTTOM: return { x: 0,  y: 1  };
    case PortIndex.LEFT:   return { x: -1, y: 0  };
    default:               return { x: 1,  y: 0  };
  }
}

function bezierControlPoints(p1, p2, fp, tp) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const hd = Math.max(dist * 0.45, 45);
  const n1 = portNormal(fp), n2 = portNormal(tp);
  return [
    { x: p1.x + n1.x * hd, y: p1.y + n1.y * hd },
    { x: p2.x + n2.x * hd, y: p2.y + n2.y * hd },
  ];
}

function bezierPoint(p0, p1, p2, p3, t) {
  const it = 1 - t;
  return {
    x: it**3*p0.x + 3*it**2*t*p1.x + 3*it*t**2*p2.x + t**3*p3.x,
    y: it**3*p0.y + 3*it**2*t*p1.y + 3*it*t**2*p2.y + t**3*p3.y,
  };
}

function distPointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx*dx + dy*dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy));
}

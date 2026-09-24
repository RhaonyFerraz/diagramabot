/**
 * renderer.js — Canvas 2D renderer, mirroring renderer.c
 */

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
  }

  resize(w, h) {
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  // ── GRID ──
  drawGrid(camera, gridSize, w, h) {
    const ctx = this.ctx;
    if (gridSize <= 4) gridSize = 20;

    let effGrid = gridSize;
    while (effGrid * camera.zoom < 14) effGrid *= 2;

    const tl = screenToWorld(0, 0, camera);
    const br = screenToWorld(w, h, camera);

    const startX = Math.floor(tl.x / effGrid) * effGrid;
    const startY = Math.floor(tl.y / effGrid) * effGrid;
    const endX   = Math.ceil(br.x  / effGrid) * effGrid;
    const endY   = Math.ceil(br.y  / effGrid) * effGrid;

    const dotR = camera.zoom < 0.8 ? 0.9 : 1.3;
    ctx.fillStyle = 'rgba(71,85,105,0.35)';
    for (let x = startX; x <= endX; x += effGrid) {
      for (let y = startY; y <= endY; y += effGrid) {
        const sx = x * camera.zoom + camera.ox;
        const sy = y * camera.zoom + camera.oy;
        ctx.beginPath();
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── ARROW HEAD ──
  drawArrowHead(tip, dir, size, color) {
    const ctx = this.ctx;
    const len = Math.hypot(dir.x, dir.y);
    if (len < 0.0001) return;
    const nx = dir.x / len, ny = dir.y / len;
    const ox = -ny, oy = nx;
    const p1 = { x: tip.x - nx * size + ox * size * 0.5, y: tip.y - ny * size + oy * size * 0.5 };
    const p2 = { x: tip.x - nx * size - ox * size * 0.5, y: tip.y - ny * size - oy * size * 0.5 };
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ── NODE ──
  drawNode(n, isSelected, isHovered, showPorts, hoveredPort, diagram) {
    const ctx  = this.ctx;
    const { x, y, w, h } = n;

    // Shadow
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur    = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    let borderColor = colorToCss(n.borderColor);
    let bw = n.borderWidth;

    if (isSelected) {
      // Selection halo
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(59,130,246,0.4)';
      ctx.lineWidth   = 3;
      this._strokeShape(n, 4);
      ctx.stroke();

      borderColor = '#60a5fa';
      bw = 3;
    } else if (isHovered) {
      borderColor = '#ffffff';
      bw = 2;
    }

    ctx.restore();

    // Shape fill
    ctx.save();
    ctx.fillStyle   = colorToCss(n.fillColor);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth   = bw;

    this._fillShape(n);
    ctx.fill();
    this._strokeShape(n, 0);
    ctx.stroke();

    // Extra details for specific shapes
    if (n.type === ShapeType.SUBPROCESS) {
      const inset = 16;
      ctx.beginPath();
      ctx.moveTo(x + inset, y);
      ctx.lineTo(x + inset, y + h);
      ctx.moveTo(x + w - inset, y);
      ctx.lineTo(x + w - inset, y + h);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (n.type === ShapeType.DATABASE) {
      const eh = h * 0.22;
      const cx2 = x + w * 0.5;
      // Top ellipse highlight
      const lighter = lighten(n.fillColor, 0.15);
      ctx.fillStyle = colorToCss(lighter);
      ctx.beginPath();
      ctx.ellipse(cx2, y + eh * 0.5, w * 0.5, eh * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = bw;
      ctx.stroke();
    }

    ctx.restore();

    // Text
    this.drawWrappedText(n.text, x, y, w, h, 16, colorToCss(n.textColor));

    // Ports
    if (showPorts || isHovered || isSelected) {
      this._drawPorts(n, hoveredPort, diagram);
    }

    // Resize handles when selected
    if (isSelected) {
      this._drawResizeHandles(n);
    }
  }

  _fillShape(n) {
    const ctx = this.ctx;
    const { x, y, w, h } = n;
    ctx.beginPath();
    switch (n.type) {
      case ShapeType.PROCESS:
        roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.10);
        break;
      case ShapeType.TERMINATOR:
        roundRect(ctx, x, y, w, h, h * 0.5);
        break;
      case ShapeType.SUBPROCESS:
        roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.08);
        break;
      case ShapeType.DECISION: {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        ctx.moveTo(cx, y);
        ctx.lineTo(x + w, cy);
        ctx.lineTo(cx, y + h);
        ctx.lineTo(x, cy);
        ctx.closePath();
        break;
      }
      case ShapeType.DATA: {
        const sl = w * 0.18;
        ctx.moveTo(x + sl, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w - sl, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      }
      case ShapeType.DATABASE: {
        const eh = h * 0.22;
        ctx.rect(x, y + eh * 0.5, w, h - eh);
        ctx.closePath();
        // bottom ellipse
        ctx.beginPath();
        ctx.ellipse(x + w * 0.5, y + h - eh * 0.5, w * 0.5, eh * 0.5, 0, 0, Math.PI * 2);
        break;
      }
      case ShapeType.NOTE: {
        const fold = Math.min(20, w * 0.13, h * 0.13);
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - fold);
        ctx.lineTo(x + w - fold, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      }
      default:
        roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.10);
    }
  }

  _strokeShape(n, expand) {
    const ctx = this.ctx;
    const x = n.x - expand, y = n.y - expand, w = n.w + expand * 2, h = n.h + expand * 2;
    const nn = { ...n, x, y, w, h };
    ctx.beginPath();
    switch (n.type) {
      case ShapeType.PROCESS:
        roundRect(ctx, x, y, w, h, Math.min(n.w, n.h) * 0.10 + expand * 0.2);
        break;
      case ShapeType.TERMINATOR:
        roundRect(ctx, x, y, w, h, h * 0.5);
        break;
      case ShapeType.SUBPROCESS:
        roundRect(ctx, x, y, w, h, Math.min(n.w, n.h) * 0.08 + expand * 0.1);
        break;
      case ShapeType.DECISION: {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        ctx.moveTo(cx, y);
        ctx.lineTo(x + w, cy);
        ctx.lineTo(cx, y + h);
        ctx.lineTo(x, cy);
        ctx.closePath();
        break;
      }
      case ShapeType.DATA: {
        const sl = n.w * 0.18;
        ctx.moveTo(x + sl, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w - sl, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      }
      case ShapeType.DATABASE: {
        const eh = n.h * 0.22;
        ctx.moveTo(x, y + eh * 0.5);
        ctx.lineTo(x, y + n.h - eh * 0.5);
        ctx.arc(x + w * 0.5, y + n.h - eh * 0.5, w * 0.5, 0, Math.PI);
        ctx.lineTo(x + w, y + eh * 0.5);
        ctx.ellipse(x + w * 0.5, y + eh * 0.5, w * 0.5, eh * 0.5, 0, 0, Math.PI * 2);
        break;
      }
      case ShapeType.NOTE: {
        const fold = Math.min(20, n.w * 0.13, n.h * 0.13);
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + n.h - fold);
        ctx.lineTo(x + w - fold, y + n.h);
        ctx.lineTo(x, y + n.h);
        ctx.closePath();
        break;
      }
      default:
        roundRect(ctx, x, y, w, h, Math.min(n.w, n.h) * 0.10);
    }
  }

  _drawPorts(node, hoveredPort, diagram) {
    const ctx = this.ctx;
    for (let p = 0; p < 4; p++) {
      const pos = diagram.getPortPosition(node, p);
      const isHov = p === hoveredPort;
      if (isHov) {
        ctx.fillStyle = 'rgba(59,130,246,0.4)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(96,165,250,1)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(15,23,42,0.78)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(59,130,246,0.9)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      // White dot centre
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isHov ? 3 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawResizeHandles(n) {
    const ctx = this.ctx;
    const { x, y, w, h } = n;
    const HSIZE = 7;
    const handles = [
      { x, y }, { x: x + w * 0.5, y }, { x: x + w, y },
      { x: x + w, y: y + h * 0.5 },
      { x: x + w, y: y + h }, { x: x + w * 0.5, y: y + h },
      { x, y: y + h }, { x, y: y + h * 0.5 },
    ];
    handles.forEach(hp => {
      const hx = hp.x - HSIZE * 0.5, hy = hp.y - HSIZE * 0.5;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.fillRect(hx, hy, HSIZE, HSIZE);
      ctx.strokeRect(hx, hy, HSIZE, HSIZE);
    });
  }

  // ── TEXT ──
  drawWrappedText(text, x, y, w, h, fontSize, color) {
    if (!text) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle   = color;
    ctx.font        = `500 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    const maxW = w - 16;
    const words  = text.split(/\s+/);
    const lines  = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width <= maxW || !cur) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);

    const lineH = fontSize + 4;
    const totalH = lines.length * lineH;
    const startY = y + (h - totalH) * 0.5 + fontSize * 0.5;
    lines.forEach((line, i) => {
      ctx.fillText(line, x + w * 0.5, startY + i * lineH, maxW);
    });
    ctx.restore();
  }

  // ── CONNECTION ──
  drawConnection(c, from, to, isSelected, isHovered, diagram) {
    if (!from || !to) return;
    const ctx = this.ctx;

    const fp = c.fromPort === PortIndex.AUTO ? diagram.getClosestPort(from, to) : c.fromPort;
    const tp = c.toPort   === PortIndex.AUTO ? diagram.getClosestPort(to, from) : c.toPort;

    const p1 = diagram.getPortPosition(from, fp);
    const p2 = diagram.getPortPosition(to,   tp);
    const [cp1, cp2] = bezierControlPoints(p1, p2, fp, tp);

    let lineColor = colorToCss(c.color);
    let lineW = 2.5;

    if (isSelected) {
      // Halo
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
      ctx.strokeStyle = 'rgba(59,130,246,0.4)';
      ctx.lineWidth = 7;
      ctx.stroke();
      lineColor = '#60a5fa';
      lineW = 3.5;
    } else if (isHovered) {
      lineColor = '#fff';
      lineW = 3;
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineW;
    ctx.stroke();

    // Arrow
    const arrowDir = { x: p2.x - cp2.x, y: p2.y - cp2.y };
    this.drawArrowHead(p2, arrowDir, 14, lineColor);

    // Label badge
    if (c.label) {
      const mid = bezierPoint(p1, cp1, cp2, p2, 0.5);
      ctx.save();
      ctx.font = '500 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(c.label).width;
      const bx = mid.x - tw * 0.5 - 9, by = mid.y - 12, bw = tw + 18, bh = 24;
      roundRect(ctx, bx, by, bw, bh, 6);
      ctx.fillStyle   = 'rgba(24,24,27,0.94)';
      ctx.fill();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(c.label, mid.x, mid.y);
      ctx.restore();
    }
  }

  drawConnectionDraft(fromPos, toPos, fromPort, toPort) {
    const ctx = this.ctx;
    const p1 = fromPos, p2 = toPos;
    const [cp1, cp2] = bezierControlPoints(p1, p2, fromPort, toPort);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    ctx.strokeStyle = 'rgba(96,165,250,0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    this.drawArrowHead(p2, { x: p2.x - cp2.x, y: p2.y - cp2.y }, 14, 'rgba(96,165,250,0.85)');
  }

  drawSelectionBox(start, end) {
    const ctx = this.ctx;
    const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
    const w = Math.abs(start.x - end.x), h = Math.abs(start.y - end.y);
    ctx.fillStyle   = 'rgba(59,130,246,0.14)';
    ctx.strokeStyle = 'rgba(96,165,250,0.7)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  // ── FULL DIAGRAM ──
  drawDiagram(diagram, camera, w, h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(camera.ox, camera.oy);
    ctx.scale(camera.zoom, camera.zoom);

    // Connections first (behind nodes)
    for (const c of diagram.connections) {
      const from = diagram.getNode(c.fromNodeId);
      const to   = diagram.getNode(c.toNodeId);
      this.drawConnection(c, from, to,
        diagram.selectedConnId === c.id,
        diagram.hoveredConnId  === c.id,
        diagram);
    }

    // Connection draft
    if (diagram.dragState === 'connect' && diagram.connectStartNodeId !== -1) {
      const sn = diagram.getNode(diagram.connectStartNodeId);
      if (sn) {
        const p1 = diagram.getPortPosition(sn, diagram.connectStartPort);
        const ep  = diagram.connectTargetPos;
        let endPort = PortIndex.LEFT;
        if (diagram.hoveredPortNodeId !== -1 && diagram.hoveredPortIndex !== -1) {
          endPort = diagram.hoveredPortIndex;
        }
        this.drawConnectionDraft(p1, ep, diagram.connectStartPort, endPort);
      }
    }

    // Nodes
    for (const n of diagram.nodes) {
      const isSel = diagram.selectedNodeId === n.id;
      const isHov = diagram.hoveredNodeId  === n.id;
      const showPorts = (diagram.dragState === 'connect' || isHov || isSel);
      const hovP = (diagram.hoveredPortNodeId === n.id) ? diagram.hoveredPortIndex : -1;
      this.drawNode(n, isSel, isHov, showPorts, hovP, diagram);
    }

    // Box select
    if (diagram.dragState === 'box') {
      this.drawSelectionBox(diagram.dragStartPos, diagram.dragCurrentPos);
    }

    ctx.restore();
  }

  // ── EXPORT to offscreen canvas ──
  renderToOffscreen(diagram) {
    const bb = diagram.getBoundingBox(80);
    const W = Math.min(Math.max(Math.ceil(bb.w), 200), 4096);
    const H = Math.min(Math.max(Math.ceil(bb.h), 200), 4096);

    const oc  = document.createElement('canvas');
    oc.width  = W;
    oc.height = H;
    const octx = oc.getContext('2d');

    // Background
    octx.fillStyle = '#121316';
    octx.fillRect(0, 0, W, H);

    // Subtle grid
    octx.fillStyle = 'rgba(71,85,105,0.19)';
    for (let gx = 0; gx < W; gx += 20) {
      for (let gy = 0; gy < H; gy += 20) {
        octx.beginPath();
        octx.arc(gx, gy, 1, 0, Math.PI * 2);
        octx.fill();
      }
    }

    // Render into offscreen
    const offR = new Renderer(oc);
    const offDiag = {
      ...diagram,
      nodes:       diagram.nodes.map(n => ({ ...n, x: n.x - bb.x, y: n.y - bb.y })),
      connections: diagram.connections,
      getNode: (id) => {
        const on = offDiag.nodes.find(n => n.id === id);
        return on || null;
      },
      getPortPosition: diagram.getPortPosition.bind(diagram),
      getClosestPort:  diagram.getClosestPort.bind(diagram),
      selectedNodeId:  -1, selectedConnId: -1,
      hoveredNodeId:   -1, hoveredConnId:  -1,
      hoveredPortNodeId: -1, hoveredPortIndex: -1,
      dragState: 'none', connectStartNodeId: -1,
    };
    // Fix port positions to use the shifted nodes
    offDiag.getPortPosition = function(node, port) {
      return diagram.getPortPosition(node, port);
    };
    // We'll just draw manually:
    for (const c of offDiag.connections) {
      const from = offDiag.getNode(c.fromNodeId);
      const to   = offDiag.getNode(c.toNodeId);
      if (!from || !to) continue;
      // Build a mini diagram proxy
      const proxy = {
        getPortPosition: (n, p) => diagram.getPortPosition(n, p),
        getClosestPort:  (a, b) => diagram.getClosestPort(a, b),
      };
      offR.drawConnection(c, from, to, false, false, proxy);
    }
    for (const n of offDiag.nodes) {
      offR.drawNode(n, false, false, false, -1, { getPortPosition: () => ({x:0,y:0}) });
    }
    // Watermark
    octx.fillStyle = 'rgba(100,116,139,0.6)';
    octx.font = '500 16px Inter, sans-serif';
    octx.fillText('DiagramaBot', 18, H - 14);

    return oc;
  }
}

// ── Canvas 2D helpers ──
function roundRect(ctx, x, y, w, h, r) {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function screenToWorld(sx, sy, camera) {
  return {
    x: (sx - camera.ox) / camera.zoom,
    y: (sy - camera.oy) / camera.zoom,
  };
}

function worldToScreen(wx, wy, camera) {
  return {
    x: wx * camera.zoom + camera.ox,
    y: wy * camera.zoom + camera.oy,
  };
}

function lighten(c, amount) {
  return {
    r: Math.min(255, Math.round(c.r * (1 + amount))),
    g: Math.min(255, Math.round(c.g * (1 + amount))),
    b: Math.min(255, Math.round(c.b * (1 + amount))),
    a: c.a,
  };
}

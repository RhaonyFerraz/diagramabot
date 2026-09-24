/**
 * storage.js — Save/Load/Export, mirroring storage.c
 */

const Storage = {
  /** Save diagram to JSON and download as .diag file */
  saveDiagram(diagram) {
    const data = {
      version: 'DIAGRAMABOT_WEB_V1',
      config: {
        snapToGrid: diagram.snapToGrid,
        gridSize:   diagram.gridSize,
        showGrid:   diagram.showGrid,
      },
      nodes:       diagram.nodes.map(n => ({ ...n })),
      connections: diagram.connections.map(c => ({ ...c })),
      nextNodeId:  diagram.nextNodeId,
      nextConnId:  diagram.nextConnId,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'diagrama.diag';
    a.click();
    URL.revokeObjectURL(url);
    // Also save to localStorage as quick backup
    try { localStorage.setItem('diagramabot_last', json); } catch {}
    return true;
  },

  /** Load diagram from JSON text (returns true on success) */
  loadDiagramFromJSON(diagram, json) {
    try {
      const data = JSON.parse(json);
      if (!data.version || !data.version.startsWith('DIAGRAMABOT')) return false;
      diagram.nodes       = data.nodes || [];
      diagram.connections = data.connections || [];
      diagram.nextNodeId  = data.nextNodeId || 1;
      diagram.nextConnId  = data.nextConnId || 1;
      if (data.config) {
        diagram.snapToGrid = data.config.snapToGrid;
        diagram.gridSize   = data.config.gridSize;
        diagram.showGrid   = data.config.showGrid;
      }
      diagram.selectedNodeId = -1;
      diagram.selectedConnId = -1;
      diagram.isEditingText  = false;
      diagram._pushHistory();
      diagram.setToast('Diagrama carregado!');
      return true;
    } catch {
      return false;
    }
  },

  /** Export SVG — vector clean output */
  exportSVG(diagram) {
    if (diagram.nodes.length === 0) return false;
    const bb   = diagram.getBoundingBox(60);
    const W    = bb.w, H = bb.h;
    const offX = bb.x, offY = bb.y;

    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    svg    += `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}" height="${H.toFixed(1)}" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">\n`;

    // Defs
    svg += `  <defs>\n`;
    svg += `    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
    svg += `      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#94a3b8" />\n`;
    svg += `    </marker>\n`;
    svg += `  </defs>\n`;

    // Background
    svg += `  <rect width="100%" height="100%" fill="#121316" />\n`;

    // Connections
    for (const c of diagram.connections) {
      const from = diagram.getNode(c.fromNodeId);
      const to   = diagram.getNode(c.toNodeId);
      if (!from || !to) continue;
      const fp = c.fromPort === PortIndex.AUTO ? diagram.getClosestPort(from, to) : c.fromPort;
      const tp = c.toPort   === PortIndex.AUTO ? diagram.getClosestPort(to, from) : c.toPort;

      const shiftNode = (n) => ({ ...n, x: n.x - offX, y: n.y - offY });
      const sf = shiftNode(from), st = shiftNode(to);
      const p1 = _svgPortPos(sf, fp), p2 = _svgPortPos(st, tp);
      const [cp1, cp2] = bezierControlPoints(p1, p2, fp, tp);

      const stroke = colorToHex(c.color);
      svg += `  <path d="M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="2.5" marker-end="url(#arrow)" />\n`;

      if (c.label) {
        const mid = bezierPoint(p1, cp1, cp2, p2, 0.5);
        svg += `  <text x="${mid.x.toFixed(1)}" y="${mid.y.toFixed(1)}" fill="#ffffff" font-family="Inter, sans-serif" font-size="13" text-anchor="middle" dominant-baseline="central">${_escapeXML(c.label)}</text>\n`;
      }
    }

    // Nodes
    for (const n of diagram.nodes) {
      const x = n.x - offX, y = n.y - offY, w = n.w, h = n.h;
      const fill   = colorToHex(n.fillColor);
      const stroke = colorToHex(n.borderColor);

      switch (n.type) {
        case ShapeType.DECISION: {
          const cx = x + w * 0.5, cy = y + h * 0.5;
          svg += `  <polygon points="${cx.toFixed(1)},${y.toFixed(1)} ${(x+w).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(y+h).toFixed(1)} ${x.toFixed(1)},${cy.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2" />\n`;
          break;
        }
        case ShapeType.DATA: {
          const sl = w * 0.18;
          svg += `  <polygon points="${(x+sl).toFixed(1)},${y.toFixed(1)} ${(x+w).toFixed(1)},${y.toFixed(1)} ${(x+w-sl).toFixed(1)},${(y+h).toFixed(1)} ${x.toFixed(1)},${(y+h).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2" />\n`;
          break;
        }
        case ShapeType.TERMINATOR: {
          const rx = h * 0.5;
          svg += `  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2" />\n`;
          break;
        }
        case ShapeType.DATABASE: {
          const eh = h * 0.22;
          const cx2 = x + w * 0.5;
          svg += `  <rect x="${x.toFixed(1)}" y="${(y+eh*0.5).toFixed(1)}" width="${w.toFixed(1)}" height="${(h-eh).toFixed(1)}" fill="${fill}" stroke="none" />\n`;
          svg += `  <ellipse cx="${cx2.toFixed(1)}" cy="${(y+h-eh*0.5).toFixed(1)}" rx="${(w*0.5).toFixed(1)}" ry="${(eh*0.5).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2" />\n`;
          svg += `  <ellipse cx="${cx2.toFixed(1)}" cy="${(y+eh*0.5).toFixed(1)}"  rx="${(w*0.5).toFixed(1)}" ry="${(eh*0.5).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2" />\n`;
          svg += `  <line x1="${x.toFixed(1)}" y1="${(y+eh*0.5).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y+h-eh*0.5).toFixed(1)}" stroke="${stroke}" stroke-width="2" />\n`;
          svg += `  <line x1="${(x+w).toFixed(1)}" y1="${(y+eh*0.5).toFixed(1)}" x2="${(x+w).toFixed(1)}" y2="${(y+h-eh*0.5).toFixed(1)}" stroke="${stroke}" stroke-width="2" />\n`;
          break;
        }
        case ShapeType.NOTE: {
          const fold = Math.min(20, w * 0.13, h * 0.13);
          svg += `  <polygon points="${x.toFixed(1)},${y.toFixed(1)} ${(x+w).toFixed(1)},${y.toFixed(1)} ${(x+w).toFixed(1)},${(y+h-fold).toFixed(1)} ${(x+w-fold).toFixed(1)},${(y+h).toFixed(1)} ${x.toFixed(1)},${(y+h).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2" />\n`;
          break;
        }
        default: {
          const r = (n.type === ShapeType.SUBPROCESS) ? 5 : 8;
          svg += `  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2" />\n`;
          if (n.type === ShapeType.SUBPROCESS) {
            const ins = 16;
            svg += `  <line x1="${(x+ins).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+ins).toFixed(1)}" y2="${(y+h).toFixed(1)}" stroke="${stroke}" stroke-width="1.5" />\n`;
            svg += `  <line x1="${(x+w-ins).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+w-ins).toFixed(1)}" y2="${(y+h).toFixed(1)}" stroke="${stroke}" stroke-width="1.5" />\n`;
          }
        }
      }

      // Text
      svg += `  <text x="${(x+w*0.5).toFixed(1)}" y="${(y+h*0.5).toFixed(1)}" fill="#ffffff" font-family="Inter, sans-serif" font-size="14" font-weight="500" text-anchor="middle" dominant-baseline="central">${_escapeXML(n.text)}</text>\n`;
    }

    svg += `</svg>\n`;

    _downloadText(svg, 'diagrama.svg', 'image/svg+xml');
    return true;
  },

  /** Export PNG via offscreen canvas */
  exportPNG(diagram, renderer) {
    if (diagram.nodes.length === 0) return false;
    const oc = renderer.renderToOffscreen(diagram);
    oc.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'diagrama.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
    return true;
  },
};

function _svgPortPos(n, port) {
  switch (port) {
    case PortIndex.TOP:    return { x: n.x + n.w * 0.5, y: n.y };
    case PortIndex.RIGHT:  return { x: n.x + n.w, y: n.y + n.h * 0.5 };
    case PortIndex.BOTTOM: return { x: n.x + n.w * 0.5, y: n.y + n.h };
    case PortIndex.LEFT:   return { x: n.x, y: n.y + n.h * 0.5 };
    default:               return { x: n.x + n.w * 0.5, y: n.y + n.h * 0.5 };
  }
}

function _escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

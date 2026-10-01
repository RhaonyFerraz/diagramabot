/**
 * main.js — Application entry point, event loop, input handling
 * Mirrors main.c + portions of ui.c event handling
 */

class App {
  constructor() {
    this.canvas    = document.getElementById('canvas');
    this.diagram   = new Diagram();
    this.renderer  = new Renderer(this.canvas);
    this.ui        = new UI(this.diagram, this);

    // Camera: { ox, oy, zoom } — ox/oy are the world-origin offset in screen space
    this.camera = { ox: 0, oy: 0, zoom: 0.95 };

    this.currentTool = 'select'; // 'select' | 'connect'
    this.isPanning   = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.lastMouseWorld = { x: 0, y: 0 };

    // Double click detection
    this.lastClickTime = 0;
    this.lastClickPos  = { x: 0, y: 0 };

    // Drag state helpers
    this._dragInitialBounds = null;
    this._dragStartWorld    = null;

    // Resize state helpers
    this._hoveredResizeHandle = null;
    this._activeResizeHandle  = null;
    this._resizeStartWorld    = null;
    this._resizeInitialNode   = null;

    // FPS counter
    this._frameCount = 0;
    this._fpsTimer   = 0;
    this._fps        = 60;
    this._lastTime   = performance.now();

    this._setupCamera();
    this._bindUI();
    this._bindCanvas();
    this._bindKeyboard();
    this._bindDragAndDrop();
    this._initDiagram();
    this._loop();
  }

  async _initDiagram() {
    // Try to load from URL hash first (shared link)
    const hash = window.location.hash;
    if (hash && (hash.includes('share=') || hash.includes('diagram=') || hash.includes('data='))) {
      const ok = await Storage.loadDiagramFromURLHash(this.diagram, hash);
      if (ok) {
        // Center camera on the loaded diagram
        const bb = this.diagram.getBoundingBox(80);
        const W  = this.canvas.parentElement.clientWidth  || window.innerWidth;
        const H  = this.canvas.parentElement.clientHeight || window.innerHeight;
        this.camera.zoom = Math.min(3, Math.max(0.25, Math.min((W - 80) / bb.w, (H - 80) / bb.h)));
        this.camera.ox   = W * 0.5 - (bb.x + bb.w * 0.5) * this.camera.zoom;
        this.camera.oy   = H * 0.5 - (bb.y + bb.h * 0.5) * this.camera.zoom;
        this.diagram.setToast('Diagrama compartilhado carregado! ✅');
        return;
      }
    }
    Templates.loadDefaultFlowchart(this.diagram);
  }

  _setupCamera() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.ox = w * 0.5 - 700 * this.camera.zoom;
    this.camera.oy = h * 0.5 - 360 * this.camera.zoom;
  }

  // ── MAIN LOOP ──
  _loop() {
    const now = performance.now();
    const dt  = (now - this._lastTime) / 1000;
    this._lastTime = now;

    // FPS
    this._frameCount++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this._fps = Math.round(this._frameCount / this._fpsTimer);
      this._frameCount = 0;
      this._fpsTimer   = 0;
    }

    this.diagram.updateToast(dt);

    // Resize canvas if needed
    const W = this.canvas.parentElement.clientWidth;
    const H = this.canvas.parentElement.clientHeight;
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.renderer.resize(W, H);
    }

    const ctx = this.renderer.ctx;
    const isWhiteBg = this.diagram.backgroundColor === 'white';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isWhiteBg ? '#f8fafc' : '#121418';
    ctx.fillRect(0, 0, W, H);

    if (this.diagram.showGrid) {
      this.renderer.drawGrid(this.camera, this.diagram.gridSize, W, H, isWhiteBg);
    }
    this.renderer.drawDiagram(this.diagram, this.camera, W, H);

    this.ui.updateStatusBar(this.camera, this._fps);
    this.ui.updateToast();
    this.ui.updateInspector();

    requestAnimationFrame(() => this._loop());
  }

  // ── CANVAS EVENTS ──
  _bindCanvas() {
    const c = this.canvas;

    c.addEventListener('mousemove',   e => this._onMouseMove(e));
    c.addEventListener('mousedown',   e => this._onMouseDown(e));
    c.addEventListener('mouseup',     e => this._onMouseUp(e));
    c.addEventListener('wheel',       e => this._onWheel(e), { passive: false });
    c.addEventListener('dblclick',    e => this._onDblClick(e));
    c.addEventListener('contextmenu', e => e.preventDefault());

    // Touch support
    let touchStart = null;
    let touchZoomDist = null;
    c.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
        this._onMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0, currentTarget: c });
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchZoomDist = Math.hypot(dx, dy);
      }
    }, { passive: false });

    c.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && touchStart) {
        const t = e.touches[0];
        this._onMouseMove({ clientX: t.clientX, clientY: t.clientY, buttons: 1, currentTarget: c });
      } else if (e.touches.length === 2 && touchZoomDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = c.getBoundingClientRect();
        const sx = midX - rect.left, sy = midY - rect.top;
        const before = screenToWorld(sx, sy, this.camera);
        this.camera.zoom = Math.max(0.25, Math.min(3, this.camera.zoom * (newDist / touchZoomDist)));
        const after = screenToWorld(sx, sy, this.camera);
        this.camera.ox += (after.x - before.x) * this.camera.zoom;
        this.camera.oy += (after.y - before.y) * this.camera.zoom;
        touchZoomDist = newDist;
      }
    }, { passive: false });

    c.addEventListener('touchend', e => {
      e.preventDefault();
      if (e.touches.length < 2) touchZoomDist = null;
      if (e.touches.length === 0) {
        this._onMouseUp({ button: 0 });
        touchStart = null;
      }
    }, { passive: false });
  }

  _clientToCanvas(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onWheel(e) {
    e.preventDefault();
    const { x: sx, y: sy } = this._clientToCanvas(e);
    const before = screenToWorld(sx, sy, this.camera);
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    this.camera.zoom = Math.max(0.25, Math.min(3, this.camera.zoom + delta));
    const after = screenToWorld(sx, sy, this.camera);
    this.camera.ox += (after.x - before.x) * this.camera.zoom;
    this.camera.oy += (after.y - before.y) * this.camera.zoom;
  }

  _onMouseMove(e) {
    const { x: sx, y: sy } = this._clientToCanvas(e);
    const w = screenToWorld(sx, sy, this.camera);
    this.lastMouseWorld = w;
    const d = this.diagram;

    // Pan
    const isPanButton = e.buttons === 2 || e.buttons === 4 || this._spaceDown;
    if (isPanButton && (this.isPanning || e.buttons)) {
      const dx = sx - this.lastMousePos.x;
      const dy = sy - this.lastMousePos.y;
      this.camera.ox += dx;
      this.camera.oy += dy;
      this.isPanning = true;
      this.canvas.style.cursor = 'move';
    } else if (!this.isPanning) {
      // Check resize handle hover if a node is selected
      let resizeCursor = null;
      if (d.selectedNodeId !== -1 && d.dragState === 'none') {
        const selNode = d.getNode(d.selectedNodeId);
        if (selNode) {
          const rh = d.findResizeHandle(selNode, w.x, w.y, 8 / this.camera.zoom);
          this._hoveredResizeHandle = rh;
          if (rh) {
            const cursorMap = {
              'nw': 'nwse-resize', 'se': 'nwse-resize',
              'ne': 'nesw-resize', 'sw': 'nesw-resize',
              'n': 'ns-resize',    's': 'ns-resize',
              'w': 'ew-resize',    'e': 'ew-resize',
            };
            resizeCursor = cursorMap[rh];
          }
        }
      } else if (d.dragState !== 'resize') {
        this._hoveredResizeHandle = null;
      }

      if (resizeCursor) {
        this.canvas.style.cursor = resizeCursor;
        d.hoveredPortNodeId = -1;
        d.hoveredPortIndex  = -1;
      } else {
        // Hover detection
        const portHit = d.findPortAt(w.x, w.y);
        if (portHit) {
          d.hoveredPortNodeId = portHit.nodeId;
          d.hoveredPortIndex  = portHit.portIndex;
          d.hoveredNodeId     = portHit.nodeId;
          d.hoveredConnId     = -1;
          this.canvas.style.cursor = 'crosshair';
        } else {
          d.hoveredPortNodeId = -1;
          d.hoveredPortIndex  = -1;
          const nid = d.findNodeAt(w.x, w.y);
          d.hoveredNodeId = nid;
          if (nid !== -1) {
            d.hoveredConnId = -1;
            this.canvas.style.cursor = (this.currentTool === 'connect') ? 'crosshair' : 'move';
          } else {
            d.hoveredConnId = d.findConnectionAt(w.x, w.y);
            this.canvas.style.cursor = d.hoveredConnId !== -1 ? 'pointer' : 'default';
          }
        }
      }

      // Drag resize node
      if (d.dragState === 'resize' && d.selectedNodeId !== -1 && this._activeResizeHandle && this._resizeInitialNode) {
        const n = d.getNode(d.selectedNodeId);
        if (n) {
          const dx = w.x - this._resizeStartWorld.x;
          const dy = w.y - this._resizeStartWorld.y;
          const init = this._resizeInitialNode;
          const handle = this._activeResizeHandle;
          const isImage = (n.type === ShapeType.IMAGE);
          const keepRatio = isImage || e.shiftKey;
          const ratio = n.aspectRatio || (init.w / init.h);

          let nw = init.w;
          let nh = init.h;
          let nx = init.x;
          let ny = init.y;

          if (handle.includes('e')) nw = Math.max(50, init.w + dx);
          if (handle.includes('s')) nh = Math.max(40, init.h + dy);
          if (handle.includes('w')) {
            const candidateW = init.w - dx;
            if (candidateW >= 50) {
              nw = candidateW;
              nx = init.x + dx;
            }
          }
          if (handle.includes('n')) {
            const candidateH = init.h - dy;
            if (candidateH >= 40) {
              nh = candidateH;
              ny = init.y + dy;
            }
          }

          if (keepRatio && ratio > 0) {
            if (handle === 'e' || handle === 'w') {
              nh = Math.round(nw / ratio);
            } else if (handle === 'n' || handle === 's') {
              nw = Math.round(nh * ratio);
            } else {
              nh = Math.round(nw / ratio);
            }
          }

          if (d.snapToGrid && d.gridSize > 0) {
            nw = Math.round(nw / d.gridSize) * d.gridSize;
            nh = Math.round(nh / d.gridSize) * d.gridSize;
          }

          n.w = Math.max(50, nw);
          n.h = Math.max(40, nh);
          n.x = nx;
          n.y = ny;
        }
      }

      // Drag move node
      if (d.dragState === 'move' && d.selectedNodeId !== -1) {
        const n = d.getNode(d.selectedNodeId);
        if (n && this._dragStartWorld && this._dragInitialBounds) {
          const dx = w.x - this._dragStartWorld.x;
          const dy = w.y - this._dragStartWorld.y;
          n.x = this._dragInitialBounds.x + dx;
          n.y = this._dragInitialBounds.y + dy;
          if (d.snapToGrid && d.gridSize > 0) {
            n.x = Math.round(n.x / d.gridSize) * d.gridSize;
            n.y = Math.round(n.y / d.gridSize) * d.gridSize;
          }
        }
      }

      // Connection in progress
      if (d.dragState === 'connect') {
        const portHit2 = d.findPortAt(w.x, w.y);
        if (portHit2) {
          const tn = d.getNode(portHit2.nodeId);
          if (tn) d.connectTargetPos = d.getPortPosition(tn, portHit2.portIndex);
          d.hoveredPortNodeId = portHit2.nodeId;
          d.hoveredPortIndex  = portHit2.portIndex;
        } else {
          d.connectTargetPos = { x: w.x, y: w.y };
        }
      }
    }

    this.lastMousePos = { x: sx, y: sy };
  }

  _onMouseDown(e) {
    const { x: sx, y: sy } = this._clientToCanvas(e);
    const w = screenToWorld(sx, sy, this.camera);
    const d = this.diagram;

    if (e.button === 1 || e.button === 2 || this._spaceDown) {
      this.isPanning = true;
      this.lastMousePos = { x: sx, y: sy };
      this.canvas.style.cursor = 'move';
      return;
    }
    if (e.button !== 0) return;
    if (d.isEditingText) this._commitEdit();

    const now = Date.now();
    const isDouble = (now - this.lastClickTime < 350) &&
                     Math.hypot(sx - this.lastClickPos.x, sy - this.lastClickPos.y) < 5;
    this.lastClickTime = now;
    this.lastClickPos  = { x: sx, y: sy };

    if (isDouble) {
      // Double click — edit text
      const nid = d.findNodeAt(w.x, w.y);
      if (nid !== -1) { this.startEditing(nid, true); return; }
      const cid = d.findConnectionAt(w.x, w.y);
      if (cid !== -1) { this.startEditing(cid, false); return; }
      return;
    }

    // Check if clicked on a resize handle of the selected node
    if (d.selectedNodeId !== -1 && this._hoveredResizeHandle) {
      const selNode = d.getNode(d.selectedNodeId);
      if (selNode) {
        d.dragState = 'resize';
        this._activeResizeHandle = this._hoveredResizeHandle;
        this._resizeStartWorld   = { x: w.x, y: w.y };
        this._resizeInitialNode  = { x: selNode.x, y: selNode.y, w: selNode.w, h: selNode.h };
        return;
      }
    }

    // Single click
    const portHit = d.findPortAt(w.x, w.y);

    if (portHit || this.currentTool === 'connect') {
      let startNode = portHit ? portHit.nodeId : d.hoveredNodeId;
      let startPort = portHit ? portHit.portIndex : PortIndex.RIGHT;
      if (startNode === -1) startNode = d.hoveredNodeId;
      if (startNode !== -1) {
        d.dragState = 'connect';
        d.connectStartNodeId = startNode;
        d.connectStartPort   = startPort;
        d.connectTargetPos   = { x: w.x, y: w.y };
      }
    } else {
      const nid = d.findNodeAt(w.x, w.y);
      if (nid !== -1) {
        d.selectedNodeId = nid;
        d.selectedConnId = -1;
        d.dragState = 'move';
        this._dragStartWorld    = { x: w.x, y: w.y };
        const n = d.getNode(nid);
        this._dragInitialBounds = { x: n.x, y: n.y };
      } else {
        const cid = d.findConnectionAt(w.x, w.y);
        if (cid !== -1) {
          d.selectedConnId = cid;
          d.selectedNodeId = -1;
        } else {
          d.selectedNodeId = -1;
          d.selectedConnId = -1;
        }
        d.dragState = 'none';
      }
    }
  }

  _onMouseUp(e) {
    const d = this.diagram;
    if (e.button === 1 || e.button === 2) { this.isPanning = false; return; }
    if (e.button !== 0) return;
    this.isPanning = false;

    if (d.dragState === 'move' || d.dragState === 'resize') {
      d._pushHistory();
    } else if (d.dragState === 'connect') {
      const endPortHit = d.hoveredPortNodeId !== -1 ? { nodeId: d.hoveredPortNodeId, portIndex: d.hoveredPortIndex } : null;
      const endNodeId  = endPortHit ? endPortHit.nodeId : d.hoveredNodeId;
      if (endNodeId !== -1 && endNodeId !== d.connectStartNodeId) {
        const endPort = endPortHit ? endPortHit.portIndex : PortIndex.AUTO;
        d.addConnection(d.connectStartNodeId, endNodeId, d.connectStartPort, endPort, '');
      }
    }

    d.dragState = 'none';
    d.connectStartNodeId = -1;
    this._dragStartWorld    = null;
    this._dragInitialBounds = null;
    this._activeResizeHandle = null;
    this._resizeStartWorld   = null;
    this._resizeInitialNode  = null;
    this.canvas.style.cursor = 'default';
  }

  _onDblClick(e) {
    // Already handled in mousedown with timing logic
    e.preventDefault();
  }

  // ── TEXT EDITING ──
  startEditing(id, isNode) {
    const d = this.diagram;
    let target, text;
    if (isNode) {
      target = d.getNode(id);
      text   = target ? target.text : '';
    } else {
      target = d.getConnection(id);
      text   = target ? target.label : '';
    }
    if (!target) return;

    d.isEditingText   = true;
    d.editingNode     = isNode;
    d.editingTargetId = id;
    d.editTextBuffer  = text;

    const editorEl = document.getElementById('text-editor');
    const inputEl  = document.getElementById('text-input');

    // Detect TEXT node for multiline / full-cover mode
    const isTextNode = isNode && target.type === ShapeType.TEXT;

    let sx, sy, ew, eh;
    if (isNode) {
      const n = target;
      if (isTextNode) {
        const sp = worldToScreen(n.x, n.y, this.camera);
        sx = sp.x;
        sy = sp.y;
        ew = Math.max(80,  n.w * this.camera.zoom);
        eh = Math.max(28,  n.h * this.camera.zoom);
      } else {
        const sp = worldToScreen(n.x, n.y + n.h * 0.5 - 18, this.camera);
        sx = sp.x;
        sy = sp.y;
        ew = Math.max(140, n.w * this.camera.zoom);
        eh = 36;
      }
    } else {
      const from = d.getNode(target.fromNodeId);
      const to   = d.getNode(target.toNodeId);
      if (!from || !to) return;
      const fp = target.fromPort === PortIndex.AUTO ? d.getClosestPort(from, to) : target.fromPort;
      const tp = target.toPort   === PortIndex.AUTO ? d.getClosestPort(to, from) : target.toPort;
      const p1 = d.getPortPosition(from, fp);
      const p2 = d.getPortPosition(to,   tp);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const sm  = worldToScreen(mid.x, mid.y, this.camera);
      ew = 180;
      eh = 36;
      sx = sm.x - ew / 2;
      sy = sm.y - eh / 2;
    }

    editorEl.style.left    = `${sx}px`;
    editorEl.style.top     = `${sy}px`;
    editorEl.style.width   = `${ew}px`;
    editorEl.style.height  = `${eh}px`;
    editorEl.style.display = 'block';
    editorEl.classList.add('visible');

    if (isTextNode) {
      const n = target;
      const fs = Math.max(8, (n.fontSize || 18) * this.camera.zoom);
      inputEl.style.cssText = [
        `font-size:${fs}px`,
        `font-family:${n.fontFamily || 'Inter, sans-serif'}`,
        `font-weight:${n.fontWeight || '600'}`,
        `color:${colorToCss(n.textColor || { r: 255, g: 255, b: 255, a: 255 })}`,
        'background:transparent',
        'padding:4px 8px',
        'resize:none',
        `min-height:${eh}px`,
        'overflow:hidden',
        'box-sizing:border-box',
        'border:none',
        'outline:none',
        'white-space:pre-wrap',
        'word-wrap:break-word',
      ].join(';');
    } else {
      inputEl.style.cssText = '';
    }

    inputEl.value = text;
    inputEl.select();
    inputEl.focus();

    // Live resize for text nodes
    const onInput = () => {
      if (!isTextNode) return;
      const n = d.getNode(id);
      if (!n) return;
      n.text = inputEl.value;
      d.recomputeTextNodeDimensions(n);
      const sp = worldToScreen(n.x, n.y, this.camera);
      editorEl.style.left   = `${sp.x}px`;
      editorEl.style.top    = `${sp.y}px`;
      editorEl.style.width  = `${Math.max(80, n.w * this.camera.zoom)}px`;
      editorEl.style.height = `${Math.max(28, n.h * this.camera.zoom)}px`;
    };

    const onKeyDown = (ev) => {
      if (isTextNode) {
        // Ctrl+Enter or Shift+Enter = finish; Escape = cancel; bare Enter = newline
        if (ev.key === 'Escape') { this._cancelEdit(); cleanup(); }
        else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey || ev.shiftKey)) {
          ev.preventDefault();
          this._commitEdit();
          cleanup();
        }
      } else {
        if (ev.key === 'Enter')  { this._commitEdit(); cleanup(); }
        else if (ev.key === 'Escape') { this._cancelEdit(); cleanup(); }
      }
    };

    const cleanup = () => {
      inputEl.removeEventListener('keydown', onKeyDown);
      inputEl.removeEventListener('input',   onInput);
    };
    inputEl.addEventListener('keydown', onKeyDown);
    inputEl.addEventListener('input',   onInput);
  }


  _commitEdit() {
    const d    = this.diagram;
    const input = document.getElementById('text-input');
    if (!d.isEditingText) return;
    const val = input.value;
    if (d.editingNode) {
      const n = d.getNode(d.editingTargetId);
      if (n) { n.text = val; d._pushHistory(); d.setToast('Texto atualizado'); }
    } else {
      const c = d.getConnection(d.editingTargetId);
      if (c) { c.label = val; d._pushHistory(); d.setToast('Rótulo atualizado'); }
    }
    this._closeEditor();
  }

  _cancelEdit() {
    this.diagram.isEditingText = false;
    this._closeEditor();
  }

  _closeEditor() {
    const editorEl = document.getElementById('text-editor');
    editorEl.style.display = 'none';
    editorEl.classList.remove('visible');
    this.diagram.isEditingText = false;
  }

  // ── KEYBOARD ──
  _spaceDown = false;

  _bindKeyboard() {
    document.addEventListener('keydown', e => this._onKeyDown(e));
    document.addEventListener('keyup',   e => { if (e.code === 'Space') this._spaceDown = false; });
  }

  _onKeyDown(e) {
    const d   = this.diagram;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'Space' && !e.repeat) {
      this._spaceDown = true;
      e.preventDefault();
    }

    if (d.isEditingText) return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.code === 'KeyZ') { e.preventDefault(); d.undo(); }
    if (ctrl && e.code === 'KeyY') { e.preventDefault(); d.redo(); }
    if (ctrl && e.code === 'KeyD') {
      e.preventDefault();
      d.duplicateSelectedNode();
    }
    if (ctrl && e.code === 'KeyS') {
      e.preventDefault();
      Storage.saveDiagram(d);
      d.setToast("Salvo como 'diagrama.diag'!");
    }

    if (e.code === 'Delete' || e.code === 'Backspace') {
      if (d.selectedNodeId !== -1) d.removeNode(d.selectedNodeId);
      else if (d.selectedConnId !== -1) d.removeConnection(d.selectedConnId);
    }

    if (e.code === 'KeyV') this._selectTool('select');
    if (e.code === 'KeyC' && !ctrl) {
      this._selectTool('connect');
      d.setToast('Modo Conexão: Arraste de um ponto a outro');
    }
    if (e.code === 'KeyG') d.showGrid = !d.showGrid;
    if (e.code === 'KeyS' && !ctrl) {
      d.snapToGrid = !d.snapToGrid;
      d.setToast(d.snapToGrid ? 'Snap to Grid ativado' : 'Snap to Grid desativado');
    }
    if (e.code === 'F1') { e.preventDefault(); this._toggleHelp(); }
    if (e.code === 'Escape') {
      if (d.dragState === 'connect') d.dragState = 'none';
      if (d.isEditingText) this._cancelEdit();
      const helpOverlay = document.getElementById('help-overlay');
      if (helpOverlay.style.display !== 'none') helpOverlay.style.display = 'none';
    }

    // Quick shape insertion (1-8 + T)
    const shapeMap = {
      'Digit1': ShapeType.TERMINATOR,
      'Digit2': ShapeType.PROCESS,
      'Digit3': ShapeType.DECISION,
      'Digit4': ShapeType.DATA,
      'Digit5': ShapeType.DATABASE,
      'Digit6': ShapeType.SUBPROCESS,
      'Digit7': ShapeType.NOTE,
    };
    const shapeSizes = {
      [ShapeType.TERMINATOR]: [130, 50],
      [ShapeType.PROCESS]:    [140, 60],
      [ShapeType.DECISION]:   [140, 90],
      [ShapeType.DATA]:       [150, 60],
      [ShapeType.DATABASE]:   [130, 80],
      [ShapeType.SUBPROCESS]: [150, 60],
      [ShapeType.NOTE]:       [150, 80],
    };
    if (!ctrl && shapeMap[e.code]) {
      const type = shapeMap[e.code];
      const [sw, sh] = shapeSizes[type];
      const wc = screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5, this.camera);
      d.addNode(type, wc.x - sw * 0.5, wc.y - sh * 0.5, sw, sh, null);
    }
    // T or 8 = add text box
    if (!ctrl && (e.code === 'KeyT' || e.code === 'Digit8')) {
      const wc = screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5, this.camera);
      d.addTextNode(wc.x - 60, wc.y - 22);
      d.setToast('📝 Caixa de Texto adicionada!');
    }
  }

  // ── TOOLBAR BUTTONS ──
  _bindUI() {
    // File buttons
    document.getElementById('btn-new').addEventListener('click', () => {
      if (confirm('Criar novo diagrama? Alterações não salvas serão perdidas.')) {
        this.diagram.clear();
      }
    });
    document.getElementById('btn-save').addEventListener('click', () => {
      Storage.saveDiagram(this.diagram);
      this.diagram.setToast("Salvo como 'diagrama.diag'!");
    });
    document.getElementById('btn-load').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const ok = Storage.loadDiagramFromJSON(this.diagram, ev.target.result);
        if (!ok) this.diagram.setToast('Erro ao carregar arquivo!');
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Image import buttons
    const triggerImageSelect = () => {
      const input = document.getElementById('image-file-input');
      if (input) input.click();
    };
    const topImgBtn = document.getElementById('btn-import-img');
    if (topImgBtn) topImgBtn.addEventListener('click', triggerImageSelect);

    const sideImgBtn = document.getElementById('btn-side-import-img');
    if (sideImgBtn) sideImgBtn.addEventListener('click', triggerImageSelect);

    const imgInput = document.getElementById('image-file-input');
    if (imgInput) {
      imgInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const wc = screenToWorld(
          this.canvas.width * 0.5,
          this.canvas.height * 0.5,
          this.camera
        );
        this.importImageFile(file, wc.x, wc.y);
        e.target.value = '';
      });
    }

    // Text box buttons
    const addTextNode = () => {
      const wc = screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5, this.camera);
      this.diagram.addTextNode(wc.x - 60, wc.y - 22);
      this._selectTool('select');
      this.diagram.setToast('📝 Caixa de Texto adicionada! Clique duplo para editar.');
    };
    const topTextBtn = document.getElementById('btn-add-text');
    if (topTextBtn) topTextBtn.addEventListener('click', addTextNode);
    const sideTextBtn = document.getElementById('btn-side-text');
    if (sideTextBtn) sideTextBtn.addEventListener('click', addTextNode);

    // Export buttons
    document.getElementById('btn-export-svg').addEventListener('click', () => {
      if (!Storage.exportSVG(this.diagram)) this.diagram.setToast('Adicione blocos antes de exportar!');
      else this.diagram.setToast("Exportado: 'diagrama.svg'!");
    });
    document.getElementById('btn-export-png').addEventListener('click', () => {
      if (!Storage.exportPNG(this.diagram, this.renderer)) this.diagram.setToast('Adicione blocos antes de exportar!');
      else this.diagram.setToast("Exportado: 'diagrama.png'!");
    });

    // Share
    document.getElementById('btn-share').addEventListener('click', () => this._openShareModal());
    document.getElementById('share-close').addEventListener('click', () => this._closeShareModal());
    document.getElementById('share-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('share-overlay')) this._closeShareModal();
    });
    document.getElementById('share-copy-btn').addEventListener('click', () => {
      const input = document.getElementById('share-url-input');
      navigator.clipboard.writeText(input.value).then(() => {
        const btn = document.getElementById('share-copy-btn');
        btn.textContent = 'Copiado! ✅';
        this.diagram.setToast('Link copiado para área de transferência!');
        setTimeout(() => { btn.textContent = 'Copiar Link'; }, 2000);
      }).catch(() => {
        input.select();
        document.execCommand('copy');
        this.diagram.setToast('Link copiado!');
      });
    });
    document.getElementById('share-copy-png-btn').addEventListener('click', async () => {
      if (this.diagram.nodes.length === 0) {
        this.diagram.setToast('Adicione blocos antes de copiar!');
        return;
      }
      const ok = await Storage.copyPNGToClipboard(this.diagram, this.renderer);
      if (ok) this.diagram.setToast('Imagem PNG copiada para área de transferência! 🖼️');
      else     this.diagram.setToast('Não foi possível copiar a imagem.');
    });
    document.getElementById('share-open-tab-btn').addEventListener('click', () => {
      const url = document.getElementById('share-url-input').value;
      if (url) window.open(url, '_blank');
    });

    // Examples
    document.getElementById('btn-example1').addEventListener('click', () => {
      Templates.loadDefaultFlowchart(this.diagram);
      this.camera.ox = this.canvas.width  * 0.5 - 700 * this.camera.zoom;
      this.camera.oy = this.canvas.height * 0.5 - 360 * this.camera.zoom;
    });
    document.getElementById('btn-example2').addEventListener('click', () => {
      Templates.loadSystemArchitecture(this.diagram);
      this.camera.ox = this.canvas.width  * 0.5 - 500 * this.camera.zoom;
      this.camera.oy = this.canvas.height * 0.5 - 300 * this.camera.zoom;
    });

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', () => this.diagram.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.diagram.redo());

    // Zoom
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.camera.zoom = Math.max(0.25, this.camera.zoom / 1.2);
    });
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.camera.zoom = Math.min(3, this.camera.zoom * 1.2);
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
      this.camera.zoom = 1.0;
    });

    // Grid / Snap / Background theme
    document.getElementById('btn-grid').addEventListener('click', () => {
      this.diagram.showGrid = !this.diagram.showGrid;
    });
    document.getElementById('btn-snap').addEventListener('click', () => {
      this.diagram.snapToGrid = !this.diagram.snapToGrid;
      this.diagram.setToast(this.diagram.snapToGrid ? 'Snap to Grid ativado' : 'Snap to Grid desativado');
    });
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextBg = this.diagram.backgroundColor === 'white' ? 'dark' : 'white';
        this.diagram.setBackgroundColor(nextBg);
      });
    }

    // Help
    document.getElementById('btn-help').addEventListener('click', () => this._toggleHelp());
    document.getElementById('help-close').addEventListener('click', () => this._toggleHelp(false));
    document.getElementById('help-ok').addEventListener('click', () => this._toggleHelp(false));

    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => this._selectTool(btn.dataset.tool));
    });

    // Shape buttons
    document.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.shape;
        const sizes = {
          terminator: [130, 50], process: [140, 60], decision: [140, 90],
          data: [150, 60], database: [130, 80], subprocess: [150, 60], note: [150, 80],
        };
        const [sw, sh] = sizes[type] || [140, 60];
        const wc = screenToWorld(
          this.canvas.width  * 0.5,
          this.canvas.height * 0.5,
          this.camera
        );
        this.diagram.addNode(type, wc.x - sw * 0.5, wc.y - sh * 0.5, sw, sh, null);
        this._selectTool('select');
      });
    });
  }

  _selectTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    this.canvas.style.cursor = tool === 'connect' ? 'crosshair' : 'default';
  }

  async _openShareModal() {
    if (this.diagram.nodes.length === 0) {
      this.diagram.setToast('Adicione blocos ao diagrama antes de compartilhar!');
      return;
    }
    const overlay = document.getElementById('share-overlay');
    const input   = document.getElementById('share-url-input');
    const copyBtn = document.getElementById('share-copy-btn');

    input.value  = 'Gerando link…';
    copyBtn.disabled = true;
    overlay.style.display = 'flex';

    try {
      const { url, length } = await Storage.exportShareURL(this.diagram);
      input.value  = url;
      copyBtn.disabled = false;
      copyBtn.textContent = 'Copiar Link';

      // Warn if link is very long
      if (length > 8000) {
        this.diagram.setToast('Aviso: link muito longo — diagrama grande pode não abrir em alguns navegadores.');
      }
    } catch (err) {
      console.error('Share error', err);
      input.value = 'Erro ao gerar link.';
    }
  }

  _closeShareModal() {
    document.getElementById('share-overlay').style.display = 'none';
  }

  _toggleHelp(show) {
    const overlay = document.getElementById('help-overlay');
    if (show === undefined) {
      overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
    } else {
      overlay.style.display = show ? 'flex' : 'none';
    }
  }

  // ── DRAG & DROP & CLIPBOARD IMAGE IMPORT ──
  _bindDragAndDrop() {
    const overlay = document.getElementById('drop-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', e => {
      e.preventDefault();
      dragCounter++;
      if (overlay) overlay.style.display = 'flex';
    });

    window.addEventListener('dragover', e => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      if (overlay && overlay.style.display === 'none') overlay.style.display = 'flex';
    });

    window.addEventListener('dragleave', e => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (overlay) overlay.style.display = 'none';
      }
    });

    window.addEventListener('drop', e => {
      e.preventDefault();
      dragCounter = 0;
      if (overlay) overlay.style.display = 'none';

      const files = e.dataTransfer ? e.dataTransfer.files : null;
      if (!files || files.length === 0) return;

      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldPos = screenToWorld(sx, sy, this.camera);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          this.importImageFile(file, worldPos.x + i * 25, worldPos.y + i * 25);
        } else if (file.name.endsWith('.diag') || file.name.endsWith('.json')) {
          const reader = new FileReader();
          reader.onload = ev => {
            const ok = Storage.loadDiagramFromJSON(this.diagram, ev.target.result);
            if (!ok) this.diagram.setToast('Erro ao carregar arquivo!');
          };
          reader.readAsText(file);
        }
      }
    });

    // Paste event (Ctrl+V)
    window.addEventListener('paste', e => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (!e.clipboardData || !e.clipboardData.items) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const wc = (this.lastMouseWorld && (this.lastMouseWorld.x !== 0 || this.lastMouseWorld.y !== 0))
              ? this.lastMouseWorld
              : screenToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5, this.camera);
            this.importImageFile(file, wc.x, wc.y);
            this.diagram.setToast('Imagem colada com sucesso! 📋🖼️');
            e.preventDefault();
            break;
          }
        }
      }
    });
  }

  importImageFile(file, wx, wy) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const tempImg = new Image();
      tempImg.onload = () => {
        const natW = tempImg.naturalWidth || 240;
        const natH = tempImg.naturalHeight || 180;
        const aspect = natW / natH;

        let w = 260;
        let h = Math.round(w / aspect);
        if (h > 240) {
          h = 240;
          w = Math.round(h * aspect);
        }
        w = Math.max(80, Math.min(600, w));
        h = Math.max(60, Math.min(600, h));

        const posX = (wx !== undefined) ? Math.round(wx - w * 0.5) : 100;
        const posY = (wy !== undefined) ? Math.round(wy - h * 0.5) : 100;
        const caption = file.name ? file.name.replace(/\.[^/.]+$/, "") : '';

        this.diagram.addImageNode(dataUrl, posX, posY, w, h, caption, aspect);
      };
      tempImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

}

// ── Bootstrap ──
window.addEventListener('DOMContentLoaded', () => {
  window._app = new App();
});

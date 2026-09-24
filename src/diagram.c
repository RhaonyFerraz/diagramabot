#include "diagram.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

static Color DefaultFillForShape(ShapeType type) {
    switch (type) {
        case SHAPE_TERMINATOR: return (Color){ 16, 185, 129, 230 }; // Emerald Green
        case SHAPE_PROCESS:    return (Color){ 37, 99, 235, 230 };  // Blue
        case SHAPE_DECISION:   return (Color){ 217, 119, 6, 230 };  // Amber
        case SHAPE_DATA:       return (Color){ 13, 148, 136, 230 }; // Teal
        case SHAPE_DATABASE:   return (Color){ 124, 58, 237, 230 }; // Purple
        case SHAPE_SUBPROCESS: return (Color){ 79, 70, 229, 230 };  // Indigo
        case SHAPE_DOCUMENT:   return (Color){ 2, 132, 199, 230 };  // Sky Blue
        case SHAPE_NOTE:       return (Color){ 202, 138, 4, 230 };  // Yellow / Note
        default:               return (Color){ 71, 85, 105, 230 };  // Slate
    }
}

static Color DefaultBorderForShape(ShapeType type) {
    switch (type) {
        case SHAPE_TERMINATOR: return (Color){ 110, 231, 183, 255 };
        case SHAPE_PROCESS:    return (Color){ 147, 197, 253, 255 };
        case SHAPE_DECISION:   return (Color){ 252, 211, 77, 255 };
        case SHAPE_DATA:       return (Color){ 94, 234, 212, 255 };
        case SHAPE_DATABASE:   return (Color){ 196, 181, 253, 255 };
        case SHAPE_SUBPROCESS: return (Color){ 165, 180, 252, 255 };
        case SHAPE_DOCUMENT:   return (Color){ 125, 211, 252, 255 };
        case SHAPE_NOTE:       return (Color){ 253, 224, 71, 255 };
        default:               return (Color){ 203, 213, 225, 255 };
    }
}

Diagram* Diagram_Create(void) {
    Diagram *d = (Diagram*)calloc(1, sizeof(Diagram));
    if (d) {
        Diagram_Init(d);
    }
    return d;
}

void Diagram_Init(Diagram *d) {
    // Liberar histórico anterior se houver
    for (int i = 0; i < MAX_HISTORY; i++) {
        if (d->history[i]) {
            free(d->history[i]);
            d->history[i] = NULL;
        }
    }

    memset(d, 0, sizeof(Diagram));
    d->nextNodeId = 1;
    d->nextConnId = 1;
    d->selectedNodeId = -1;
    d->selectedConnId = -1;
    d->hoveredNodeId = -1;
    d->hoveredConnId = -1;
    d->hoveredPortIndex = -1;
    d->hoveredPortNodeId = -1;
    d->dragState = DRAG_STATE_NONE;
    d->resizeHandleIndex = -1;
    d->connectStartNodeId = -1;

    d->snapToGrid = true;
    d->gridSize = 20.0f;
    d->showGrid = true;

    d->historyIndex = -1;
    d->historyCount = 0;
    Diagram_PushHistory(d);
}

void Diagram_Shutdown(Diagram *d) {
    if (!d) return;
    for (int i = 0; i < MAX_HISTORY; i++) {
        if (d->history[i]) {
            free(d->history[i]);
            d->history[i] = NULL;
        }
    }
}

void Diagram_Clear(Diagram *d) {
    d->nodeCount = 0;
    d->connectionCount = 0;
    d->selectedNodeId = -1;
    d->selectedConnId = -1;
    d->hoveredNodeId = -1;
    d->hoveredConnId = -1;
    d->dragState = DRAG_STATE_NONE;
    d->isEditingText = false;
    Diagram_PushHistory(d);
    Diagram_SetToast(d, "Novo diagrama criado");
}

void Diagram_PushHistory(Diagram *d) {
    // Truncate redo future
    if (d->historyIndex < d->historyCount - 1) {
        for (int i = d->historyIndex + 1; i < d->historyCount; i++) {
            if (d->history[i]) {
                free(d->history[i]);
                d->history[i] = NULL;
            }
        }
        d->historyCount = d->historyIndex + 1;
    }

    DiagramSnapshot *snap = NULL;
    if (d->historyCount >= MAX_HISTORY) {
        // Reutilizar o primeiro snapshot que vai sair da pilha
        snap = d->history[0];
        memmove(&d->history[0], &d->history[1], sizeof(DiagramSnapshot*) * (MAX_HISTORY - 1));
        d->historyCount = MAX_HISTORY - 1;
        d->historyIndex = MAX_HISTORY - 2;
    } else {
        snap = (DiagramSnapshot*)malloc(sizeof(DiagramSnapshot));
    }

    d->historyIndex++;
    d->historyCount = d->historyIndex + 1;
    d->history[d->historyIndex] = snap;

    if (snap) {
        snap->nodeCount = d->nodeCount;
        memcpy(snap->nodes, d->nodes, sizeof(Node) * d->nodeCount);
        snap->connectionCount = d->connectionCount;
        memcpy(snap->connections, d->connections, sizeof(Connection) * d->connectionCount);
        snap->nextNodeId = d->nextNodeId;
        snap->nextConnId = d->nextConnId;
    }
}

bool Diagram_Undo(Diagram *d) {
    if (d->historyIndex > 0) {
        d->historyIndex--;
        DiagramSnapshot *snap = d->history[d->historyIndex];
        if (snap) {
            d->nodeCount = snap->nodeCount;
            memcpy(d->nodes, snap->nodes, sizeof(Node) * snap->nodeCount);
            d->connectionCount = snap->connectionCount;
            memcpy(d->connections, snap->connections, sizeof(Connection) * snap->connectionCount);
            d->nextNodeId = snap->nextNodeId;
            d->nextConnId = snap->nextConnId;
        }

        d->selectedNodeId = -1;
        d->selectedConnId = -1;
        d->isEditingText = false;
        Diagram_SetToast(d, "Desfazer (Undo)");
        return true;
    }
    return false;
}

bool Diagram_Redo(Diagram *d) {
    if (d->historyIndex < d->historyCount - 1) {
        d->historyIndex++;
        DiagramSnapshot *snap = d->history[d->historyIndex];
        if (snap) {
            d->nodeCount = snap->nodeCount;
            memcpy(d->nodes, snap->nodes, sizeof(Node) * snap->nodeCount);
            d->connectionCount = snap->connectionCount;
            memcpy(d->connections, snap->connections, sizeof(Connection) * snap->connectionCount);
            d->nextNodeId = snap->nextNodeId;
            d->nextConnId = snap->nextConnId;
        }

        d->selectedNodeId = -1;
        d->selectedConnId = -1;
        d->isEditingText = false;
        Diagram_SetToast(d, "Refazer (Redo)");
        return true;
    }
    return false;
}

Node* Diagram_AddNode(Diagram *d, ShapeType type, float x, float y, float width, float height, const char *text) {
    if (d->nodeCount >= MAX_NODES) {
        Diagram_SetToast(d, "Limite máximo de blocos atingido");
        return NULL;
    }

    if (d->snapToGrid && d->gridSize > 0) {
        x = roundf(x / d->gridSize) * d->gridSize;
        y = roundf(y / d->gridSize) * d->gridSize;
    }

    Node *n = &d->nodes[d->nodeCount++];
    memset(n, 0, sizeof(Node));
    n->id = d->nextNodeId++;
    n->type = type;
    n->bounds = (Rectangle){ x, y, width, height };
    if (text) {
        strncpy(n->text, text, MAX_TEXT_LEN - 1);
    } else {
        snprintf(n->text, MAX_TEXT_LEN, "Bloco %d", n->id);
    }
    n->fillColor = DefaultFillForShape(type);
    n->borderColor = DefaultBorderForShape(type);
    n->textColor = RAYWHITE;
    n->borderWidth = 2.0f;
    n->selected = false;

    d->selectedNodeId = n->id;
    d->selectedConnId = -1;

    Diagram_PushHistory(d);
    return n;
}

Node* Diagram_GetNode(Diagram *d, int id) {
    if (id <= 0) return NULL;
    for (int i = 0; i < d->nodeCount; i++) {
        if (d->nodes[i].id == id) return &d->nodes[i];
    }
    return NULL;
}

bool Diagram_RemoveNode(Diagram *d, int id) {
    int nodeIdx = -1;
    for (int i = 0; i < d->nodeCount; i++) {
        if (d->nodes[i].id == id) {
            nodeIdx = i;
            break;
        }
    }
    if (nodeIdx == -1) return false;

    // Remove associeted connections
    for (int i = 0; i < d->connectionCount; ) {
        if (d->connections[i].fromNodeId == id || d->connections[i].toNodeId == id) {
            d->connections[i] = d->connections[d->connectionCount - 1];
            d->connectionCount--;
        } else {
            i++;
        }
    }

    // Remove node
    d->nodes[nodeIdx] = d->nodes[d->nodeCount - 1];
    d->nodeCount--;

    if (d->selectedNodeId == id) d->selectedNodeId = -1;
    if (d->hoveredNodeId == id) d->hoveredNodeId = -1;
    if (d->isEditingText && d->editingTargetId == id) d->isEditingText = false;

    Diagram_PushHistory(d);
    Diagram_SetToast(d, "Bloco excluído");
    return true;
}

static bool PointInDiamond(Vector2 p, Rectangle r) {
    float cx = r.x + r.width * 0.5f;
    float cy = r.y + r.height * 0.5f;
    float dx = fabsf(p.x - cx) / (r.width * 0.5f);
    float dy = fabsf(p.y - cy) / (r.height * 0.5f);
    return (dx + dy) <= 1.0f;
}

static bool PointInEllipse(Vector2 p, Rectangle r) {
    float cx = r.x + r.width * 0.5f;
    float cy = r.y + r.height * 0.5f;
    float rx = r.width * 0.5f;
    float ry = r.height * 0.5f;
    if (rx <= 0 || ry <= 0) return false;
    float dx = (p.x - cx) / rx;
    float dy = (p.y - cy) / ry;
    return (dx * dx + dy * dy) <= 1.0f;
}

int Diagram_FindNodeAt(const Diagram *d, Vector2 worldPos) {
    // Check in reverse order so top-most node is selected
    for (int i = d->nodeCount - 1; i >= 0; i--) {
        const Node *n = &d->nodes[i];
        if (n->type == SHAPE_DECISION) {
            if (PointInDiamond(worldPos, n->bounds)) return n->id;
        } else if (n->type == SHAPE_TERMINATOR) {
            if (PointInEllipse(worldPos, n->bounds)) return n->id;
        } else {
            if (CheckCollisionPointRec(worldPos, n->bounds)) return n->id;
        }
    }
    return -1;
}

Vector2 Diagram_GetPortPosition(const Node *node, PortIndex port) {
    if (!node) return (Vector2){ 0, 0 };
    Rectangle r = node->bounds;
    switch (port) {
        case PORT_TOP:    return (Vector2){ r.x + r.width * 0.5f, r.y };
        case PORT_RIGHT:  return (Vector2){ r.x + r.width, r.y + r.height * 0.5f };
        case PORT_BOTTOM: return (Vector2){ r.x + r.width * 0.5f, r.y + r.height };
        case PORT_LEFT:   return (Vector2){ r.x, r.y + r.height * 0.5f };
        default:          return (Vector2){ r.x + r.width * 0.5f, r.y + r.height * 0.5f };
    }
}

PortIndex Diagram_GetClosestPort(const Node *from, const Node *to) {
    if (!from || !to) return PORT_RIGHT;
    Vector2 centerFrom = { from->bounds.x + from->bounds.width * 0.5f, from->bounds.y + from->bounds.height * 0.5f };
    Vector2 centerTo = { to->bounds.x + to->bounds.width * 0.5f, to->bounds.y + to->bounds.height * 0.5f };

    float dx = centerTo.x - centerFrom.x;
    float dy = centerTo.y - centerFrom.y;

    if (fabsf(dx) > fabsf(dy)) {
        return (dx > 0) ? PORT_RIGHT : PORT_LEFT;
    } else {
        return (dy > 0) ? PORT_BOTTOM : PORT_TOP;
    }
}

int Diagram_FindPortAt(const Diagram *d, Vector2 worldPos, int *outPortIndex) {
    const float PORT_RADIUS = 10.0f;
    for (int i = d->nodeCount - 1; i >= 0; i--) {
        const Node *n = &d->nodes[i];
        for (int p = 0; p < 4; p++) {
            Vector2 portPos = Diagram_GetPortPosition(n, (PortIndex)p);
            if (CheckCollisionPointCircle(worldPos, portPos, PORT_RADIUS)) {
                if (outPortIndex) *outPortIndex = p;
                return n->id;
            }
        }
    }
    return -1;
}

void Diagram_MoveSelectedNode(Diagram *d, Vector2 delta) {
    Node *n = Diagram_GetNode(d, d->selectedNodeId);
    if (!n) return;

    n->bounds.x += delta.x;
    n->bounds.y += delta.y;

    if (d->snapToGrid && d->gridSize > 0) {
        n->bounds.x = roundf(n->bounds.x / d->gridSize) * d->gridSize;
        n->bounds.y = roundf(n->bounds.y / d->gridSize) * d->gridSize;
    }
}

void Diagram_DuplicateSelectedNode(Diagram *d) {
    Node *orig = Diagram_GetNode(d, d->selectedNodeId);
    if (!orig) return;

    Node *dup = Diagram_AddNode(d, orig->type, orig->bounds.x + 30.0f, orig->bounds.y + 30.0f,
                               orig->bounds.width, orig->bounds.height, orig->text);
    if (dup) {
        dup->fillColor = orig->fillColor;
        dup->borderColor = orig->borderColor;
        dup->textColor = orig->textColor;
        d->selectedNodeId = dup->id;
        Diagram_SetToast(d, "Bloco duplicado");
    }
}

Connection* Diagram_AddConnection(Diagram *d, int fromId, int toId, PortIndex fromPort, PortIndex toPort, const char *label) {
    if (d->connectionCount >= MAX_CONNECTIONS) {
        Diagram_SetToast(d, "Limite máximo de conexões atingido");
        return NULL;
    }
    if (fromId == toId) return NULL; // No self loops for now

    // Check if already exists
    for (int i = 0; i < d->connectionCount; i++) {
        if (d->connections[i].fromNodeId == fromId && d->connections[i].toNodeId == toId) {
            return &d->connections[i];
        }
    }

    Connection *c = &d->connections[d->connectionCount++];
    memset(c, 0, sizeof(Connection));
    c->id = d->nextConnId++;
    c->fromNodeId = fromId;
    c->toNodeId = toId;
    c->fromPort = fromPort;
    c->toPort = toPort;
    c->color = (Color){ 148, 163, 184, 255 }; // Slate 400
    c->style = LINE_BEZIER;
    c->selected = false;
    if (label) {
        strncpy(c->label, label, MAX_LABEL_LEN - 1);
    } else {
        c->label[0] = '\0';
    }

    d->selectedConnId = c->id;
    d->selectedNodeId = -1;

    Diagram_PushHistory(d);
    Diagram_SetToast(d, "Conexão criada");
    return c;
}

Connection* Diagram_GetConnection(Diagram *d, int id) {
    if (id <= 0) return NULL;
    for (int i = 0; i < d->connectionCount; i++) {
        if (d->connections[i].id == id) return &d->connections[i];
    }
    return NULL;
}

bool Diagram_RemoveConnection(Diagram *d, int id) {
    int idx = -1;
    for (int i = 0; i < d->connectionCount; i++) {
        if (d->connections[i].id == id) {
            idx = i;
            break;
        }
    }
    if (idx == -1) return false;

    d->connections[idx] = d->connections[d->connectionCount - 1];
    d->connectionCount--;

    if (d->selectedConnId == id) d->selectedConnId = -1;
    if (d->hoveredConnId == id) d->hoveredConnId = -1;

    Diagram_PushHistory(d);
    Diagram_SetToast(d, "Conexão removida");
    return true;
}

static float DistancePointToSegment(Vector2 p, Vector2 a, Vector2 b) {
    float l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
    if (l2 == 0.0f) {
        return sqrtf((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
    }
    float t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    if (t < 0.0f) t = 0.0f;
    if (t > 1.0f) t = 1.0f;
    Vector2 proj = { a.x + t * (b.x - a.x), a.y + t * (b.y - a.y) };
    return sqrtf((p.x - proj.x) * (p.x - proj.x) + (p.y - proj.y) * (p.y - proj.y));
}

int Diagram_FindConnectionAt(const Diagram *d, Vector2 worldPos, float threshold) {
    for (int i = 0; i < d->connectionCount; i++) {
        const Connection *c = &d->connections[i];
        const Node *from = NULL;
        const Node *to = NULL;
        for (int n = 0; n < d->nodeCount; n++) {
            if (d->nodes[n].id == c->fromNodeId) from = &d->nodes[n];
            if (d->nodes[n].id == c->toNodeId) to = &d->nodes[n];
        }
        if (!from || !to) continue;

        PortIndex fp = (c->fromPort == PORT_AUTO) ? Diagram_GetClosestPort(from, to) : c->fromPort;
        PortIndex tp = (c->toPort == PORT_AUTO) ? Diagram_GetClosestPort(to, from) : c->toPort;

        Vector2 p1 = Diagram_GetPortPosition(from, fp);
        Vector2 p2 = Diagram_GetPortPosition(to, tp);

        // Amostragem ao longo da curva ou reta
        const int SAMPLES = 20;
        Vector2 prev = p1;
        float offset = fabsf(p2.x - p1.x) * 0.5f;
        if (offset < 40.0f) offset = 40.0f;

        Vector2 c1 = { p1.x + ((fp == PORT_RIGHT) ? offset : ((fp == PORT_LEFT) ? -offset : 0)),
                       p1.y + ((fp == PORT_BOTTOM) ? offset : ((fp == PORT_TOP) ? -offset : 0)) };
        Vector2 c2 = { p2.x + ((tp == PORT_RIGHT) ? offset : ((tp == PORT_LEFT) ? -offset : 0)),
                       p2.y + ((tp == PORT_BOTTOM) ? offset : ((tp == PORT_TOP) ? -offset : 0)) };

        for (int s = 1; s <= SAMPLES; s++) {
            float t = (float)s / (float)SAMPLES;
            float it = 1.0f - t;
            Vector2 curr = {
                it * it * it * p1.x + 3 * it * it * t * c1.x + 3 * it * t * t * c2.x + t * t * t * p2.x,
                it * it * it * p1.y + 3 * it * it * t * c1.y + 3 * it * t * t * c2.y + t * t * t * p2.y
            };

            if (DistancePointToSegment(worldPos, prev, curr) <= threshold) {
                return c->id;
            }
            prev = curr;
        }
    }
    return -1;
}

Rectangle Diagram_GetBoundingBox(const Diagram *d, float padding) {
    if (d->nodeCount == 0) {
        return (Rectangle){ 0, 0, 800, 600 };
    }

    float minX = 1e9f, minY = 1e9f;
    float maxX = -1e9f, maxY = -1e9f;

    for (int i = 0; i < d->nodeCount; i++) {
        const Node *n = &d->nodes[i];
        if (n->bounds.x < minX) minX = n->bounds.x;
        if (n->bounds.y < minY) minY = n->bounds.y;
        if (n->bounds.x + n->bounds.width > maxX) maxX = n->bounds.x + n->bounds.width;
        if (n->bounds.y + n->bounds.height > maxY) maxY = n->bounds.y + n->bounds.height;
    }

    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    return (Rectangle){ minX, minY, maxX - minX, maxY - minY };
}

void Diagram_SetToast(Diagram *d, const char *msg) {
    if (!msg) return;
    strncpy(d->toastMessage, msg, sizeof(d->toastMessage) - 1);
    d->toastTimer = 2.5f; // Mostra por 2.5 segundos
}

void Diagram_UpdateToast(Diagram *d, float dt) {
    if (d->toastTimer > 0.0f) {
        d->toastTimer -= dt;
        if (d->toastTimer < 0.0f) d->toastTimer = 0.0f;
    }
}

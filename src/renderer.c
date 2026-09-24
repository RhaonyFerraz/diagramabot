#include "renderer.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

void Renderer_Init(void) {
    // Recursos futuros como fontes personalizadas podem ser carregados aqui
}

void Renderer_Shutdown(void) {
}

void Renderer_DrawGrid(const Camera2D *camera, float gridSize, int screenWidth, int screenHeight) {
    if (gridSize <= 4.0f) gridSize = 20.0f;

    Vector2 tl = GetScreenToWorld2D((Vector2){ 0, 0 }, *camera);
    Vector2 br = GetScreenToWorld2D((Vector2){ (float)screenWidth, (float)screenHeight }, *camera);

    float effectiveGrid = gridSize;
    while (effectiveGrid * camera->zoom < 14.0f) {
        effectiveGrid *= 2.0f; // Escala adaptativa para não poluir em zoom distante
    }

    float startX = floorf(tl.x / effectiveGrid) * effectiveGrid;
    float endX = ceilf(br.x / effectiveGrid) * effectiveGrid;
    float startY = floorf(tl.y / effectiveGrid) * effectiveGrid;
    float endY = ceilf(br.y / effectiveGrid) * effectiveGrid;

    Color dotColor = (Color){ 71, 85, 105, 90 }; // Slate escuro sutil
    float dotRadius = (camera->zoom < 0.8f) ? 1.0f : 1.5f;

    for (float x = startX; x <= endX; x += effectiveGrid) {
        for (float y = startY; y <= endY; y += effectiveGrid) {
            DrawCircleV((Vector2){ x, y }, dotRadius, dotColor);
        }
    }
}

void DrawArrowHead(Vector2 tip, Vector2 dir, float size, Color color) {
    float len = sqrtf(dir.x * dir.x + dir.y * dir.y);
    if (len < 0.0001f) return;
    dir.x /= len;
    dir.y /= len;

    Vector2 normal = { -dir.y, dir.x };
    Vector2 p1 = { tip.x - dir.x * size + normal.x * (size * 0.5f),
                   tip.y - dir.y * size + normal.y * (size * 0.5f) };
    Vector2 p2 = { tip.x - dir.x * size - normal.x * (size * 0.5f),
                   tip.y - dir.y * size - normal.y * (size * 0.5f) };

    DrawTriangle(tip, p2, p1, color);
}

void DrawWrappedText(const char *text, Rectangle bounds, int fontSize, Color color) {
    if (!text || text[0] == '\0') return;

    char buffer[MAX_TEXT_LEN];
    strncpy(buffer, text, MAX_TEXT_LEN - 1);
    buffer[MAX_TEXT_LEN - 1] = '\0';

    // Quebrar em linhas respeitando a largura
    char lines[10][64];
    int lineCount = 0;
    float maxLineWidth = bounds.width - 16.0f;
    if (maxLineWidth < 20.0f) maxLineWidth = 20.0f;

    char currentLine[64] = "";
    char *word = strtok(buffer, " \n");

    while (word && lineCount < 10) {
        char testLine[64];
        if (strlen(currentLine) == 0) {
            snprintf(testLine, sizeof(testLine), "%s", word);
        } else {
            snprintf(testLine, sizeof(testLine), "%s %s", currentLine, word);
        }

        int width = MeasureText(testLine, fontSize);
        if (width <= maxLineWidth) {
            strncpy(currentLine, testLine, sizeof(currentLine) - 1);
        } else {
            if (strlen(currentLine) > 0) {
                strncpy(lines[lineCount++], currentLine, sizeof(lines[0]) - 1);
            }
            strncpy(currentLine, word, sizeof(currentLine) - 1);
        }
        word = strtok(NULL, " \n");
    }

    if (strlen(currentLine) > 0 && lineCount < 10) {
        strncpy(lines[lineCount++], currentLine, sizeof(lines[0]) - 1);
    }

    // Desenhar linhas centralizadas
    float lineHeight = (float)fontSize + 4.0f;
    float totalHeight = (float)lineCount * lineHeight;
    float startY = bounds.y + (bounds.height - totalHeight) * 0.5f;

    for (int i = 0; i < lineCount; i++) {
        int textWidth = MeasureText(lines[i], fontSize);
        float textX = bounds.x + (bounds.width - (float)textWidth) * 0.5f;
        float textY = startY + (float)i * lineHeight;
        DrawText(lines[i], (int)textX, (int)textY, fontSize, color);
    }
}

static void DrawResizeHandles(Rectangle r) {
    Vector2 handles[8] = {
        { r.x, r.y },                                      // TL
        { r.x + r.width * 0.5f, r.y },                     // T
        { r.x + r.width, r.y },                            // TR
        { r.x + r.width, r.y + r.height * 0.5f },          // R
        { r.x + r.width, r.y + r.height },                 // BR
        { r.x + r.width * 0.5f, r.y + r.height },          // B
        { r.x, r.y + r.height },                           // BL
        { r.x, r.y + r.height * 0.5f }                     // L
    };

    const float HSIZE = 7.0f;
    for (int i = 0; i < 8; i++) {
        Rectangle hr = { handles[i].x - HSIZE * 0.5f, handles[i].y - HSIZE * 0.5f, HSIZE, HSIZE };
        DrawRectangleRec(hr, (Color){ 248, 250, 252, 255 });
        DrawRectangleLinesEx(hr, 1.5f, (Color){ 37, 99, 235, 255 });
    }
}

static void DrawPorts(const Node *node, int hoveredPortIndex) {
    const float PRADIUS = 6.0f;
    for (int p = 0; p < 4; p++) {
        Vector2 pos = Diagram_GetPortPosition(node, (PortIndex)p);
        bool isPortHovered = (p == hoveredPortIndex);

        if (isPortHovered) {
            DrawCircleV(pos, PRADIUS + 3.0f, (Color){ 59, 130, 246, 120 });
            DrawCircleV(pos, PRADIUS + 1.0f, (Color){ 96, 165, 250, 255 });
            DrawCircleV(pos, PRADIUS - 2.0f, WHITE);
        } else {
            DrawCircleV(pos, PRADIUS + 1.5f, (Color){ 15, 23, 42, 200 });
            DrawCircleV(pos, PRADIUS, (Color){ 59, 130, 246, 230 });
            DrawCircleV(pos, PRADIUS - 2.5f, WHITE);
        }
    }
}

void Renderer_DrawNode(const Node *node, bool isSelected, bool isHovered, bool showPorts, int hoveredPortIndex) {
    Rectangle r = node->bounds;

    // Sombra elegante
    Rectangle shadowRec = { r.x + 3.0f, r.y + 4.0f, r.width, r.height };
    Color shadowColor = (Color){ 0, 0, 0, 80 };

    // Realce de seleção ou hover
    Color border = node->borderColor;
    float bWidth = node->borderWidth;
    if (isSelected) {
        border = (Color){ 96, 165, 250, 255 }; // Azul vibrante de seleção
        bWidth = 3.0f;
        // Halo de seleção
        Rectangle haloRec = { r.x - 4.0f, r.y - 4.0f, r.width + 8.0f, r.height + 8.0f };
        DrawRectangleRoundedLinesEx(haloRec, 0.2f, 8, 2.0f, (Color){ 59, 130, 246, 120 });
    } else if (isHovered) {
        border = WHITE;
    }

    switch (node->type) {
        case SHAPE_PROCESS: {
            DrawRectangleRounded(shadowRec, 0.15f, 8, shadowColor);
            DrawRectangleRounded(r, 0.15f, 8, node->fillColor);
            DrawRectangleRoundedLinesEx(r, 0.15f, 8, bWidth, border);
            break;
        }

        case SHAPE_DECISION: {
            // Losango
            float cx = r.x + r.width * 0.5f;
            float cy = r.y + r.height * 0.5f;
            Vector2 pTop = { cx, r.y };
            Vector2 pRight = { r.x + r.width, cy };
            Vector2 pBottom = { cx, r.y + r.height };
            Vector2 pLeft = { r.x, cy };

            // Sombra
            Vector2 sTop = { pTop.x + 3.0f, pTop.y + 4.0f };
            Vector2 sRight = { pRight.x + 3.0f, pRight.y + 4.0f };
            Vector2 sBottom = { pBottom.x + 3.0f, pBottom.y + 4.0f };
            Vector2 sLeft = { pLeft.x + 3.0f, pLeft.y + 4.0f };
            DrawTriangle(sTop, sLeft, sRight, shadowColor);
            DrawTriangle(sLeft, sBottom, sRight, shadowColor);

            // Preenchimento
            DrawTriangle(pTop, pLeft, pRight, node->fillColor);
            DrawTriangle(pLeft, pBottom, pRight, node->fillColor);

            // Borda
            DrawLineEx(pTop, pRight, bWidth, border);
            DrawLineEx(pRight, pBottom, bWidth, border);
            DrawLineEx(pBottom, pLeft, bWidth, border);
            DrawLineEx(pLeft, pTop, bWidth, border);
            break;
        }

        case SHAPE_TERMINATOR: {
            // Pílula / Oval
            DrawRectangleRounded(shadowRec, 0.5f, 16, shadowColor);
            DrawRectangleRounded(r, 0.5f, 16, node->fillColor);
            DrawRectangleRoundedLinesEx(r, 0.5f, 16, bWidth, border);
            break;
        }

        case SHAPE_DATA: {
            // Paralelogramo (Entrada / Saída)
            float slant = r.width * 0.18f;
            Vector2 p1 = { r.x + slant, r.y };
            Vector2 p2 = { r.x + r.width, r.y };
            Vector2 p3 = { r.x + r.width - slant, r.y + r.height };
            Vector2 p4 = { r.x, r.y + r.height };

            // Preenchimento
            DrawTriangle(p1, p4, p2, node->fillColor);
            DrawTriangle(p4, p3, p2, node->fillColor);

            // Borda
            DrawLineEx(p1, p2, bWidth, border);
            DrawLineEx(p2, p3, bWidth, border);
            DrawLineEx(p3, p4, bWidth, border);
            DrawLineEx(p4, p1, bWidth, border);
            break;
        }

        case SHAPE_DATABASE: {
            // Cilindro
            float ellipseH = r.height * 0.22f;
            Rectangle body = { r.x, r.y + ellipseH * 0.5f, r.width, r.height - ellipseH };

            // Corpo
            DrawRectangleRec(shadowRec, shadowColor);
            DrawRectangleRec(body, node->fillColor);
            DrawLineEx((Vector2){ r.x, r.y + ellipseH * 0.5f }, (Vector2){ r.x, r.y + r.height - ellipseH * 0.5f }, bWidth, border);
            DrawLineEx((Vector2){ r.x + r.width, r.y + ellipseH * 0.5f }, (Vector2){ r.x + r.width, r.y + r.height - ellipseH * 0.5f }, bWidth, border);

            // Base elíptica
            DrawEllipse((int)(r.x + r.width * 0.5f), (int)(r.y + r.height - ellipseH * 0.5f), r.width * 0.5f, ellipseH * 0.5f, node->fillColor);
            DrawEllipseLines((int)(r.x + r.width * 0.5f), (int)(r.y + r.height - ellipseH * 0.5f), r.width * 0.5f, ellipseH * 0.5f, border);

            // Topo elíptico
            Color topShade = (Color){ (unsigned char)(node->fillColor.r * 1.15f > 255 ? 255 : node->fillColor.r * 1.15f),
                                      (unsigned char)(node->fillColor.g * 1.15f > 255 ? 255 : node->fillColor.g * 1.15f),
                                      (unsigned char)(node->fillColor.b * 1.15f > 255 ? 255 : node->fillColor.b * 1.15f), 255 };
            DrawEllipse((int)(r.x + r.width * 0.5f), (int)(r.y + ellipseH * 0.5f), r.width * 0.5f, ellipseH * 0.5f, topShade);
            DrawEllipseLines((int)(r.x + r.width * 0.5f), (int)(r.y + ellipseH * 0.5f), r.width * 0.5f, ellipseH * 0.5f, border);
            break;
        }

        case SHAPE_SUBPROCESS: {
            DrawRectangleRounded(shadowRec, 0.12f, 8, shadowColor);
            DrawRectangleRounded(r, 0.12f, 8, node->fillColor);
            DrawRectangleRoundedLinesEx(r, 0.12f, 8, bWidth, border);
            // Barras verticais internas
            float inset = 16.0f;
            DrawLineEx((Vector2){ r.x + inset, r.y }, (Vector2){ r.x + inset, r.y + r.height }, 1.5f, border);
            DrawLineEx((Vector2){ r.x + r.width - inset, r.y }, (Vector2){ r.x + r.width - inset, r.y + r.height }, 1.5f, border);
            break;
        }

        case SHAPE_NOTE: {
            // Nota adesiva com dobra no canto inferior direito
            float fold = 20.0f;
            Vector2 p1 = { r.x, r.y };
            Vector2 p2 = { r.x + r.width, r.y };
            Vector2 p3 = { r.x + r.width, r.y + r.height - fold };
            Vector2 p4 = { r.x + r.width - fold, r.y + r.height };
            Vector2 p5 = { r.x, r.y + r.height };

            // Preenchimento
            DrawRectangleRec((Rectangle){ r.x, r.y, r.width - fold, r.height }, node->fillColor);
            DrawRectangleRec((Rectangle){ r.x + r.width - fold, r.y, fold, r.height - fold }, node->fillColor);
            DrawTriangle((Vector2){ r.x + r.width - fold, r.y + r.height }, (Vector2){ r.x + r.width - fold, r.y + r.height - fold }, p4, node->fillColor);

            // Triângulo da dobra
            Color foldColor = (Color){ (unsigned char)(node->fillColor.r * 0.75f),
                                       (unsigned char)(node->fillColor.g * 0.75f),
                                       (unsigned char)(node->fillColor.b * 0.75f), 255 };
            DrawTriangle((Vector2){ r.x + r.width - fold, r.y + r.height }, (Vector2){ r.x + r.width - fold, r.y + r.height - fold }, p3, foldColor);

            // Borda
            DrawLineEx(p1, p2, bWidth, border);
            DrawLineEx(p2, p3, bWidth, border);
            DrawLineEx(p3, (Vector2){ r.x + r.width - fold, r.y + r.height - fold }, bWidth, border);
            DrawLineEx((Vector2){ r.x + r.width - fold, r.y + r.height - fold }, p4, bWidth, border);
            DrawLineEx(p4, p5, bWidth, border);
            DrawLineEx(p5, p1, bWidth, border);
            break;
        }

        default: {
            DrawRectangleRounded(r, 0.15f, 8, node->fillColor);
            DrawRectangleRoundedLinesEx(r, 0.15f, 8, bWidth, border);
            break;
        }
    }

    // Texto centralizado
    DrawWrappedText(node->text, r, 16, node->textColor);

    // Portas de conexão
    if (showPorts || isHovered || isSelected) {
        DrawPorts(node, hoveredPortIndex);
    }

    // Handles de redimensionamento
    if (isSelected) {
        DrawResizeHandles(r);
    }
}

static Vector2 GetPortNormal(PortIndex port) {
    switch (port) {
        case PORT_TOP:    return (Vector2){ 0, -1 };
        case PORT_RIGHT:  return (Vector2){ 1, 0 };
        case PORT_BOTTOM: return (Vector2){ 0, 1 };
        case PORT_LEFT:   return (Vector2){ -1, 0 };
        default:          return (Vector2){ 1, 0 };
    }
}

void Renderer_DrawConnection(const Connection *conn, const Node *from, const Node *to, bool isSelected, bool isHovered) {
    if (!from || !to) return;

    PortIndex fp = (conn->fromPort == PORT_AUTO) ? Diagram_GetClosestPort(from, to) : conn->fromPort;
    PortIndex tp = (conn->toPort == PORT_AUTO) ? Diagram_GetClosestPort(to, from) : conn->toPort;

    Vector2 p1 = Diagram_GetPortPosition(from, fp);
    Vector2 p2 = Diagram_GetPortPosition(to, tp);

    Vector2 n1 = GetPortNormal(fp);
    Vector2 n2 = GetPortNormal(tp);

    float dx = p2.x - p1.x;
    float dy = p2.y - p1.y;
    float dist = sqrtf(dx * dx + dy * dy);
    float handleDist = dist * 0.45f;
    if (handleDist < 45.0f) handleDist = 45.0f;

    Vector2 c1 = { p1.x + n1.x * handleDist, p1.y + n1.y * handleDist };
    Vector2 c2 = { p2.x + n2.x * handleDist, p2.y + n2.y * handleDist };

    Color lineColor = conn->color;
    float lineThick = 2.5f;

    if (isSelected) {
        lineColor = (Color){ 96, 165, 250, 255 };
        lineThick = 3.5f;
        DrawSplineSegmentBezierCubic(p1, c1, c2, p2, 7.0f, (Color){ 59, 130, 246, 90 });
    } else if (isHovered) {
        lineColor = WHITE;
        lineThick = 3.0f;
    }

    // Traçado da curva
    DrawSplineSegmentBezierCubic(p1, c1, c2, p2, lineThick, lineColor);

    // Ponta da flecha
    Vector2 arrowDir = { p2.x - c2.x, p2.y - c2.y };
    DrawArrowHead(p2, arrowDir, 14.0f, lineColor);

    // Rótulo da conexão (Badge no meio da curva)
    if (strlen(conn->label) > 0) {
        Vector2 mid = GetSplinePointBezierCubic(p1, c1, c2, p2, 0.5f);
        int textWidth = MeasureText(conn->label, 14);
        Rectangle badgeRec = { mid.x - (float)textWidth * 0.5f - 8.0f, mid.y - 12.0f, (float)textWidth + 16.0f, 24.0f };

        DrawRectangleRounded(badgeRec, 0.5f, 6, (Color){ 24, 24, 27, 240 });
        DrawRectangleRoundedLinesEx(badgeRec, 0.5f, 6, 1.5f, lineColor);
        DrawText(conn->label, (int)(badgeRec.x + 8.0f), (int)(badgeRec.y + 5.0f), 14, WHITE);
    }
}

void Renderer_DrawConnectionDraft(Vector2 fromPos, Vector2 toPos, PortIndex fromPort, PortIndex toPort) {
    Vector2 n1 = GetPortNormal(fromPort);
    Vector2 n2 = GetPortNormal(toPort);

    float dx = toPos.x - fromPos.x;
    float dy = toPos.y - fromPos.y;
    float dist = sqrtf(dx * dx + dy * dy);
    float handleDist = dist * 0.45f;
    if (handleDist < 45.0f) handleDist = 45.0f;

    Vector2 c1 = { fromPos.x + n1.x * handleDist, fromPos.y + n1.y * handleDist };
    Vector2 c2 = { toPos.x + n2.x * handleDist, toPos.y + n2.y * handleDist };

    Color draftColor = (Color){ 96, 165, 250, 220 };
    DrawSplineSegmentBezierCubic(fromPos, c1, c2, toPos, 2.5f, draftColor);
    DrawArrowHead(toPos, (Vector2){ toPos.x - c2.x, toPos.y - c2.y }, 14.0f, draftColor);
}

void Renderer_DrawSelectionBox(Vector2 start, Vector2 end) {
    float x = fminf(start.x, end.x);
    float y = fminf(start.y, end.y);
    float w = fabsf(start.x - end.x);
    float h = fabsf(start.y - end.y);
    Rectangle rec = { x, y, w, h };

    DrawRectangleRec(rec, (Color){ 59, 130, 246, 35 });
    DrawRectangleLinesEx(rec, 1.5f, (Color){ 96, 165, 250, 180 });
}

void Renderer_DrawDiagram(const Diagram *diagram, const Camera2D *camera) {
    (void)camera;

    // 1. Desenhar conexões primeiro (atrás dos nós)
    for (int i = 0; i < diagram->connectionCount; i++) {
        const Connection *c = &diagram->connections[i];
        const Node *from = NULL;
        const Node *to = NULL;
        for (int n = 0; n < diagram->nodeCount; n++) {
            if (diagram->nodes[n].id == c->fromNodeId) from = &diagram->nodes[n];
            if (diagram->nodes[n].id == c->toNodeId) to = &diagram->nodes[n];
        }
        bool isSel = (diagram->selectedConnId == c->id);
        bool isHov = (diagram->hoveredConnId == c->id);
        Renderer_DrawConnection(c, from, to, isSel, isHov);
    }

    // 2. Conexão em criação (Draft)
    if (diagram->dragState == DRAG_STATE_CONNECTING) {
        const Node *startNode = NULL;
        for (int n = 0; n < diagram->nodeCount; n++) {
            if (diagram->nodes[n].id == diagram->connectStartNodeId) {
                startNode = &diagram->nodes[n];
                break;
            }
        }
        if (startNode) {
            Vector2 p1 = Diagram_GetPortPosition(startNode, diagram->connectStartPort);
            PortIndex endPort = PORT_LEFT;
            if (diagram->hoveredPortIndex != -1) {
                endPort = (PortIndex)diagram->hoveredPortIndex;
            }
            Renderer_DrawConnectionDraft(p1, diagram->connectTargetPos, diagram->connectStartPort, endPort);
        }
    }

    // 3. Desenhar nós
    for (int i = 0; i < diagram->nodeCount; i++) {
        const Node *n = &diagram->nodes[i];
        bool isSel = (diagram->selectedNodeId == n->id);
        bool isHov = (diagram->hoveredNodeId == n->id);
        bool showPorts = (diagram->dragState == DRAG_STATE_CONNECTING || isHov || isSel);
        int hoveredPort = (diagram->hoveredPortNodeId == n->id) ? diagram->hoveredPortIndex : -1;

        Renderer_DrawNode(n, isSel, isHov, showPorts, hoveredPort);
    }

    // 4. Caixa de seleção múltipla
    if (diagram->dragState == DRAG_STATE_BOX_SELECT) {
        Renderer_DrawSelectionBox(diagram->dragStartPos, diagram->dragCurrentPos);
    }
}

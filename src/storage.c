#include "storage.h"
#include "renderer.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

bool Storage_SaveDiagram(const Diagram *d, const char *filepath) {
    FILE *f = fopen(filepath, "w");
    if (!f) return false;

    fprintf(f, "# DIAGRAMABOT FILE V1\n");
    fprintf(f, "CONFIG %d %.1f %d\n", d->snapToGrid ? 1 : 0, d->gridSize, d->showGrid ? 1 : 0);
    fprintf(f, "NODES %d\n", d->nodeCount);

    for (int i = 0; i < d->nodeCount; i++) {
        const Node *n = &d->nodes[i];
        fprintf(f, "NODE %d %d %.1f %.1f %.1f %.1f %d %d %d %d %d %d |%s\n",
            n->id, (int)n->type,
            n->bounds.x, n->bounds.y, n->bounds.width, n->bounds.height,
            n->fillColor.r, n->fillColor.g, n->fillColor.b,
            n->borderColor.r, n->borderColor.g, n->borderColor.b,
            n->text);
    }

    fprintf(f, "CONNECTIONS %d\n", d->connectionCount);
    for (int i = 0; i < d->connectionCount; i++) {
        const Connection *c = &d->connections[i];
        fprintf(f, "CONN %d %d %d %d %d %d %d %d %d |%s\n",
            c->id, c->fromNodeId, c->toNodeId,
            (int)c->fromPort, (int)c->toPort, (int)c->style,
            c->color.r, c->color.g, c->color.b,
            c->label);
    }

    fclose(f);
    return true;
}

bool Storage_LoadDiagram(Diagram *d, const char *filepath) {
    FILE *f = fopen(filepath, "r");
    if (!f) return false;

    char line[512];
    if (!fgets(line, sizeof(line), f)) { fclose(f); return false; }
    if (strncmp(line, "# DIAGRAMABOT", 13) != 0) {
        fclose(f);
        return false;
    }

    Diagram_Clear(d);

    while (fgets(line, sizeof(line), f)) {
        if (strncmp(line, "CONFIG", 6) == 0) {
            int snap = 1, show = 1;
            float grid = 20.0f;
            sscanf(line, "CONFIG %d %f %d", &snap, &grid, &show);
            d->snapToGrid = (snap != 0);
            d->gridSize = grid;
            d->showGrid = (show != 0);
        } else if (strncmp(line, "NODE ", 5) == 0) {
            if (d->nodeCount >= MAX_NODES) continue;
            Node *n = &d->nodes[d->nodeCount++];
            memset(n, 0, sizeof(Node));

            int id = 0, type = 0;
            float x = 0, y = 0, w = 100, h = 60;
            int fr = 37, fg = 99, fb = 235;
            int br = 147, bg = 197, bb = 253;

            char *pipe = strchr(line, '|');
            if (pipe) {
                *pipe = '\0';
                char *text = pipe + 1;
                // remover quebra de linha
                size_t len = strlen(text);
                if (len > 0 && (text[len - 1] == '\n' || text[len - 1] == '\r')) text[len - 1] = '\0';
                if (len > 1 && (text[len - 2] == '\n' || text[len - 2] == '\r')) text[len - 2] = '\0';
                strncpy(n->text, text, MAX_TEXT_LEN - 1);
            }

            sscanf(line, "NODE %d %d %f %f %f %f %d %d %d %d %d %d",
                &id, &type, &x, &y, &w, &h, &fr, &fg, &fb, &br, &bg, &bb);

            n->id = id;
            n->type = (ShapeType)type;
            n->bounds = (Rectangle){ x, y, w, h };
            n->fillColor = (Color){ (unsigned char)fr, (unsigned char)fg, (unsigned char)fb, 230 };
            n->borderColor = (Color){ (unsigned char)br, (unsigned char)bg, (unsigned char)bb, 255 };
            n->textColor = RAYWHITE;
            n->borderWidth = 2.0f;

            if (id >= d->nextNodeId) d->nextNodeId = id + 1;
        } else if (strncmp(line, "CONN ", 5) == 0) {
            if (d->connectionCount >= MAX_CONNECTIONS) continue;
            Connection *c = &d->connections[d->connectionCount++];
            memset(c, 0, sizeof(Connection));

            int id = 0, fromId = 0, toId = 0, fp = 0, tp = 0, st = 0;
            int cr = 148, cg = 163, cb = 184;

            char *pipe = strchr(line, '|');
            if (pipe) {
                *pipe = '\0';
                char *label = pipe + 1;
                size_t len = strlen(label);
                if (len > 0 && (label[len - 1] == '\n' || label[len - 1] == '\r')) label[len - 1] = '\0';
                if (len > 1 && (label[len - 2] == '\n' || label[len - 2] == '\r')) label[len - 2] = '\0';
                strncpy(c->label, label, MAX_LABEL_LEN - 1);
            }

            sscanf(line, "CONN %d %d %d %d %d %d %d %d %d",
                &id, &fromId, &toId, &fp, &tp, &st, &cr, &cg, &cb);

            c->id = id;
            c->fromNodeId = fromId;
            c->toNodeId = toId;
            c->fromPort = (PortIndex)fp;
            c->toPort = (PortIndex)tp;
            c->style = (LineStyle)st;
            c->color = (Color){ (unsigned char)cr, (unsigned char)cg, (unsigned char)cb, 255 };

            if (id >= d->nextConnId) d->nextConnId = id + 1;
        }
    }

    fclose(f);
    d->selectedNodeId = -1;
    d->selectedConnId = -1;
    d->historyIndex = -1;
    d->historyCount = 0;
    Diagram_PushHistory(d);
    return true;
}

bool Storage_ExportPNG(const Diagram *d, const char *filepath) {
    if (d->nodeCount == 0) return false;

    Rectangle bounds = Diagram_GetBoundingBox(d, 80.0f);
    int texWidth = (int)ceilf(bounds.width);
    int texHeight = (int)ceilf(bounds.height);

    if (texWidth < 200) texWidth = 200;
    if (texHeight < 200) texHeight = 200;
    if (texWidth > 4096) texWidth = 4096;
    if (texHeight > 4096) texHeight = 4096;

    RenderTexture2D target = LoadRenderTexture(texWidth, texHeight);
    BeginTextureMode(target);

    // Fundo elegante de exportação
    ClearBackground((Color){ 18, 19, 22, 255 });

    // Grid sutil no fundo
    for (float x = 0; x < texWidth; x += 20.0f) {
        for (float y = 0; y < texHeight; y += 20.0f) {
            DrawCircleV((Vector2){ x, y }, 1.0f, (Color){ 71, 85, 105, 50 });
        }
    }

    // Desenhar conexões com deslocamento
    for (int i = 0; i < d->connectionCount; i++) {
        const Connection *c = &d->connections[i];
        Node fromCopy, toCopy;
        bool foundFrom = false, foundTo = false;

        for (int n = 0; n < d->nodeCount; n++) {
            if (d->nodes[n].id == c->fromNodeId) {
                fromCopy = d->nodes[n];
                fromCopy.bounds.x -= bounds.x;
                fromCopy.bounds.y -= bounds.y;
                foundFrom = true;
            }
            if (d->nodes[n].id == c->toNodeId) {
                toCopy = d->nodes[n];
                toCopy.bounds.x -= bounds.x;
                toCopy.bounds.y -= bounds.y;
                foundTo = true;
            }
        }

        if (foundFrom && foundTo) {
            Renderer_DrawConnection(c, &fromCopy, &toCopy, false, false);
        }
    }

    // Desenhar nós com deslocamento
    for (int i = 0; i < d->nodeCount; i++) {
        Node nodeCopy = d->nodes[i];
        nodeCopy.bounds.x -= bounds.x;
        nodeCopy.bounds.y -= bounds.y;
        Renderer_DrawNode(&nodeCopy, false, false, false, -1);
    }

    // Marca d'água discreta
    DrawText("DiagramaBot", 20, texHeight - 30, 16, (Color){ 100, 116, 139, 150 });

    EndTextureMode();

    Image img = LoadImageFromTexture(target.texture);
    ImageFlipVertical(&img); // Inverter verticalmente devido ao OpenGL
    bool success = ExportImage(img, filepath);

    UnloadImage(img);
    UnloadRenderTexture(target);

    return success;
}

static Vector2 PortPositionInBounds(Rectangle r, PortIndex port) {
    switch (port) {
        case PORT_TOP:    return (Vector2){ r.x + r.width * 0.5f, r.y };
        case PORT_RIGHT:  return (Vector2){ r.x + r.width, r.y + r.height * 0.5f };
        case PORT_BOTTOM: return (Vector2){ r.x + r.width * 0.5f, r.y + r.height };
        case PORT_LEFT:   return (Vector2){ r.x, r.y + r.height * 0.5f };
        default:          return (Vector2){ r.x + r.width * 0.5f, r.y + r.height * 0.5f };
    }
}

static Vector2 PortNormalSVG(PortIndex port) {
    switch (port) {
        case PORT_TOP:    return (Vector2){ 0, -1 };
        case PORT_RIGHT:  return (Vector2){ 1, 0 };
        case PORT_BOTTOM: return (Vector2){ 0, 1 };
        case PORT_LEFT:   return (Vector2){ -1, 0 };
        default:          return (Vector2){ 1, 0 };
    }
}

bool Storage_ExportSVG(const Diagram *d, const char *filepath) {
    if (d->nodeCount == 0) return false;

    FILE *f = fopen(filepath, "w");
    if (!f) return false;

    Rectangle bounds = Diagram_GetBoundingBox(d, 60.0f);
    float width = bounds.width;
    float height = bounds.height;

    fprintf(f, "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n");
    fprintf(f, "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"%.1f\" height=\"%.1f\" viewBox=\"0 0 %.1f %.1f\">\n",
        width, height, width, height);

    // Definições de marcadores (setas) e estilos
    fprintf(f, "  <defs>\n");
    fprintf(f, "    <marker id=\"arrow\" viewBox=\"0 0 10 10\" refX=\"8\" refY=\"5\" markerWidth=\"6\" markerHeight=\"6\" orient=\"auto-start-reverse\">\n");
    fprintf(f, "      <path d=\"M 0 1.5 L 10 5 L 0 8.5 z\" fill=\"#94a3b8\" />\n");
    fprintf(f, "    </marker>\n");
    fprintf(f, "  </defs>\n");

    // Fundo
    fprintf(f, "  <rect width=\"100%%\" height=\"100%%\" fill=\"#121316\" />\n");

    // Conexões
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

        Rectangle rFrom = { from->bounds.x - bounds.x, from->bounds.y - bounds.y, from->bounds.width, from->bounds.height };
        Rectangle rTo = { to->bounds.x - bounds.x, to->bounds.y - bounds.y, to->bounds.width, to->bounds.height };

        Vector2 p1 = PortPositionInBounds(rFrom, fp);
        Vector2 p2 = PortPositionInBounds(rTo, tp);

        Vector2 n1 = PortNormalSVG(fp);
        Vector2 n2 = PortNormalSVG(tp);

        float dist = sqrtf((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
        float hDist = dist * 0.45f;
        if (hDist < 40.0f) hDist = 40.0f;

        Vector2 c1 = { p1.x + n1.x * hDist, p1.y + n1.y * hDist };
        Vector2 c2 = { p2.x + n2.x * hDist, p2.y + n2.y * hDist };

        fprintf(f, "  <path d=\"M %.1f %.1f C %.1f %.1f, %.1f %.1f, %.1f %.1f\" fill=\"none\" stroke=\"rgb(%d,%d,%d)\" stroke-width=\"2.5\" marker-end=\"url(#arrow)\" />\n",
            p1.x, p1.y, c1.x, c1.y, c2.x, c2.y, p2.x, p2.y,
            c->color.r, c->color.g, c->color.b);

        if (strlen(c->label) > 0) {
            float midX = 0.125f * p1.x + 0.375f * c1.x + 0.375f * c2.x + 0.125f * p2.x;
            float midY = 0.125f * p1.y + 0.375f * c1.y + 0.375f * c2.y + 0.125f * p2.y;
            fprintf(f, "  <text x=\"%.1f\" y=\"%.1f\" fill=\"#ffffff\" font-family=\"sans-serif\" font-size=\"12\" text-anchor=\"middle\" dominant-baseline=\"central\">%s</text>\n",
                midX, midY, c->label);
        }
    }

    // Nós
    for (int i = 0; i < d->nodeCount; i++) {
        const Node *n = &d->nodes[i];
        float x = n->bounds.x - bounds.x;
        float y = n->bounds.y - bounds.y;
        float w = n->bounds.width;
        float h = n->bounds.height;

        char fillStyle[64], strokeStyle[64];
        snprintf(fillStyle, sizeof(fillStyle), "rgb(%d,%d,%d)", n->fillColor.r, n->fillColor.g, n->fillColor.b);
        snprintf(strokeStyle, sizeof(strokeStyle), "rgb(%d,%d,%d)", n->borderColor.r, n->borderColor.g, n->borderColor.b);

        if (n->type == SHAPE_DECISION) {
            float cx = x + w * 0.5f;
            float cy = y + h * 0.5f;
            fprintf(f, "  <polygon points=\"%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f\" fill=\"%s\" stroke=\"%s\" stroke-width=\"2\" />\n",
                cx, y, x + w, cy, cx, y + h, x, cy, fillStyle, strokeStyle);
        } else if (n->type == SHAPE_DATA) {
            float slant = w * 0.18f;
            fprintf(f, "  <polygon points=\"%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f\" fill=\"%s\" stroke=\"%s\" stroke-width=\"2\" />\n",
                x + slant, y, x + w, y, x + w - slant, y + h, x, y + h, fillStyle, strokeStyle);
        } else {
            float rx = (n->type == SHAPE_TERMINATOR) ? (h * 0.5f) : 8.0f;
            fprintf(f, "  <rect x=\"%.1f\" y=\"%.1f\" width=\"%.1f\" height=\"%.1f\" rx=\"%.1f\" fill=\"%s\" stroke=\"%s\" stroke-width=\"2\" />\n",
                x, y, w, h, rx, fillStyle, strokeStyle);
        }

        // Texto
        fprintf(f, "  <text x=\"%.1f\" y=\"%.1f\" fill=\"#ffffff\" font-family=\"sans-serif\" font-size=\"14\" font-weight=\"500\" text-anchor=\"middle\" dominant-baseline=\"central\">%s</text>\n",
            x + w * 0.5f, y + h * 0.5f, n->text);
    }

    fprintf(f, "</svg>\n");
    fclose(f);
    return true;
}

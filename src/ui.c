#include "ui.h"
#include "storage.h"
#include "templates.h"
#include <stdio.h>
#include <string.h>
#include <math.h>

// Cores do Tema Dark Moderno
static const Color COLOR_BG_NAVBAR     = { 18, 20, 24, 255 };  // Zinc 950
static const Color COLOR_BG_SIDEBAR    = { 24, 27, 32, 255 };  // Zinc 900
static const Color COLOR_BG_PANEL      = { 30, 34, 42, 255 };  // Zinc 800
static const Color COLOR_BORDER        = { 45, 52, 64, 255 };  // Slate 700
static const Color COLOR_TEXT_PRIMARY  = { 248, 250, 252, 255 };
static const Color COLOR_TEXT_MUTED    = { 148, 163, 184, 255 };
static const Color COLOR_ACCENT        = { 37, 99, 235, 255 };  // Blue 600
static const Color COLOR_ACCENT_HOVER  = { 59, 130, 246, 255 }; // Blue 500
static const Color COLOR_DANGER        = { 225, 29, 72, 255 };  // Rose 600

void UI_Init(UIState *ui) {
    ui->currentTool = TOOL_SELECT;
    ui->showHelpModal = false;
    ui->showExampleMenu = false;
    ui->screenWidth = 1280;
    ui->screenHeight = 720;
}

bool UI_IsMouseOverUI(const UIState *ui, Vector2 mousePos, int width, int height) {
    if (ui->showHelpModal) return true;

    // Top Bar
    if (mousePos.y >= 0 && mousePos.y <= TOPBAR_HEIGHT) return true;

    // Bottom Status Bar
    if (mousePos.y >= height - STATUSBAR_HEIGHT && mousePos.y <= height) return true;

    // Left Sidebar
    if (mousePos.x >= 0 && mousePos.x <= SIDEBAR_LEFT_WIDTH &&
        mousePos.y > TOPBAR_HEIGHT && mousePos.y < height - STATUSBAR_HEIGHT) return true;

    // Right Sidebar
    if (mousePos.x >= width - SIDEBAR_RIGHT_WIDTH && mousePos.x <= width &&
        mousePos.y > TOPBAR_HEIGHT && mousePos.y < height - STATUSBAR_HEIGHT) return true;

    return false;
}

static bool DrawUIButton(Rectangle rec, const char *text, bool active, Color normalColor) {
    Vector2 mouse = GetMousePosition();
    bool hovered = CheckCollisionPointRec(mouse, rec);
    bool clicked = hovered && IsMouseButtonPressed(MOUSE_BUTTON_LEFT);

    Color bg = normalColor;
    if (active) bg = COLOR_ACCENT;
    else if (hovered) bg = (Color){ (unsigned char)(normalColor.r + 25 > 255 ? 255 : normalColor.r + 25),
                                    (unsigned char)(normalColor.g + 25 > 255 ? 255 : normalColor.g + 25),
                                    (unsigned char)(normalColor.b + 25 > 255 ? 255 : normalColor.b + 25), 255 };

    DrawRectangleRounded(rec, 0.25f, 6, bg);
    DrawRectangleRoundedLinesEx(rec, 0.25f, 6, 1.0f, active ? COLOR_ACCENT_HOVER : COLOR_BORDER);

    int textW = MeasureText(text, 14);
    int textX = (int)(rec.x + (rec.width - (float)textW) * 0.5f);
    int textY = (int)(rec.y + (rec.height - 14.0f) * 0.5f);

    DrawText(text, textX, textY, 14, active ? WHITE : (hovered ? WHITE : COLOR_TEXT_PRIMARY));
    return clicked;
}

void UI_DrawTopBar(UIState *ui, Diagram *d, Camera2D *camera, int width) {
    Rectangle barRec = { 0, 0, (float)width, TOPBAR_HEIGHT };
    DrawRectangleRec(barRec, COLOR_BG_NAVBAR);
    DrawLineEx((Vector2){ 0, TOPBAR_HEIGHT }, (Vector2){ (float)width, TOPBAR_HEIGHT }, 1.5f, COLOR_BORDER);

    // Logo & Marca
    DrawRectangleRounded((Rectangle){ 14, 11, 32, 32 }, 0.3f, 6, COLOR_ACCENT);
    DrawText("D", 23, 17, 20, WHITE);
    DrawText("DiagramaBot", 54, 14, 18, COLOR_TEXT_PRIMARY);
    DrawText("C + Raylib", 55, 34, 10, COLOR_TEXT_MUTED);

    float btnX = 185.0f;
    float btnY = 11.0f;
    float btnH = 32.0f;

    // Arquivo: Novo, Salvar, Abrir
    if (DrawUIButton((Rectangle){ btnX, btnY, 65, btnH }, "Novo", false, COLOR_BG_PANEL)) {
        Diagram_Clear(d);
    }
    btnX += 70.0f;

    if (DrawUIButton((Rectangle){ btnX, btnY, 70, btnH }, "Salvar", false, COLOR_BG_PANEL)) {
        if (Storage_SaveDiagram(d, "diagrama.diag")) {
            Diagram_SetToast(d, "Salvo com sucesso em 'diagrama.diag'!");
        } else {
            Diagram_SetToast(d, "Erro ao salvar arquivo!");
        }
    }
    btnX += 75.0f;

    if (DrawUIButton((Rectangle){ btnX, btnY, 65, btnH }, "Abrir", false, COLOR_BG_PANEL)) {
        if (Storage_LoadDiagram(d, "diagrama.diag")) {
            Diagram_SetToast(d, "Carregado 'diagrama.diag'!");
        } else {
            Diagram_SetToast(d, "Arquivo 'diagrama.diag' não encontrado!");
        }
    }
    btnX += 75.0f;

    // Divisor vertical
    DrawLineEx((Vector2){ btnX, 14 }, (Vector2){ btnX, TOPBAR_HEIGHT - 14 }, 1.0f, COLOR_BORDER);
    btnX += 12.0f;

    // Exportações: PNG, SVG
    if (DrawUIButton((Rectangle){ btnX, btnY, 75, btnH }, "Exp. PNG", false, (Color){ 16, 185, 129, 200 })) {
        if (Storage_ExportPNG(d, "diagrama.png")) {
            Diagram_SetToast(d, "Exportado com sucesso: 'diagrama.png'!");
        } else {
            Diagram_SetToast(d, "Adicione blocos antes de exportar!");
        }
    }
    btnX += 80.0f;

    if (DrawUIButton((Rectangle){ btnX, btnY, 75, btnH }, "Exp. SVG", false, (Color){ 13, 148, 136, 200 })) {
        if (Storage_ExportSVG(d, "diagrama.svg")) {
            Diagram_SetToast(d, "Exportado com sucesso: 'diagrama.svg'!");
        } else {
            Diagram_SetToast(d, "Adicione blocos antes de exportar!");
        }
    }
    btnX += 85.0f;

    // Exemplos rápidos
    if (DrawUIButton((Rectangle){ btnX, btnY, 80, btnH }, "Exemplo 1", false, (Color){ 124, 58, 237, 200 })) {
        Templates_LoadDefaultFlowchart(d);
        camera->target = (Vector2){ 700, 360 };
        camera->zoom = 0.9f;
    }
    btnX += 85.0f;

    if (DrawUIButton((Rectangle){ btnX, btnY, 80, btnH }, "Exemplo 2", false, (Color){ 79, 70, 229, 200 })) {
        Templates_LoadSystemArchitecture(d);
        camera->target = (Vector2){ 500, 300 };
        camera->zoom = 0.95f;
    }

    // Lado Direito do Topbar: Undo, Redo, Zoom, Grid, Snap, Ajuda
    float rightX = (float)width - 45.0f;
    if (DrawUIButton((Rectangle){ rightX, btnY, 35, btnH }, "?", ui->showHelpModal, COLOR_BG_PANEL)) {
        ui->showHelpModal = !ui->showHelpModal;
    }
    rightX -= 42.0f;

    if (DrawUIButton((Rectangle){ rightX, btnY, 38, btnH }, "Snap", d->snapToGrid, COLOR_BG_PANEL)) {
        d->snapToGrid = !d->snapToGrid;
        Diagram_SetToast(d, d->snapToGrid ? "Snap to Grid ativado" : "Snap to Grid desativado");
    }
    rightX -= 42.0f;

    if (DrawUIButton((Rectangle){ rightX, btnY, 38, btnH }, "Grid", d->showGrid, COLOR_BG_PANEL)) {
        d->showGrid = !d->showGrid;
    }
    rightX -= 48.0f;

    // Reset Zoom / Fit
    if (DrawUIButton((Rectangle){ rightX, btnY, 44, btnH }, "100%", (camera->zoom == 1.0f), COLOR_BG_PANEL)) {
        camera->zoom = 1.0f;
    }
    rightX -= 34.0f;

    if (DrawUIButton((Rectangle){ rightX, btnY, 30, btnH }, "+", false, COLOR_BG_PANEL)) {
        camera->zoom = fminf(camera->zoom * 1.2f, 3.0f);
    }
    rightX -= 34.0f;

    if (DrawUIButton((Rectangle){ rightX, btnY, 30, btnH }, "-", false, COLOR_BG_PANEL)) {
        camera->zoom = fmaxf(camera->zoom / 1.2f, 0.2f);
    }
    rightX -= 45.0f;

    // Undo / Redo
    if (DrawUIButton((Rectangle){ rightX, btnY, 38, btnH }, "Redo", false, COLOR_BG_PANEL)) {
        Diagram_Redo(d);
    }
    rightX -= 45.0f;

    if (DrawUIButton((Rectangle){ rightX, btnY, 38, btnH }, "Undo", false, COLOR_BG_PANEL)) {
        Diagram_Undo(d);
    }
}

void UI_DrawLeftSidebar(UIState *ui, Diagram *d, const Camera2D *camera, int height) {
    Rectangle barRec = { 0, TOPBAR_HEIGHT, SIDEBAR_LEFT_WIDTH, (float)height - TOPBAR_HEIGHT - STATUSBAR_HEIGHT };
    DrawRectangleRec(barRec, COLOR_BG_SIDEBAR);
    DrawLineEx((Vector2){ SIDEBAR_LEFT_WIDTH, TOPBAR_HEIGHT }, (Vector2){ SIDEBAR_LEFT_WIDTH, (float)height - STATUSBAR_HEIGHT }, 1.5f, COLOR_BORDER);

    float curY = TOPBAR_HEIGHT + 14.0f;
    DrawText("MODOS & FERRAMENTAS", 16, (int)curY, 11, COLOR_TEXT_MUTED);
    curY += 22.0f;

    // Modo Selecionar
    if (DrawUIButton((Rectangle){ 14, curY, SIDEBAR_LEFT_WIDTH - 28, 34 }, "[V] Selecionar / Mover", ui->currentTool == TOOL_SELECT, COLOR_BG_PANEL)) {
        ui->currentTool = TOOL_SELECT;
    }
    curY += 38.0f;

    // Modo Conectar
    if (DrawUIButton((Rectangle){ 14, curY, SIDEBAR_LEFT_WIDTH - 28, 34 }, "[C] Criar Conexao", ui->currentTool == TOOL_CONNECT, COLOR_BG_PANEL)) {
        ui->currentTool = TOOL_CONNECT;
        Diagram_SetToast(d, "Modo Conexão: Arraste de uma porta a outra");
    }
    curY += 46.0f;

    DrawLineEx((Vector2){ 14, curY }, (Vector2){ SIDEBAR_LEFT_WIDTH - 14, curY }, 1.0f, COLOR_BORDER);
    curY += 12.0f;

    DrawText("ADICIONAR FORMAS", 16, (int)curY, 11, COLOR_TEXT_MUTED);
    curY += 22.0f;

    Vector2 screenCenter = { (float)ui->screenWidth * 0.5f, (float)ui->screenHeight * 0.5f };
    Vector2 spawnPos = GetScreenToWorld2D(screenCenter, *camera);

    struct ShapeBtn {
        ShapeType type;
        const char *name;
        float w, h;
    } shapes[] = {
        { SHAPE_TERMINATOR, "[1] Inicio / Fim", 130, 50 },
        { SHAPE_PROCESS,    "[2] Processo", 140, 60 },
        { SHAPE_DECISION,   "[3] Decisao", 140, 90 },
        { SHAPE_DATA,       "[4] Entrada / Saida", 150, 60 },
        { SHAPE_DATABASE,   "[5] Banco de Dados", 130, 75 },
        { SHAPE_SUBPROCESS, "[6] Subprocesso", 150, 60 },
        { SHAPE_NOTE,       "[7] Nota / Post-it", 150, 80 },
    };

    int numShapes = sizeof(shapes) / sizeof(shapes[0]);
    for (int i = 0; i < numShapes; i++) {
        if (DrawUIButton((Rectangle){ 14, curY, SIDEBAR_LEFT_WIDTH - 28, 36 }, shapes[i].name, false, COLOR_BG_PANEL)) {
            Diagram_AddNode(d, shapes[i].type, spawnPos.x - shapes[i].w * 0.5f, spawnPos.y - shapes[i].h * 0.5f,
                            shapes[i].w, shapes[i].h, NULL);
            ui->currentTool = TOOL_SELECT;
        }
        curY += 42.0f;
    }
}

static void DrawColorPalette(Rectangle startRec, Color *targetColor, bool *changed) {
    Color palette[] = {
        { 37, 99, 235, 230 },  // Blue
        { 16, 185, 129, 230 }, // Emerald
        { 217, 119, 6, 230 },  // Amber
        { 225, 29, 72, 230 },  // Rose
        { 124, 58, 237, 230 }, // Purple
        { 13, 148, 136, 230 }, // Teal
        { 202, 138, 4, 230 },  // Yellow / Note
        { 71, 85, 105, 230 }   // Slate
    };

    float size = 24.0f;
    float gap = 6.0f;
    Vector2 mouse = GetMousePosition();

    for (int i = 0; i < 8; i++) {
        float x = startRec.x + (float)(i % 4) * (size + gap);
        float y = startRec.y + (float)(i / 4) * (size + gap);
        Rectangle r = { x, y, size, size };

        bool isHover = CheckCollisionPointRec(mouse, r);
        if (isHover && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
            *targetColor = palette[i];
            if (changed) *changed = true;
        }

        DrawRectangleRounded(r, 0.3f, 4, palette[i]);
        if (targetColor->r == palette[i].r && targetColor->g == palette[i].g && targetColor->b == palette[i].b) {
            DrawRectangleRoundedLinesEx(r, 0.3f, 4, 2.0f, WHITE);
        } else {
            DrawRectangleRoundedLinesEx(r, 0.3f, 4, 1.0f, COLOR_BORDER);
        }
    }
}

void UI_DrawRightSidebar(UIState *ui, Diagram *d, int width, int height) {
    (void)ui;
    float sidebarX = (float)width - SIDEBAR_RIGHT_WIDTH;
    Rectangle barRec = { sidebarX, TOPBAR_HEIGHT, SIDEBAR_RIGHT_WIDTH, (float)height - TOPBAR_HEIGHT - STATUSBAR_HEIGHT };
    DrawRectangleRec(barRec, COLOR_BG_SIDEBAR);
    DrawLineEx((Vector2){ sidebarX, TOPBAR_HEIGHT }, (Vector2){ sidebarX, (float)height - STATUSBAR_HEIGHT }, 1.5f, COLOR_BORDER);

    float curY = TOPBAR_HEIGHT + 14.0f;
    float padding = 16.0f;
    float contentX = sidebarX + padding;
    float contentW = SIDEBAR_RIGHT_WIDTH - padding * 2.0f;

    Node *node = Diagram_GetNode(d, d->selectedNodeId);
    Connection *conn = Diagram_GetConnection(d, d->selectedConnId);

    if (node) {
        DrawText("PROPRIEDADES DO BLOCO", (int)contentX, (int)curY, 12, COLOR_TEXT_MUTED);
        curY += 24.0f;

        // Texto do Bloco
        DrawText("Texto / Titulo:", (int)contentX, (int)curY, 12, COLOR_TEXT_PRIMARY);
        curY += 18.0f;

        Rectangle textBtn = { contentX, curY, contentW, 32 };
        if (DrawUIButton(textBtn, strlen(node->text) > 0 ? node->text : "[Editar Texto]", false, COLOR_BG_PANEL)) {
            d->isEditingText = true;
            d->editingNode = true;
            d->editingTargetId = node->id;
            strncpy(d->editTextBuffer, node->text, MAX_TEXT_LEN - 1);
            d->cursorPosition = (int)strlen(d->editTextBuffer);
        }
        curY += 40.0f;

        // Tipo da Forma
        DrawText("Tipo de Forma:", (int)contentX, (int)curY, 12, COLOR_TEXT_PRIMARY);
        curY += 18.0f;

        const char *shapeNames[] = { "Processo", "Decisao", "Inicio/Fim", "Entrada/Saida", "Banco Dados", "Subprocesso", "Documento", "Nota" };
        if (DrawUIButton((Rectangle){ contentX, curY, contentW, 30 }, shapeNames[node->type], false, COLOR_BG_PANEL)) {
            node->type = (ShapeType)((node->type + 1) % 8);
            Diagram_PushHistory(d);
        }
        curY += 40.0f;

        // Cores
        DrawText("Cor de Preenchimento:", (int)contentX, (int)curY, 12, COLOR_TEXT_PRIMARY);
        curY += 20.0f;

        bool colorChanged = false;
        DrawColorPalette((Rectangle){ contentX, curY, contentW, 60 }, &node->fillColor, &colorChanged);
        if (colorChanged) {
            node->borderColor = (Color){ (unsigned char)(node->fillColor.r * 1.3f > 255 ? 255 : node->fillColor.r * 1.3f),
                                         (unsigned char)(node->fillColor.g * 1.3f > 255 ? 255 : node->fillColor.g * 1.3f),
                                         (unsigned char)(node->fillColor.b * 1.3f > 255 ? 255 : node->fillColor.b * 1.3f), 255 };
            Diagram_PushHistory(d);
        }
        curY += 65.0f;

        // Dimensões
        char dimStr[64];
        snprintf(dimStr, sizeof(dimStr), "Largura: %.0f  |  Altura: %.0f", node->bounds.width, node->bounds.height);
        DrawText(dimStr, (int)contentX, (int)curY, 12, COLOR_TEXT_MUTED);
        curY += 20.0f;

        // Botões de ajuste rápido de tamanho
        if (DrawUIButton((Rectangle){ contentX, curY, (contentW - 6) * 0.5f, 28 }, "+ Tamanho", false, COLOR_BG_PANEL)) {
            node->bounds.width += 20.0f;
            node->bounds.height += 10.0f;
            Diagram_PushHistory(d);
        }
        if (DrawUIButton((Rectangle){ contentX + (contentW - 6) * 0.5f + 6, curY, (contentW - 6) * 0.5f, 28 }, "- Tamanho", false, COLOR_BG_PANEL)) {
            if (node->bounds.width > 60.0f) node->bounds.width -= 20.0f;
            if (node->bounds.height > 40.0f) node->bounds.height -= 10.0f;
            Diagram_PushHistory(d);
        }
        curY += 36.0f;

        DrawLineEx((Vector2){ contentX, curY }, (Vector2){ contentX + contentW, curY }, 1.0f, COLOR_BORDER);
        curY += 14.0f;

        // Ações: Duplicar, Excluir
        if (DrawUIButton((Rectangle){ contentX, curY, contentW, 32 }, "Duplicar Bloco (Ctrl+D)", false, COLOR_BG_PANEL)) {
            Diagram_DuplicateSelectedNode(d);
        }
        curY += 38.0f;

        if (DrawUIButton((Rectangle){ contentX, curY, contentW, 32 }, "Excluir Bloco (Del)", false, COLOR_DANGER)) {
            Diagram_RemoveNode(d, node->id);
        }

    } else if (conn) {
        DrawText("PROPRIEDADES DA CONEXAO", (int)contentX, (int)curY, 12, COLOR_TEXT_MUTED);
        curY += 24.0f;

        DrawText("Rotulo / Texto:", (int)contentX, (int)curY, 12, COLOR_TEXT_PRIMARY);
        curY += 18.0f;

        Rectangle labelBtn = { contentX, curY, contentW, 32 };
        if (DrawUIButton(labelBtn, strlen(conn->label) > 0 ? conn->label : "[Definir Rotulo]", false, COLOR_BG_PANEL)) {
            d->isEditingText = true;
            d->editingNode = false;
            d->editingTargetId = conn->id;
            strncpy(d->editTextBuffer, conn->label, MAX_LABEL_LEN - 1);
            d->cursorPosition = (int)strlen(d->editTextBuffer);
        }
        curY += 40.0f;

        // Chips rápidos de rótulos comuns em fluxogramas
        DrawText("Rotulos Rapidos:", (int)contentX, (int)curY, 12, COLOR_TEXT_MUTED);
        curY += 18.0f;

        const char *chips[] = { "Sim", "Nao", "OK", "Erro" };
        float chipW = (contentW - 9.0f) / 4.0f;
        for (int i = 0; i < 4; i++) {
            if (DrawUIButton((Rectangle){ contentX + (float)i * (chipW + 3.0f), curY, chipW, 26 }, chips[i], false, COLOR_BG_PANEL)) {
                strncpy(conn->label, chips[i], MAX_LABEL_LEN - 1);
                Diagram_PushHistory(d);
            }
        }
        curY += 36.0f;

        // Cor da linha
        DrawText("Cor da Seta:", (int)contentX, (int)curY, 12, COLOR_TEXT_PRIMARY);
        curY += 20.0f;
        bool connColorChanged = false;
        DrawColorPalette((Rectangle){ contentX, curY, contentW, 60 }, &conn->color, &connColorChanged);
        if (connColorChanged) Diagram_PushHistory(d);
        curY += 65.0f;

        DrawLineEx((Vector2){ contentX, curY }, (Vector2){ contentX + contentW, curY }, 1.0f, COLOR_BORDER);
        curY += 14.0f;

        if (DrawUIButton((Rectangle){ contentX, curY, contentW, 32 }, "Excluir Conexao (Del)", false, COLOR_DANGER)) {
            Diagram_RemoveConnection(d, conn->id);
        }

    } else {
        DrawText("RESUMO DO DIAGRAMA", (int)contentX, (int)curY, 12, COLOR_TEXT_MUTED);
        curY += 24.0f;

        char statBuf[64];
        snprintf(statBuf, sizeof(statBuf), "Total de Blocos: %d", d->nodeCount);
        DrawText(statBuf, (int)contentX, (int)curY, 13, COLOR_TEXT_PRIMARY);
        curY += 20.0f;

        snprintf(statBuf, sizeof(statBuf), "Total de Conexoes: %d", d->connectionCount);
        DrawText(statBuf, (int)contentX, (int)curY, 13, COLOR_TEXT_PRIMARY);
        curY += 32.0f;

        DrawLineEx((Vector2){ contentX, curY }, (Vector2){ contentX + contentW, curY }, 1.0f, COLOR_BORDER);
        curY += 16.0f;

        DrawText("COMO USAR:", (int)contentX, (int)curY, 12, COLOR_TEXT_MUTED);
        curY += 22.0f;

        const char *tips[] = {
            "* Clique em uma forma na barra esquerda para adicionar ao centro.",
            "* Clique e arraste um bloco para reposicionar na grade.",
            "* Clique duplo para editar o texto de qualquer elemento.",
            "* Arraste os pontos azuis nas bordas para ligar setas!",
            "* Use o botao direito ou Espaco para mover a tela livremente.",
            "* Scroll do mouse para dar Zoom in / Zoom out."
        };

        for (int i = 0; i < 6; i++) {
            DrawText(tips[i], (int)contentX, (int)curY, 11, COLOR_TEXT_MUTED);
            curY += 28.0f;
        }
    }
}

void UI_DrawStatusBar(const UIState *ui, const Diagram *d, const Camera2D *camera, int width, int height) {
    (void)ui;
    Rectangle barRec = { 0, (float)height - STATUSBAR_HEIGHT, (float)width, STATUSBAR_HEIGHT };
    DrawRectangleRec(barRec, COLOR_BG_NAVBAR);
    DrawLineEx((Vector2){ 0, (float)height - STATUSBAR_HEIGHT }, (Vector2){ (float)width, (float)height - STATUSBAR_HEIGHT }, 1.0f, COLOR_BORDER);

    // Posição no mundo
    Vector2 mouseWorld = GetScreenToWorld2D(GetMousePosition(), *camera);
    char coordBuf[64];
    snprintf(coordBuf, sizeof(coordBuf), "X: %.0f  Y: %.0f", mouseWorld.x, mouseWorld.y);
    DrawText(coordBuf, 16, height - 20, 12, COLOR_TEXT_MUTED);

    // Mensagem de dica central
    const char *centerTip = "Clique duplo: Editar texto  |  Espaco + Arrastar: Mover tela  |  Del: Excluir  |  F1: Ajuda";
    int tipW = MeasureText(centerTip, 12);
    DrawText(centerTip, (width - tipW) / 2, height - 20, 12, COLOR_TEXT_MUTED);

    // Status da direita: Zoom e Snap
    char rightBuf[64];
    snprintf(rightBuf, sizeof(rightBuf), "Zoom: %.0f%%  |  Snap: %s  |  FPS: %d",
        camera->zoom * 100.0f, d->snapToGrid ? "ON" : "OFF", GetFPS());
    int rightW = MeasureText(rightBuf, 12);
    DrawText(rightBuf, width - rightW - 16, height - 20, 12, COLOR_TEXT_MUTED);
}

void UI_DrawToast(const Diagram *d, int width) {
    if (d->toastTimer <= 0.0f) return;

    float alpha = 1.0f;
    if (d->toastTimer < 0.5f) alpha = d->toastTimer / 0.5f;

    int textW = MeasureText(d->toastMessage, 14);
    Rectangle rec = { (float)(width - textW) * 0.5f - 16.0f, TOPBAR_HEIGHT + 14.0f, (float)textW + 32.0f, 32.0f };

    Color bg = (Color){ 24, 27, 32, (unsigned char)(240 * alpha) };
    Color border = (Color){ 59, 130, 246, (unsigned char)(255 * alpha) };
    Color textCol = (Color){ 255, 255, 255, (unsigned char)(255 * alpha) };

    DrawRectangleRounded(rec, 0.3f, 6, bg);
    DrawRectangleRoundedLinesEx(rec, 0.3f, 6, 1.5f, border);
    DrawText(d->toastMessage, (int)(rec.x + 16.0f), (int)(rec.y + 9.0f), 14, textCol);
}

void UI_DrawHelpModal(UIState *ui, int width, int height) {
    if (!ui->showHelpModal) return;

    // Fundo escuro semi-transparente
    DrawRectangle(0, 0, width, height, (Color){ 0, 0, 0, 180 });

    float mw = 520.0f;
    float mh = 420.0f;
    Rectangle modalRec = { ((float)width - mw) * 0.5f, ((float)height - mh) * 0.5f, mw, mh };

    DrawRectangleRounded(modalRec, 0.05f, 8, COLOR_BG_SIDEBAR);
    DrawRectangleRoundedLinesEx(modalRec, 0.05f, 8, 1.5f, COLOR_ACCENT);

    // Cabeçalho
    DrawText("Atalhos do DiagramaBot", (int)(modalRec.x + 24.0f), (int)(modalRec.y + 20.0f), 18, WHITE);
    if (DrawUIButton((Rectangle){ modalRec.x + mw - 40.0f, modalRec.y + 16.0f, 26, 26 }, "X", false, COLOR_BG_PANEL)) {
        ui->showHelpModal = false;
    }

    DrawLineEx((Vector2){ modalRec.x + 20.0f, modalRec.y + 54.0f }, (Vector2){ modalRec.x + mw - 20.0f, modalRec.y + 54.0f }, 1.0f, COLOR_BORDER);

    const char *shortcuts[][2] = {
        { "Espaco + Arrastar / Botao Direito", "Mover a tela (Pan)" },
        { "Scroll do Mouse", "Zoom in / Zoom out" },
        { "Clique Duplo no Bloco / Conexao", "Editar texto inline" },
        { "Del ou Backspace", "Excluir elemento selecionado" },
        { "Ctrl + D", "Duplicar bloco selecionado" },
        { "Ctrl + Z / Ctrl + Y", "Desfazer / Refazer alteracao" },
        { "Ctrl + S", "Salvar diagrama (diagrama.diag)" },
        { "Teclas 1 a 7", "Inserir formas rapidamente" },
        { "Tecla V / C", "Modo Selecionar / Modo Conectar" },
        { "Tecla G / S", "Alternar Grid / Alternar Snap" },
        { "ESC", "Cancelar conexao ou fechar janela" }
    };

    int count = sizeof(shortcuts) / sizeof(shortcuts[0]);
    float lineY = modalRec.y + 68.0f;

    for (int i = 0; i < count; i++) {
        DrawText(shortcuts[i][0], (int)(modalRec.x + 24.0f), (int)lineY, 13, (Color){ 96, 165, 250, 255 });
        DrawText(shortcuts[i][1], (int)(modalRec.x + 280.0f), (int)lineY, 13, COLOR_TEXT_MUTED);
        lineY += 28.0f;
    }

    if (DrawUIButton((Rectangle){ modalRec.x + (mw - 100.0f) * 0.5f, modalRec.y + mh - 44.0f, 100.0f, 30.0f }, "Entendido", true, COLOR_ACCENT)) {
        ui->showHelpModal = false;
    }
}

void UI_DrawTextEditor(Diagram *d, const Camera2D *camera) {
    if (!d->isEditingText) return;

    Vector2 screenPos = { 0, 0 };
    float editWidth = 180.0f;
    float editHeight = 36.0f;

    if (d->editingNode) {
        Node *n = Diagram_GetNode(d, d->editingTargetId);
        if (!n) { d->isEditingText = false; return; }
        screenPos = GetWorldToScreen2D((Vector2){ n->bounds.x, n->bounds.y + n->bounds.height * 0.5f - 18.0f }, *camera);
        editWidth = n->bounds.width * camera->zoom;
        if (editWidth < 140.0f) editWidth = 140.0f;
        editHeight = 36.0f;
    } else {
        Connection *c = Diagram_GetConnection(d, d->editingTargetId);
        if (!c) { d->isEditingText = false; return; }
        Node *from = Diagram_GetNode(d, c->fromNodeId);
        Node *to = Diagram_GetNode(d, c->toNodeId);
        if (!from || !to) { d->isEditingText = false; return; }
        Vector2 p1 = Diagram_GetPortPosition(from, c->fromPort);
        Vector2 p2 = Diagram_GetPortPosition(to, c->toPort);
        Vector2 midWorld = { (p1.x + p2.x) * 0.5f, (p1.y + p2.y) * 0.5f };
        screenPos = GetWorldToScreen2D(midWorld, *camera);
        screenPos.x -= editWidth * 0.5f;
        screenPos.y -= editHeight * 0.5f;
    }

    Rectangle boxRec = { screenPos.x, screenPos.y, editWidth, editHeight };

    // Desenha caixa de edição elegante com halo
    DrawRectangleRounded(boxRec, 0.2f, 6, (Color){ 24, 27, 32, 250 });
    DrawRectangleRoundedLinesEx(boxRec, 0.2f, 6, 2.0f, COLOR_ACCENT_HOVER);

    // Entrada de caracteres
    int key = GetCharPressed();
    while (key > 0) {
        if ((key >= 32) && (key <= 255)) {
            int len = (int)strlen(d->editTextBuffer);
            int maxAllowed = d->editingNode ? (MAX_TEXT_LEN - 2) : (MAX_LABEL_LEN - 2);
            if (len < maxAllowed) {
                d->editTextBuffer[len] = (char)key;
                d->editTextBuffer[len + 1] = '\0';
                d->cursorPosition = len + 1;
            }
        }
        key = GetCharPressed();
    }

    if (IsKeyPressed(KEY_BACKSPACE)) {
        int len = (int)strlen(d->editTextBuffer);
        if (len > 0) {
            d->editTextBuffer[len - 1] = '\0';
            d->cursorPosition = len - 1;
        }
    }

    // Confirmar com Enter
    if (IsKeyPressed(KEY_ENTER)) {
        if (d->editingNode) {
            Node *n = Diagram_GetNode(d, d->editingTargetId);
            if (n) {
                strncpy(n->text, d->editTextBuffer, MAX_TEXT_LEN - 1);
                Diagram_PushHistory(d);
            }
        } else {
            Connection *c = Diagram_GetConnection(d, d->editingTargetId);
            if (c) {
                strncpy(c->label, d->editTextBuffer, MAX_LABEL_LEN - 1);
                Diagram_PushHistory(d);
            }
        }
        d->isEditingText = false;
        Diagram_SetToast(d, "Texto atualizado");
    }

    // Cancelar com Esc
    if (IsKeyPressed(KEY_ESCAPE)) {
        d->isEditingText = false;
    }

    // Texto com cursor piscante
    int textW = MeasureText(d->editTextBuffer, 14);
    int textX = (int)(boxRec.x + (boxRec.width - (float)textW) * 0.5f);
    if (textX < (int)boxRec.x + 8) textX = (int)boxRec.x + 8;
    int textY = (int)(boxRec.y + 10.0f);

    DrawText(d->editTextBuffer, textX, textY, 14, WHITE);

    // Cursor piscante
    if (((int)(GetTime() * 2.5) % 2) == 0) {
        DrawLine(textX + textW + 2, textY - 1, textX + textW + 2, textY + 16, COLOR_ACCENT_HOVER);
    }
}

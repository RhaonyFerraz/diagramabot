#include "raylib.h"
#include "diagram.h"
#include "renderer.h"
#include "ui.h"
#include "storage.h"
#include "templates.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    // Configurações de janela moderna e antialiasing
    SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT);
    InitWindow(1280, 720, "DiagramaBot - Construtor de Diagramas e Fluxogramas em C");
    SetWindowMinSize(900, 500);
    SetTargetFPS(60);

    // Inicialização dos módulos
    Renderer_Init();

    Diagram *diagram = Diagram_Create();
    if (!diagram) {
        CloseWindow();
        return 1;
    }

    UIState ui;
    UI_Init(&ui);

    // Câmera 2D para Canvas Infinito com Pan & Zoom
    Camera2D camera = { 0 };
    camera.zoom = 0.95f;
    camera.offset = (Vector2){ (float)GetScreenWidth() * 0.5f, (float)GetScreenHeight() * 0.5f };
    camera.target = (Vector2){ 700.0f, 360.0f };

    // Carregar fluxograma de boas-vindas
    Templates_LoadDefaultFlowchart(diagram);

    // Controle de cliques e arrasto
    float lastClickTime = 0.0f;
    Vector2 lastClickPos = { 0, 0 };
    Vector2 lastMousePos = { 0, 0 };
    bool isPanning = false;

    while (!WindowShouldClose()) {
        float dt = GetFrameTime();
        int screenW = GetScreenWidth();
        int screenH = GetScreenHeight();
        ui.screenWidth = screenW;
        ui.screenHeight = screenH;

        Vector2 mouseScreen = GetMousePosition();
        Vector2 mouseWorld = GetScreenToWorld2D(mouseScreen, camera);
        bool mouseOverUI = UI_IsMouseOverUI(&ui, mouseScreen, screenW, screenH);

        Diagram_UpdateToast(diagram, dt);

        // -----------------------------------------------------------------
        // ZOOM (Scroll do Mouse na direção do cursor)
        // -----------------------------------------------------------------
        if (!mouseOverUI) {
            float wheel = GetMouseWheelMove();
            if (wheel != 0.0f) {
                Vector2 mouseWorldBefore = GetScreenToWorld2D(mouseScreen, camera);
                camera.zoom += wheel * 0.12f;
                if (camera.zoom < 0.25f) camera.zoom = 0.25f;
                if (camera.zoom > 3.0f) camera.zoom = 3.0f;
                Vector2 mouseWorldAfter = GetScreenToWorld2D(mouseScreen, camera);
                camera.target.x += (mouseWorldBefore.x - mouseWorldAfter.x);
                camera.target.y += (mouseWorldBefore.y - mouseWorldAfter.y);
            }
        }

        // -----------------------------------------------------------------
        // PAN (Mover tela com Botão Direito, Scroll Pressionado ou Espaço)
        // -----------------------------------------------------------------
        bool panKey = IsKeyDown(KEY_SPACE) || IsMouseButtonDown(MOUSE_BUTTON_RIGHT) || IsMouseButtonDown(MOUSE_BUTTON_MIDDLE);
        if (panKey) {
            if (!isPanning) {
                isPanning = true;
                lastMousePos = mouseScreen;
            } else {
                Vector2 delta = { mouseScreen.x - lastMousePos.x, mouseScreen.y - lastMousePos.y };
                camera.target.x -= delta.x / camera.zoom;
                camera.target.y -= delta.y / camera.zoom;
                lastMousePos = mouseScreen;
            }
            SetMouseCursor(MOUSE_CURSOR_RESIZE_ALL);
        } else {
            isPanning = false;
        }

        // -----------------------------------------------------------------
        // ATALHOS DE TECLADO GLOBAIS (Quando não estiver digitando texto)
        // -----------------------------------------------------------------
        if (!diagram->isEditingText) {
            bool ctrl = IsKeyDown(KEY_LEFT_CONTROL) || IsKeyDown(KEY_RIGHT_CONTROL);

            if (ctrl && IsKeyPressed(KEY_Z)) Diagram_Undo(diagram);
            if (ctrl && IsKeyPressed(KEY_Y)) Diagram_Redo(diagram);
            if (ctrl && IsKeyPressed(KEY_D)) Diagram_DuplicateSelectedNode(diagram);
            if (ctrl && IsKeyPressed(KEY_S)) {
                Storage_SaveDiagram(diagram, "diagrama.diag");
                Diagram_SetToast(diagram, "Salvo em 'diagrama.diag'!");
            }

            if (IsKeyPressed(KEY_DELETE) || IsKeyPressed(KEY_BACKSPACE)) {
                if (diagram->selectedNodeId != -1) {
                    Diagram_RemoveNode(diagram, diagram->selectedNodeId);
                } else if (diagram->selectedConnId != -1) {
                    Diagram_RemoveConnection(diagram, diagram->selectedConnId);
                }
            }

            if (IsKeyPressed(KEY_V)) ui.currentTool = TOOL_SELECT;
            if (IsKeyPressed(KEY_C)) {
                ui.currentTool = TOOL_CONNECT;
                Diagram_SetToast(diagram, "Modo Conexão: Arraste de um ponto a outro");
            }
            if (IsKeyPressed(KEY_G)) diagram->showGrid = !diagram->showGrid;
            if (IsKeyPressed(KEY_S) && !ctrl) {
                diagram->snapToGrid = !diagram->snapToGrid;
                Diagram_SetToast(diagram, diagram->snapToGrid ? "Snap to Grid ativado" : "Snap to Grid desativado");
            }
            if (IsKeyPressed(KEY_F1)) ui.showHelpModal = !ui.showHelpModal;

            // Inserção rápida por números 1 a 7
            if (IsKeyPressed(KEY_ONE)) {
                Diagram_AddNode(diagram, SHAPE_TERMINATOR, mouseWorld.x - 65, mouseWorld.y - 25, 130, 50, "Inicio / Fim");
            }
            if (IsKeyPressed(KEY_TWO)) {
                Diagram_AddNode(diagram, SHAPE_PROCESS, mouseWorld.x - 70, mouseWorld.y - 30, 140, 60, "Processo");
            }
            if (IsKeyPressed(KEY_THREE)) {
                Diagram_AddNode(diagram, SHAPE_DECISION, mouseWorld.x - 70, mouseWorld.y - 45, 140, 90, "Decisao?");
            }
            if (IsKeyPressed(KEY_FOUR)) {
                Diagram_AddNode(diagram, SHAPE_DATA, mouseWorld.x - 75, mouseWorld.y - 30, 150, 60, "Dados");
            }
            if (IsKeyPressed(KEY_FIVE)) {
                Diagram_AddNode(diagram, SHAPE_DATABASE, mouseWorld.x - 65, mouseWorld.y - 40, 130, 80, "Banco Dados");
            }
            if (IsKeyPressed(KEY_SIX)) {
                Diagram_AddNode(diagram, SHAPE_SUBPROCESS, mouseWorld.x - 75, mouseWorld.y - 30, 150, 60, "Subprocesso");
            }
            if (IsKeyPressed(KEY_SEVEN)) {
                Diagram_AddNode(diagram, SHAPE_NOTE, mouseWorld.x - 75, mouseWorld.y - 40, 150, 80, "Nota");
            }
        }

        // -----------------------------------------------------------------
        // HOVER DETECTION
        // -----------------------------------------------------------------
        if (!mouseOverUI && !isPanning) {
            int portIndex = -1;
            int portNode = Diagram_FindPortAt(diagram, mouseWorld, &portIndex);
            diagram->hoveredPortNodeId = portNode;
            diagram->hoveredPortIndex = portIndex;

            if (portNode == -1) {
                diagram->hoveredNodeId = Diagram_FindNodeAt(diagram, mouseWorld);
                if (diagram->hoveredNodeId == -1) {
                    diagram->hoveredConnId = Diagram_FindConnectionAt(diagram, mouseWorld, 8.0f);
                } else {
                    diagram->hoveredConnId = -1;
                }
            } else {
                diagram->hoveredNodeId = portNode;
                diagram->hoveredConnId = -1;
            }

            if (diagram->hoveredPortNodeId != -1) {
                SetMouseCursor(MOUSE_CURSOR_POINTING_HAND);
            } else if (diagram->hoveredNodeId != -1) {
                SetMouseCursor(MOUSE_CURSOR_RESIZE_ALL);
            } else if (diagram->hoveredConnId != -1) {
                SetMouseCursor(MOUSE_CURSOR_POINTING_HAND);
            } else {
                SetMouseCursor(MOUSE_CURSOR_DEFAULT);
            }
        } else {
            diagram->hoveredNodeId = -1;
            diagram->hoveredConnId = -1;
            diagram->hoveredPortNodeId = -1;
            diagram->hoveredPortIndex = -1;
            if (!isPanning) SetMouseCursor(MOUSE_CURSOR_DEFAULT);
        }

        // -----------------------------------------------------------------
        // MOUSE CLIQUE E ARRASTO
        // -----------------------------------------------------------------
        if (!mouseOverUI && !isPanning) {
            float now = (float)GetTime();

            // Clique do Botão Esquerdo
            if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
                bool isDoubleClick = (now - lastClickTime < 0.35f) &&
                                     (fabsf(mouseScreen.x - lastClickPos.x) < 5.0f) &&
                                     (fabsf(mouseScreen.y - lastClickPos.y) < 5.0f);
                lastClickTime = now;
                lastClickPos = mouseScreen;

                if (isDoubleClick) {
                    // Editar texto inline
                    if (diagram->hoveredNodeId != -1) {
                        Node *n = Diagram_GetNode(diagram, diagram->hoveredNodeId);
                        if (n) {
                            diagram->isEditingText = true;
                            diagram->editingNode = true;
                            diagram->editingTargetId = n->id;
                            strncpy(diagram->editTextBuffer, n->text, MAX_TEXT_LEN - 1);
                            diagram->cursorPosition = (int)strlen(diagram->editTextBuffer);
                        }
                    } else if (diagram->hoveredConnId != -1) {
                        Connection *c = Diagram_GetConnection(diagram, diagram->hoveredConnId);
                        if (c) {
                            diagram->isEditingText = true;
                            diagram->editingNode = false;
                            diagram->editingTargetId = c->id;
                            strncpy(diagram->editTextBuffer, c->label, MAX_LABEL_LEN - 1);
                            diagram->cursorPosition = (int)strlen(diagram->editTextBuffer);
                        }
                    }
                } else {
                    // Clique simples
                    if (diagram->hoveredPortNodeId != -1 || ui.currentTool == TOOL_CONNECT) {
                        // Iniciar conexão a partir de porta
                        int startNode = diagram->hoveredPortNodeId;
                        PortIndex startPort = (PortIndex)diagram->hoveredPortIndex;
                        if (startNode == -1) startNode = diagram->hoveredNodeId;
                        if (startPort < 0 || startPort > 3) startPort = PORT_RIGHT;

                        if (startNode != -1) {
                            diagram->dragState = DRAG_STATE_CONNECTING;
                            diagram->connectStartNodeId = startNode;
                            diagram->connectStartPort = startPort;
                            diagram->connectTargetPos = mouseWorld;
                        }
                    } else if (diagram->hoveredNodeId != -1) {
                        // Selecionar e mover nó
                        diagram->selectedNodeId = diagram->hoveredNodeId;
                        diagram->selectedConnId = -1;
                        diagram->dragState = DRAG_STATE_MOVE_NODE;
                        diagram->dragStartPos = mouseWorld;
                        Node *n = Diagram_GetNode(diagram, diagram->selectedNodeId);
                        if (n) diagram->initialNodeBounds = n->bounds;
                    } else if (diagram->hoveredConnId != -1) {
                        // Selecionar conexão
                        diagram->selectedConnId = diagram->hoveredConnId;
                        diagram->selectedNodeId = -1;
                    } else {
                        // Clique no vazio
                        diagram->selectedNodeId = -1;
                        diagram->selectedConnId = -1;
                        diagram->isEditingText = false;
                    }
                }
            }

            // Durante o arrasto
            if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
                if (diagram->dragState == DRAG_STATE_MOVE_NODE) {
                    Node *n = Diagram_GetNode(diagram, diagram->selectedNodeId);
                    if (n) {
                        float dx = mouseWorld.x - diagram->dragStartPos.x;
                        float dy = mouseWorld.y - diagram->dragStartPos.y;
                        n->bounds.x = diagram->initialNodeBounds.x + dx;
                        n->bounds.y = diagram->initialNodeBounds.y + dy;
                        if (diagram->snapToGrid && diagram->gridSize > 0) {
                            n->bounds.x = roundf(n->bounds.x / diagram->gridSize) * diagram->gridSize;
                            n->bounds.y = roundf(n->bounds.y / diagram->gridSize) * diagram->gridSize;
                        }
                    }
                } else if (diagram->dragState == DRAG_STATE_CONNECTING) {
                    if (diagram->hoveredPortNodeId != -1 && diagram->hoveredPortIndex != -1) {
                        Node *targetNode = Diagram_GetNode(diagram, diagram->hoveredPortNodeId);
                        if (targetNode) {
                            diagram->connectTargetPos = Diagram_GetPortPosition(targetNode, (PortIndex)diagram->hoveredPortIndex);
                        }
                    } else {
                        diagram->connectTargetPos = mouseWorld;
                    }
                }
            }

            // Soltar o mouse
            if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
                if (diagram->dragState == DRAG_STATE_MOVE_NODE) {
                    Diagram_PushHistory(diagram);
                } else if (diagram->dragState == DRAG_STATE_CONNECTING) {
                    int endNode = diagram->hoveredPortNodeId != -1 ? diagram->hoveredPortNodeId : diagram->hoveredNodeId;
                    if (endNode != -1 && endNode != diagram->connectStartNodeId) {
                        PortIndex endPort = (diagram->hoveredPortIndex != -1) ? (PortIndex)diagram->hoveredPortIndex : PORT_AUTO;
                        Diagram_AddConnection(diagram, diagram->connectStartNodeId, endNode,
                                              diagram->connectStartPort, endPort, "");
                    }
                }
                diagram->dragState = DRAG_STATE_NONE;
                diagram->connectStartNodeId = -1;
            }
        } else {
            if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
                diagram->dragState = DRAG_STATE_NONE;
            }
        }

        // -----------------------------------------------------------------
        // RENDERIZAÇÃO
        // -----------------------------------------------------------------
        BeginDrawing();
        // Fundo escuro do canvas
        ClearBackground((Color){ 18, 20, 24, 255 });

        // Espaço de Mundo (2D)
        BeginMode2D(camera);
        if (diagram->showGrid) {
            Renderer_DrawGrid(&camera, diagram->gridSize, screenW, screenH);
        }
        Renderer_DrawDiagram(diagram, &camera);
        EndMode2D();

        // Camada de Interface do Usuário (Screen Space)
        UI_DrawTextEditor(diagram, &camera);
        UI_DrawTopBar(&ui, diagram, &camera, screenW);
        UI_DrawLeftSidebar(&ui, diagram, &camera, screenH);
        UI_DrawRightSidebar(&ui, diagram, screenW, screenH);
        UI_DrawStatusBar(&ui, diagram, &camera, screenW, screenH);
        UI_DrawToast(diagram, screenW);
        UI_DrawHelpModal(&ui, screenW, screenH);

        EndDrawing();
    }

    Diagram_Shutdown(diagram);
    free(diagram);

    Renderer_Shutdown();
    CloseWindow();
    return 0;
}

#ifndef RENDERER_H
#define RENDERER_H

#include "diagram.h"
#include "raylib.h"

// Inicialização e recursos do renderizador
void Renderer_Init(void);
void Renderer_Shutdown(void);

// Desenho no espaço de mundo (dentro do BeginMode2D)
void Renderer_DrawGrid(const Camera2D *camera, float gridSize, int screenWidth, int screenHeight);
void Renderer_DrawDiagram(const Diagram *diagram, const Camera2D *camera);
void Renderer_DrawSelectionBox(Vector2 start, Vector2 end);

// Desenho da forma individual (também usado na exportação)
void Renderer_DrawNode(const Node *node, bool isSelected, bool isHovered, bool showPorts, int hoveredPortIndex);
void Renderer_DrawConnection(const Connection *conn, const Node *from, const Node *to, bool isSelected, bool isHovered);
void Renderer_DrawConnectionDraft(Vector2 fromPos, Vector2 toPos, PortIndex fromPort, PortIndex toPort);

// Utilitários de desenho
void DrawArrowHead(Vector2 tip, Vector2 dir, float size, Color color);
void DrawWrappedText(const char *text, Rectangle bounds, int fontSize, Color color);

#endif // RENDERER_H

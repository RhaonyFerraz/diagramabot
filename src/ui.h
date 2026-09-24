#ifndef UI_H
#define UI_H

#include "diagram.h"
#include "raylib.h"

#define TOPBAR_HEIGHT 54.0f
#define SIDEBAR_LEFT_WIDTH 200.0f
#define SIDEBAR_RIGHT_WIDTH 260.0f
#define STATUSBAR_HEIGHT 30.0f

typedef struct {
    EditorTool currentTool;
    bool showHelpModal;
    bool showExampleMenu;
    int screenWidth;
    int screenHeight;
} UIState;

void UI_Init(UIState *ui);
void UI_DrawTopBar(UIState *ui, Diagram *d, Camera2D *camera, int width);
void UI_DrawLeftSidebar(UIState *ui, Diagram *d, const Camera2D *camera, int height);
void UI_DrawRightSidebar(UIState *ui, Diagram *d, int width, int height);
void UI_DrawStatusBar(const UIState *ui, const Diagram *d, const Camera2D *camera, int width, int height);
void UI_DrawToast(const Diagram *d, int width);
void UI_DrawHelpModal(UIState *ui, int width, int height);
void UI_DrawTextEditor(Diagram *d, const Camera2D *camera);

bool UI_IsMouseOverUI(const UIState *ui, Vector2 mousePos, int width, int height);

#endif // UI_H

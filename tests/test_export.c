#include "raylib.h"
#include "diagram.h"
#include "storage.h"
#include "templates.h"
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    printf("Starting test...\n");
    SetConfigFlags(FLAG_WINDOW_HIDDEN);
    InitWindow(100, 100, "Headless Export Test");

    Diagram *diagram = Diagram_Create();
    if (!diagram) {
        printf("Failed to create diagram!\n");
        CloseWindow();
        return 1;
    }

    Templates_LoadDefaultFlowchart(diagram);
    printf("Nodes loaded: %d, Connections loaded: %d\n", diagram->nodeCount, diagram->connectionCount);

    bool pngOk = Storage_ExportPNG(diagram, "teste_fluxograma.png");
    printf("PNG Export: %s\n", pngOk ? "SUCCESS" : "FAILED");

    bool svgOk = Storage_ExportSVG(diagram, "teste_fluxograma.svg");
    printf("SVG Export: %s\n", svgOk ? "SUCCESS" : "FAILED");

    bool diagOk = Storage_SaveDiagram(diagram, "teste_fluxograma.diag");
    printf("Diag Save: %s\n", diagOk ? "SUCCESS" : "FAILED");

    Diagram *loaded = Diagram_Create();
    bool loadOk = Storage_LoadDiagram(loaded, "teste_fluxograma.diag");
    printf("Diag Load: %s (Nodes: %d, Conns: %d)\n", loadOk ? "SUCCESS" : "FAILED", loaded->nodeCount, loaded->connectionCount);

    Diagram_Shutdown(diagram);
    free(diagram);
    Diagram_Shutdown(loaded);
    free(loaded);

    CloseWindow();
    printf("Test finished successfully!\n");
    return 0;
}

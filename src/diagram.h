#ifndef DIAGRAM_H
#define DIAGRAM_H

#include "raylib.h"
#include <stdbool.h>

#define MAX_NODES 256
#define MAX_CONNECTIONS 512
#define MAX_TEXT_LEN 256
#define MAX_LABEL_LEN 64
#define MAX_HISTORY 32

typedef enum {
    SHAPE_PROCESS = 0,    // Retângulo arredondado (Ação/Processamento)
    SHAPE_DECISION,       // Losango (Decisão/Condicional)
    SHAPE_TERMINATOR,     // Cápsula/Pílula (Início/Fim)
    SHAPE_DATA,           // Paralelogramo (Entrada/Saída)
    SHAPE_DATABASE,       // Cilindro (Banco de Dados / Armazenamento)
    SHAPE_SUBPROCESS,     // Retângulo com barras verticais laterais
    SHAPE_DOCUMENT,       // Retângulo com base ondulada
    SHAPE_NOTE            // Bloco de notas com dobra no canto
} ShapeType;

typedef enum {
    PORT_TOP = 0,
    PORT_RIGHT,
    PORT_BOTTOM,
    PORT_LEFT,
    PORT_AUTO
} PortIndex;

typedef enum {
    LINE_BEZIER = 0,
    LINE_STRAIGHT,
    LINE_ORTHOGONAL
} LineStyle;

typedef struct {
    int id;
    ShapeType type;
    Rectangle bounds;
    char text[MAX_TEXT_LEN];
    Color fillColor;
    Color borderColor;
    Color textColor;
    float borderWidth;
    bool selected;
} Node;

typedef struct {
    int id;
    int fromNodeId;
    int toNodeId;
    PortIndex fromPort;
    PortIndex toPort;
    char label[MAX_LABEL_LEN];
    Color color;
    LineStyle style;
    bool selected;
} Connection;

// Snapshot para Histórico (Undo / Redo)
typedef struct {
    Node nodes[MAX_NODES];
    int nodeCount;
    Connection connections[MAX_CONNECTIONS];
    int connectionCount;
    int nextNodeId;
    int nextConnId;
} DiagramSnapshot;

typedef enum {
    TOOL_SELECT = 0,
    TOOL_ADD_PROCESS,
    TOOL_ADD_DECISION,
    TOOL_ADD_TERMINATOR,
    TOOL_ADD_DATA,
    TOOL_ADD_DATABASE,
    TOOL_ADD_SUBPROCESS,
    TOOL_ADD_NOTE,
    TOOL_CONNECT
} EditorTool;

typedef enum {
    DRAG_STATE_NONE = 0,
    DRAG_STATE_PAN,
    DRAG_STATE_MOVE_NODE,
    DRAG_STATE_RESIZE_NODE,
    DRAG_STATE_CONNECTING,
    DRAG_STATE_BOX_SELECT
} DragState;

typedef struct {
    Node nodes[MAX_NODES];
    int nodeCount;
    Connection connections[MAX_CONNECTIONS];
    int connectionCount;
    int nextNodeId;
    int nextConnId;

    // Seleção e interação
    int selectedNodeId;       // -1 se nenhum
    int selectedConnId;       // -1 se nenhuma
    int hoveredNodeId;        // -1 se nenhum
    int hoveredConnId;        // -1 se nenhuma
    int hoveredPortIndex;     // -1 se nenhuma porta sob cursor
    int hoveredPortNodeId;    // Id do nó da porta sobrevoada

    // Estado de arrasto
    DragState dragState;
    Vector2 dragStartPos;     // Posição no mundo ou na tela
    Vector2 dragCurrentPos;
    int resizeHandleIndex;    // 0..7 handles de redimensionamento
    Rectangle initialNodeBounds;

    // Criação de conexão interativa
    int connectStartNodeId;
    PortIndex connectStartPort;
    Vector2 connectTargetPos;

    // Edição inline de texto
    bool isEditingText;
    bool editingNode;         // true = nó, false = conexão
    int editingTargetId;
    char editTextBuffer[MAX_TEXT_LEN];
    int cursorPosition;

    // Histórico de Undo / Redo (Alocado dinamicamente para economizar memória e pilha)
    DiagramSnapshot *history[MAX_HISTORY];
    int historyIndex;
    int historyCount;

    // Configurações do Canvas
    bool snapToGrid;
    float gridSize;
    bool showGrid;

    // Notificação rápida (Toast)
    char toastMessage[128];
    float toastTimer;

} Diagram;

// Funções do Diagrama
Diagram* Diagram_Create(void);
void Diagram_Init(Diagram *d);
void Diagram_Shutdown(Diagram *d);
void Diagram_Clear(Diagram *d);
void Diagram_PushHistory(Diagram *d);
bool Diagram_Undo(Diagram *d);
bool Diagram_Redo(Diagram *d);

// Nós
Node* Diagram_AddNode(Diagram *d, ShapeType type, float x, float y, float width, float height, const char *text);
Node* Diagram_GetNode(Diagram *d, int id);
bool Diagram_RemoveNode(Diagram *d, int id);
int Diagram_FindNodeAt(const Diagram *d, Vector2 worldPos);
int Diagram_FindPortAt(const Diagram *d, Vector2 worldPos, int *outPortIndex);
Vector2 Diagram_GetPortPosition(const Node *node, PortIndex port);
PortIndex Diagram_GetClosestPort(const Node *from, const Node *to);
void Diagram_MoveSelectedNode(Diagram *d, Vector2 delta);
void Diagram_DuplicateSelectedNode(Diagram *d);

// Conexões
Connection* Diagram_AddConnection(Diagram *d, int fromId, int toId, PortIndex fromPort, PortIndex toPort, const char *label);
Connection* Diagram_GetConnection(Diagram *d, int id);
bool Diagram_RemoveConnection(Diagram *d, int id);
int Diagram_FindConnectionAt(const Diagram *d, Vector2 worldPos, float threshold);

// Helpers
Rectangle Diagram_GetBoundingBox(const Diagram *d, float padding);
void Diagram_SetToast(Diagram *d, const char *msg);
void Diagram_UpdateToast(Diagram *d, float dt);

#endif // DIAGRAM_H

#include "templates.h"

void Templates_LoadDefaultFlowchart(Diagram *d) {
    Diagram_Clear(d);

    // 1. Início
    Node *nStart = Diagram_AddNode(d, SHAPE_TERMINATOR, 80, 240, 130, 50, "Iniciar Pedido");

    // 2. Entrada de Dados
    Node *nData = Diagram_AddNode(d, SHAPE_DATA, 270, 235, 150, 60, "Receber Dados");

    // 3. Decisão
    Node *nDec = Diagram_AddNode(d, SHAPE_DECISION, 480, 215, 140, 100, "Estoque OK?");

    // 4. Processo - Sucesso
    Node *nProc = Diagram_AddNode(d, SHAPE_PROCESS, 680, 235, 140, 60, "Reservar Itens");

    // 5. Subprocesso - Pagamento
    Node *nSub = Diagram_AddNode(d, SHAPE_SUBPROCESS, 880, 235, 150, 60, "Gateway Pagamento");

    // 6. Banco de Dados
    Node *nDB = Diagram_AddNode(d, SHAPE_DATABASE, 1090, 225, 130, 80, "Banco Postgres");

    // 7. Fim com Sucesso
    Node *nEnd = Diagram_AddNode(d, SHAPE_TERMINATOR, 1280, 240, 140, 50, "Pedido Entregue");

    // Rota alternativa (Não)
    Node *nWarn = Diagram_AddNode(d, SHAPE_PROCESS, 475, 380, 150, 60, "Avisar Cliente");
    if (nWarn) {
        nWarn->fillColor = (Color){ 225, 29, 72, 230 }; // Rose / Vermelho alerta
        nWarn->borderColor = (Color){ 254, 205, 211, 255 };
    }

    Node *nFail = Diagram_AddNode(d, SHAPE_TERMINATOR, 480, 490, 140, 50, "Encerrar Pedido");
    if (nFail) {
        nFail->fillColor = (Color){ 190, 18, 60, 230 };
        nFail->borderColor = (Color){ 253, 164, 175, 255 };
    }

    // Nota explicativa
    Node *nNote = Diagram_AddNode(d, SHAPE_NOTE, 880, 360, 150, 80, "Nota: Validação PIX e Cartão com webhook");

    // Conexões
    Diagram_AddConnection(d, nStart->id, nData->id, PORT_RIGHT, PORT_LEFT, "");
    Diagram_AddConnection(d, nData->id, nDec->id, PORT_RIGHT, PORT_LEFT, "");
    Diagram_AddConnection(d, nDec->id, nProc->id, PORT_RIGHT, PORT_LEFT, "Sim");
    Diagram_AddConnection(d, nDec->id, nWarn->id, PORT_BOTTOM, PORT_TOP, "Não");
    Diagram_AddConnection(d, nWarn->id, nFail->id, PORT_BOTTOM, PORT_TOP, "");
    Diagram_AddConnection(d, nProc->id, nSub->id, PORT_RIGHT, PORT_LEFT, "Aprovado");
    Diagram_AddConnection(d, nSub->id, nDB->id, PORT_RIGHT, PORT_LEFT, "Persistir");
    Diagram_AddConnection(d, nDB->id, nEnd->id, PORT_RIGHT, PORT_LEFT, "OK");

    (void)nNote;

    d->selectedNodeId = -1;
    d->selectedConnId = -1;
    Diagram_SetToast(d, "Exemplo de Fluxograma Carregado!");
}

void Templates_LoadSystemArchitecture(Diagram *d) {
    Diagram_Clear(d);

    Node *nClient = Diagram_AddNode(d, SHAPE_TERMINATOR, 100, 250, 140, 60, "Frontend Web");
    Node *nGateway = Diagram_AddNode(d, SHAPE_PROCESS, 320, 250, 150, 60, "API Gateway (C)");
    Node *nAuth = Diagram_AddNode(d, SHAPE_PROCESS, 550, 150, 150, 60, "Auth Service");
    Node *nCore = Diagram_AddNode(d, SHAPE_SUBPROCESS, 550, 340, 160, 70, "Core Engine");
    Node *nCache = Diagram_AddNode(d, SHAPE_DATABASE, 780, 150, 130, 70, "Redis Cache");
    Node *nDB = Diagram_AddNode(d, SHAPE_DATABASE, 780, 340, 130, 80, "Cluster SQL");

    Diagram_AddConnection(d, nClient->id, nGateway->id, PORT_RIGHT, PORT_LEFT, "HTTPS/JSON");
    Diagram_AddConnection(d, nGateway->id, nAuth->id, PORT_RIGHT, PORT_LEFT, "Validar JWT");
    Diagram_AddConnection(d, nAuth->id, nCache->id, PORT_RIGHT, PORT_LEFT, "Sessão");
    Diagram_AddConnection(d, nGateway->id, nCore->id, PORT_RIGHT, PORT_LEFT, "gRPC Call");
    Diagram_AddConnection(d, nCore->id, nDB->id, PORT_RIGHT, PORT_LEFT, "Queries");

    d->selectedNodeId = -1;
    d->selectedConnId = -1;
    Diagram_SetToast(d, "Arquitetura de Sistema Carregada!");
}

/**
 * templates.js — Built-in diagram templates, mirroring templates.c
 */

const Templates = {
  loadDefaultFlowchart(diagram) {
    diagram.clear();

    const nStart = diagram.addNode(ShapeType.TERMINATOR, 80,  240, 130, 50, 'Iniciar Pedido');
    const nData  = diagram.addNode(ShapeType.DATA,       270, 235, 150, 60, 'Receber Dados');
    const nDec   = diagram.addNode(ShapeType.DECISION,   480, 215, 140, 100,'Estoque OK?');
    const nProc  = diagram.addNode(ShapeType.PROCESS,    680, 235, 140, 60, 'Reservar Itens');
    const nSub   = diagram.addNode(ShapeType.SUBPROCESS, 880, 235, 150, 60, 'Gateway Pagamento');
    const nDB    = diagram.addNode(ShapeType.DATABASE,   1090,225, 130, 80, 'Banco Postgres');
    const nEnd   = diagram.addNode(ShapeType.TERMINATOR, 1290,240, 140, 50, 'Pedido Entregue');

    const nWarn  = diagram.addNode(ShapeType.PROCESS,    480, 380, 150, 60, 'Avisar Cliente');
    if (nWarn) {
      nWarn.fillColor   = { r: 225, g: 29,  b: 72,  a: 230 };
      nWarn.borderColor = { r: 254, g: 205, b: 211, a: 255 };
    }

    const nFail  = diagram.addNode(ShapeType.TERMINATOR, 480, 490, 140, 50, 'Encerrar Pedido');
    if (nFail) {
      nFail.fillColor   = { r: 190, g: 18,  b: 60,  a: 230 };
      nFail.borderColor = { r: 253, g: 164, b: 175, a: 255 };
    }

    diagram.addNode(ShapeType.NOTE, 880, 360, 160, 80, 'Nota: Validação PIX e Cartão com webhook');

    // Connections
    if (nStart && nData)  diagram.addConnection(nStart.id, nData.id,  PortIndex.RIGHT, PortIndex.LEFT,   '');
    if (nData  && nDec)   diagram.addConnection(nData.id,  nDec.id,   PortIndex.RIGHT, PortIndex.LEFT,   '');
    if (nDec   && nProc)  diagram.addConnection(nDec.id,   nProc.id,  PortIndex.RIGHT, PortIndex.LEFT,   'Sim');
    if (nDec   && nWarn)  diagram.addConnection(nDec.id,   nWarn.id,  PortIndex.BOTTOM,PortIndex.TOP,    'Não');
    if (nWarn  && nFail)  diagram.addConnection(nWarn.id,  nFail.id,  PortIndex.BOTTOM,PortIndex.TOP,    '');
    if (nProc  && nSub)   diagram.addConnection(nProc.id,  nSub.id,   PortIndex.RIGHT, PortIndex.LEFT,   'Aprovado');
    if (nSub   && nDB)    diagram.addConnection(nSub.id,   nDB.id,    PortIndex.RIGHT, PortIndex.LEFT,   'Persistir');
    if (nDB    && nEnd)   diagram.addConnection(nDB.id,    nEnd.id,   PortIndex.RIGHT, PortIndex.LEFT,   'OK');

    diagram.selectedNodeId = -1;
    diagram.selectedConnId = -1;
    diagram.setToast('Exemplo de Fluxograma Carregado!');
  },

  loadSystemArchitecture(diagram) {
    diagram.clear();

    const nClient  = diagram.addNode(ShapeType.TERMINATOR, 100, 250, 140, 60,  'Frontend Web');
    const nGateway = diagram.addNode(ShapeType.PROCESS,    320, 250, 150, 60,  'API Gateway (C)');
    const nAuth    = diagram.addNode(ShapeType.PROCESS,    550, 150, 150, 60,  'Auth Service');
    const nCore    = diagram.addNode(ShapeType.SUBPROCESS, 550, 340, 160, 70,  'Core Engine');
    const nCache   = diagram.addNode(ShapeType.DATABASE,   780, 150, 130, 70,  'Redis Cache');
    const nDB      = diagram.addNode(ShapeType.DATABASE,   780, 340, 130, 80,  'Cluster SQL');

    if (nClient && nGateway) diagram.addConnection(nClient.id,  nGateway.id, PortIndex.RIGHT, PortIndex.LEFT,  'HTTPS/JSON');
    if (nGateway && nAuth)   diagram.addConnection(nGateway.id, nAuth.id,    PortIndex.RIGHT, PortIndex.LEFT,  'Validar JWT');
    if (nAuth && nCache)     diagram.addConnection(nAuth.id,    nCache.id,   PortIndex.RIGHT, PortIndex.LEFT,  'Sessão');
    if (nGateway && nCore)   diagram.addConnection(nGateway.id, nCore.id,    PortIndex.RIGHT, PortIndex.LEFT,  'gRPC Call');
    if (nCore && nDB)        diagram.addConnection(nCore.id,    nDB.id,      PortIndex.RIGHT, PortIndex.LEFT,  'Queries');

    diagram.selectedNodeId = -1;
    diagram.selectedConnId = -1;
    diagram.setToast('Arquitetura de Sistema Carregada!');
  },
};

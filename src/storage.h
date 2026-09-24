#ifndef STORAGE_H
#define STORAGE_H

#include "diagram.h"
#include <stdbool.h>

// Salvar e carregar diagrama em arquivo próprio (.diag)
bool Storage_SaveDiagram(const Diagram *d, const char *filepath);
bool Storage_LoadDiagram(Diagram *d, const char *filepath);

// Exportações
bool Storage_ExportPNG(const Diagram *d, const char *filepath);
bool Storage_ExportSVG(const Diagram *d, const char *filepath);

#endif // STORAGE_H

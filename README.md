# DiagramaBot 🔷

> Uma ferramenta moderna, interativa e de alta performance para criação e edição de diagramas e fluxogramas profissionais — disponível tanto como **aplicativo nativo desktop em C99 + Raylib 6.0** quanto em **versão Web interativa via HTML5 Canvas**.

🌐 **Experimente online agora via GitHub Pages**:  
👉 **[https://rhaonyferraz.github.io/diagramabot/](https://rhaonyferraz.github.io/diagramabot/)**

---

## ✨ Funcionalidades Principais

- **🎨 Canvas Infinito Interativo**:
  - Pan livre na tela (`Espaço + Arrastar` ou `Botão Direito do Mouse`).
  - Zoom dinâmico e suave focado na posição do cursor (`Scroll do Mouse` ou botões `+` / `-` / `100%`).
  - Grid de pontos adaptativo com encaixe inteligente (**Snap to Grid**).
  - Janela redimensionável com suporte a altas resoluções (MSAA 4x e VSync).

- **📐 Biblioteca Completa de Formas de Fluxograma**:
  1. **Início / Fim (Terminador)**: Formato de cápsula / pílula arredondada.
  2. **Processo / Ação**: Retângulo com cantos suavizados e sombra elegante.
  3. **Decisão / Condicional**: Losango com 4 portas de derivação ("Sim", "Não", etc.).
  4. **Entrada / Saída (Dados)**: Paralelogramo inclinado clássico.
  5. **Banco de Dados**: Cilindro 3D estilizado com topo e base elípticos.
  6. **Subprocesso**: Retângulo com barras verticais laterais duplas.
  7. **Nota Adesiva (Post-it)**: Bloco amarelo suave com dobra no canto inferior.

- **🔗 Conexões e Setas Inteligentes**:
  - 4 portas de ancoragem magnéticas em cada nó (Superior, Direita, Inferior, Esquerda).
  - Conexão interativa: basta clicar em uma porta azul e arrastar até outro bloco.
  - Curvas cúbicas Bézier suaves com cálculo dinâmico de tangentes e pontas de flecha preenchidas.
  - **Rótulos nas Setas**: Badges estilizados no ponto médio da curva com chips rápidos (`Sim`, `Não`, `OK`, `Erro`).

- **✍️ Edição Direta & Inspetor de Propriedades**:
  - **Edição Inline de Texto**: Dê duplo clique em qualquer bloco ou conexão para editar diretamente na tela com cursor piscante em tempo real.
  - **Paleta de Cores de Designer**: Azul Oceano, Verde Esmeralda, Âmbar Dourado, Rosa/Vermelho Alerta, Roxo Royal, Ciano/Teal, Amarelo Nota e Ardósia Escura.
  - Ajuste de dimensões, duplicação rápida (`Ctrl + D`) e exclusão (`Del`).

- **⚡ Histórico Completo de Alterações**:
  - Suporte a **Desfazer** (`Ctrl + Z`) e **Refazer** (`Ctrl + Y`) com gerenciamento dinâmico de snapshots em heap.

- **💾 Persistência & Exportação**:
  - **Salvar & Carregar (`.diag`)**: Formato leve e transparente para salvar seu trabalho e reabrir quando quiser.
  - **Exportação PNG em Alta Definição**: Renderização offscreen para arquivo `.png` com enquadramento automático de todos os nós.
  - **Exportação SVG Vetorial**: Gera código vetorial SVG limpo e escalável sem perda de qualidade para abrir no navegador, Illustrator, Figma ou documentações.

- **🚀 Modelos Prontos Integrados**:
  - **Exemplo 1**: Fluxograma de Processamento de Pedido e Pagamento.
  - **Exemplo 2**: Arquitetura de Microsserviços e Gateway de API.

---

## 📁 Estrutura do Código

```
diagramabot/
├── bin/
│   └── diagramabot.exe       # Executável compilado
├── src/
│   ├── main.c               # Loop principal, eventos de mouse, teclado e janelas
│   ├── diagram.h / .c       # Estruturas de dados (Nodes, Conexões, Histórico Undo/Redo)
│   ├── renderer.h / .c      # Renderizador geométrico das formas, splines e grid
│   ├── ui.h / .c            # Interface de usuário (Navbar, Sidebars, Inspetor, Toast, Modais)
│   ├── storage.h / .c       # Persistência em arquivo .diag, exportador PNG e SVG
│   └── templates.h / .c     # Fluxogramas e arquiteturas prontas de exemplo
├── vendor/
│   └── raylib-6.0_win64_msvc16/ # Biblioteca Raylib 6.0 64-bit para MSVC
├── build.bat                # Script de compilação automatizada no Windows (MSVC)
└── README.md
```

---

## 🛠️ Como Compilar e Executar

### Pré-requisitos
- Windows 10/11 com **Visual Studio 2022** (com suporte a ferramentas C/C++ instalado).
- O pacote Raylib 6.0 já está incluído na pasta `vendor/`.

### Compilação
Abra o prompt de comando ou PowerShell na raiz da pasta e execute:

```cmd
build.bat
```

O script configura o ambiente MSVC 64-bit e compila o executável gerando:
`bin\diagramabot.exe`.

### Executando a Aplicação
```cmd
bin\diagramabot.exe
```

---

## ⌨️ Tabela de Atalhos de Teclado

| Tecla / Ação | Função |
| :--- | :--- |
| **Espaço + Arrastar** ou **Botão Direito** | Mover o canvas (Pan) |
| **Scroll do Mouse** | Zoom in / Zoom out centrado no cursor |
| **Clique Duplo** | Editar texto do bloco ou conexão inline |
| **Del** ou **Backspace** | Excluir bloco ou conexão selecionada |
| **Ctrl + D** | Duplicar bloco selecionado |
| **Ctrl + Z** / **Ctrl + Y** | Desfazer (Undo) / Refazer (Redo) |
| **Ctrl + S** | Salvar diagrama em `diagrama.diag` |
| **Teclas 1 a 7** | Inserir formas rapidamente na posição do cursor |
| **V** | Modo Seleção / Mover |
| **C** | Modo Conexão (criar setas) |
| **G** | Alternar exibição da grade (Grid) |
| **S** | Alternar alinhamento magnético (Snap to Grid) |
| **F1** ou botão **?** | Abrir janela de ajuda e atalhos |
| **ESC** | Cancelar conexão em andamento ou fechar modais |

---

## 📄 Licença
Desenvolvido em C com Raylib. Uso livre para projetos educacionais, pessoais e profissionais.

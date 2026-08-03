# Graph Report - .  (2026-07-30)

## Corpus Check
- Corpus is ~12,904 words - fits in a single context window. You may not need a graph.

## Summary
- 376 nodes · 481 edges · 18 communities (17 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 65,000 input · 5,869 output

## Community Hubs (Navigation)
- Chamados Ticket Domain & Service
- Componente Lookup & Lupa Modal
- Agendamento Domain & Service
- cnsaagenda Angular Build Config
- pouichamados Dependencies (Angular + PO UI)
- pouichamados Package Scripts & Dev Tooling
- cnsaagenda Dependencies (Angular + PO UI)
- AgendaListaComponent Logic
- pouichamados Angular Build Config
- cnsaagenda Angular Project Config
- cnsaagenda Package Scripts & Metadata
- pouichamados Angular Project Config
- cnsaagenda Dev Tooling
- pouichamados App Bootstrap & Routing
- Cross-App UI Templates (PO UI)
- pouichamados Build Options & PO Theme Assets
- cnsaagenda App Bootstrap & Routing

## God Nodes (most connected - your core abstractions)
1. `ChamadosListaComponent` - 23 edges
2. `AgendaListaComponent` - 22 edges
3. `ChamadoService` - 13 edges
4. `LupaModalComponent` - 11 edges
5. `TipoLupa` - 10 edges
6. `Agendamento` - 9 edges
7. `AgendamentoService` - 8 edges
8. `agenda-angular` - 7 edges
9. `options` - 7 edges
10. `pouichamados` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Chamado (support ticket domain concept)` --semantically_similar_to--> `Agendamento (agenda item domain concept)`  [INFERRED] [semantically similar]
  pouichamados/src/app/features/chamados-lista/chamados-lista.html → cnsaagenda/src/app/features/agenda-lista/agenda-lista.html
- `AnotacaoEditor` --references--> `PO UI Component Library (TOTVS)`  [EXTRACTED]
  pouichamados/src/app/shared/anotacao-editor.html → cnsaagenda/src/app/features/agenda-lista/agenda-lista.html
- `LupaModal` --references--> `PO UI Component Library (TOTVS)`  [EXTRACTED]
  pouichamados/src/app/shared/lupa-modal.html → cnsaagenda/src/app/features/agenda-lista/agenda-lista.html
- `AppShell (pouichamados)` --references--> `PO UI Component Library (TOTVS)`  [EXTRACTED]
  pouichamados/src/app/app.html → cnsaagenda/src/app/features/agenda-lista/agenda-lista.html
- `ChamadosLista` --references--> `PO UI Component Library (TOTVS)`  [EXTRACTED]
  pouichamados/src/app/features/chamados-lista/chamados-lista.html → cnsaagenda/src/app/features/agenda-lista/agenda-lista.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chamados Lista Modal Orchestration** — pouichamados_src_app_features_chamados_lista_chamados_lista_chamadoslista, pouichamados_src_app_shared_anotacao_editor_anotacaoeditor, pouichamados_src_app_shared_lupa_modal_lupamodal [EXTRACTED 1.00]
- **Agenda Viewing Flow (Shell + List + Detail)** — cnsaagenda_src_app_app_appshell, cnsaagenda_src_app_features_agenda_lista_agenda_lista_agendalista, cnsaagenda_src_app_features_agenda_detalhe_modal_agenda_detalhe_modal_agendadetalhemodal [INFERRED 0.75]
- **PO UI Component Library Usage Across Both Apps** — cnsaagenda_src_app_app_appshell, cnsaagenda_src_app_features_agenda_lista_agenda_lista_agendalista, cnsaagenda_src_app_features_agenda_detalhe_modal_agenda_detalhe_modal_agendadetalhemodal, pouichamados_src_app_app_appshell, pouichamados_src_app_features_chamados_lista_chamados_lista_chamadoslista, pouichamados_src_app_shared_anotacao_editor_anotacaoeditor, pouichamados_src_app_shared_lupa_modal_lupamodal [EXTRACTED 1.00]

## Communities (18 total, 1 thin omitted)

### Community 0 - "Chamados Ticket Domain & Service"
Cohesion: 0.09
Nodes (24): AgendarResposta, AlterarChamado, AlterarResposta, AnotacaoResposta, AnotacaoSalvarResposta, AssumirResposta, Chamado, ChamadoPagina (+16 more)

### Community 1 - "Componente Lookup & Lupa Modal"
Cohesion: 0.08
Nodes (13): ComponenteItem, ComponenteResposta, TipoLupa, ComponenteService, Injectable, ChamadosListaComponent, Component, ViewChild (+5 more)

### Community 2 - "Agendamento Domain & Service"
Cohesion: 0.10
Nodes (22): Agendamento, AgendamentoPagina, FiltroAgendamento, FwModelField, FwModelGridModel, FwModelResource, FwModelResponse, AgendamentoService (+14 more)

### Community 3 - "cnsaagenda Angular Build Config"
Cohesion: 0.07
Nodes (29): build, serve, builder, configurations, defaultConfiguration, options, development, production (+21 more)

### Community 4 - "pouichamados Dependencies (Angular + PO UI)"
Cohesion: 0.07
Nodes (29): @po-ui/ng-templates, @po-ui/style, dependencies, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser (+21 more)

### Community 5 - "pouichamados Package Scripts & Dev Tooling"
Cohesion: 0.07
Nodes (26): allowScripts, devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, jsdom, prettier, typescript (+18 more)

### Community 6 - "cnsaagenda Dependencies (Angular + PO UI)"
Cohesion: 0.09
Nodes (23): dependencies, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, @po-ui/ng-components (+15 more)

### Community 8 - "pouichamados Angular Build Config"
Cohesion: 0.10
Nodes (22): build, serve, test, builder, configurations, defaultConfiguration, development, production (+14 more)

### Community 9 - "cnsaagenda Angular Project Config"
Cohesion: 0.11
Nodes (18): architect, prefix, projectType, root, schematics, sourceRoot, test, cli (+10 more)

### Community 10 - "cnsaagenda Package Scripts & Metadata"
Cohesion: 0.12
Nodes (16): allowScripts, core-js@3.49.0, esbuild@0.28.1, lmdb@3.5.1, msgpackr-extract@3.0.4, @parcel/watcher@2.5.6, name, packageManager (+8 more)

### Community 11 - "pouichamados Angular Project Config"
Cohesion: 0.12
Nodes (15): cli, analytics, packageManager, newProjectRoot, prefix, projectType, root, schematics (+7 more)

### Community 12 - "cnsaagenda Dev Tooling"
Cohesion: 0.13
Nodes (15): devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, jsdom, prettier, typescript, vitest (+7 more)

### Community 13 - "pouichamados App Bootstrap & Routing"
Cohesion: 0.22
Nodes (6): App, appConfig, routes, Component, ChamadosRestAdapterInterceptor, Injectable

### Community 14 - "Cross-App UI Templates (PO UI)"
Cohesion: 0.26
Nodes (12): AppShell (cnsaagenda), AgendaDetalheModal, AgendaLista, Agendamento (agenda item domain concept), PO UI Component Library (TOTVS), index.html (cnsaagenda / AgendaAngular), AppShell (pouichamados), Chamado (support ticket domain concept) (+4 more)

### Community 15 - "pouichamados Build Options & PO Theme Assets"
Cohesion: 0.17
Nodes (12): options, src/styles.scss, zone.js, assets, browser, inlineStyleLanguage, polyfills, styles (+4 more)

### Community 16 - "cnsaagenda App Bootstrap & Routing"
Cohesion: 0.33
Nodes (4): App, appConfig, routes, Component

## Knowledge Gaps
- **143 isolated node(s):** `$schema`, `version`, `packageManager`, `analytics`, `newProjectRoot` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChamadosListaComponent` connect `Componente Lookup & Lupa Modal` to `Chamados Ticket Domain & Service`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `dependencies` connect `pouichamados Dependencies (Angular + PO UI)` to `pouichamados Package Scripts & Dev Tooling`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `dependencies` connect `cnsaagenda Dependencies (Angular + PO UI)` to `cnsaagenda Package Scripts & Metadata`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `$schema`, `version`, `packageManager` to the rest of the system?**
  _143 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chamados Ticket Domain & Service` be split into smaller, more focused modules?**
  _Cohesion score 0.09390243902439024 - nodes in this community are weakly interconnected._
- **Should `Componente Lookup & Lupa Modal` be split into smaller, more focused modules?**
  _Cohesion score 0.07807807807807808 - nodes in this community are weakly interconnected._
- **Should `Agendamento Domain & Service` be split into smaller, more focused modules?**
  _Cohesion score 0.09879032258064516 - nodes in this community are weakly interconnected._
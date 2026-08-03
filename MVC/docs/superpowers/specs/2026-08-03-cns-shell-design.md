# Design: Shell central `cns` (apia.com.br/cns)

## Contexto

Hoje existem 3 aplicações Angular independentes (`pouichamados`, `cnsaagenda`, `pouios`), cada uma cobrindo um módulo (Chamados, Agenda, Ordens de Serviço). Todas rodam embutidas no Protheus via ponte `FwCallApp`/`ProJsToAdvplService` (`@totvs/protheus-lib-core`), sem tela de login própria — a sessão vem do Protheus. Apenas `pouichamados` tem um `po-menu` próprio (Chamados/Agenda/OS/Sair), mas a navegação para Agenda/OS via esse menu não funciona de fato (chama `jsToAdvpl('abrirApp', ...)`, cujo registro no lado Protheus ainda não existe). `cnsaagenda` e `pouios` não têm menu, apenas `<router-outlet>`.

Objetivo: criar uma tela central nova, publicada em `apia.com.br/cns`, com um menu lateral único (Home/Chamados/Agenda/OS) e uma home com calendário, que reúne os 3 módulos em uma experiência integrada — sem tocar nos projetos originais, que devem continuar funcionando exatamente como hoje dentro do Protheus.

Integração de autenticação com o site `apia.com.br` (que já possui login) fica fora de escopo deste design — decidida posteriormente, quando a rota `/cns` for plugada no app principal do site. Este design cobre apenas a construção do shell e sua composição com os 3 módulos.

## Decisões

- **Não alterar os projetos originais** (`MVC/pouichamados`, `MVC/cnsaagenda`, `MVC/pouios`). Eles continuam intactos e no ar como estão hoje, embutidos no Protheus.
- Criar um projeto novo, separado, chamado **`cns-super`**, contendo:
  - **Cópias** dos 3 projetos (com as adaptações necessárias abaixo).
  - Um **4º projeto novo**, `cns-shell`, que é o host/base do site — dono único do menu de navegação.
- Composição via **Module Federation** (`@angular-architects/native-federation`, compatível com o build esbuild do Angular 21 usado pelos 3 projetos — não é o Module Federation clássico de Webpack).
- Autenticação: fora de escopo agora. `cns-shell` assume, por enquanto, que chega já autenticado (sem tela de login), deixando um ponto de extensão claro para quando a integração com `apia.com.br` for definida.
- Calendário na Home é **decorativo** (`po-calendar p-mode="range" p-range-presets`), sem integração com dados dos 3 módulos.

## Arquitetura

`cns-shell` é o **host** de Module Federation. Cada uma das 3 cópias (`pouichamados`, `cnsaagenda`, `pouios` dentro de `cns-super`) se torna um **remote**, expondo suas rotas via `federation.config.js` (gera `remoteEntry.json` no build). O shell carrega cada remote sob demanda (lazy, via `loadRemoteModule`) quando o usuário clica no item correspondente do menu — sem iframe, roteamento nativo do Angular Router dentro do `cns-shell`.

Pré-requisito técnico: alinhar a versão de `@po-ui/ng-components` entre as 3 cópias (hoje `pouichamados`/`cnsaagenda` estão em `^21.23.0` e `pouios` em `^21.26.0`) e completar dependências faltantes no `cnsaagenda` (`@po-ui/ng-templates`, `@totvs/po-theme`), já que Module Federation exige que dependências compartilhadas (`shared`) estejam na mesma versão entre host e remotes para não quebrar em runtime.

## Estrutura de pastas

```
MVC/
  cns-super/                  <- novo, projeto separado
    cns-shell/                <- 4º projeto: shell (menu + home/calendário), host da federation
    pouichamados/              <- cópia do original, sem po-menu interno, + federation.config.js
    cnsaagenda/                <- cópia do original, + federation.config.js
    pouios/                    <- cópia do original, + federation.config.js
  pouichamados/                <- original, intacto
  cnsaagenda/                  <- original, intacto
  pouios/                      <- original, intacto
```

Trade-off aceito: manutenção duplicada (correção num lado não propaga pro outro automaticamente). Escolhido deliberadamente para não colocar em risco os projetos originais que já funcionam em produção dentro do Protheus.

## Componentes

- **`cns-shell`**: `po-menu` único (Home / Chamados / Agenda / OS) + roteador principal. Único dono da navegação de todo o site.
- **Home** (`/`): página com `po-calendar p-mode="range" p-range-presets`, visual, sem lógica de filtro por trás.
- **`/chamados`, `/agenda`, `/os`**: rotas lazy que usam `loadRemoteModule` apontando para o `remoteEntry.json` de cada cópia federada, montando as rotas internas de cada módulo dentro do `router-outlet` do shell.
- **Cópia de `pouichamados`**: remove o `po-menu` de `app.html`/`app.ts` (hoje só navega de forma quebrada para Agenda/OS) — passa a ser conteúdo puro, no mesmo formato que `pouios` já é hoje.
- **Cópia de `cnsaagenda`**: já é conteúdo puro (`<router-outlet>`), sem mudança estrutural.
- **Cópia de `pouios`**: já está no formato correto (conteúdo puro), sem mudança estrutural.
- Todas as 3 cópias ganham `federation.config.js` expondo suas rotas como remote. A lógica de negócio interna de cada uma não é alterada.

## Fluxo de dados

Nenhum estado compartilhado entre módulos por enquanto. Cada remote continua isolado, com sua própria comunicação com o backend Protheus (proxy para `10.0.0.3:3624`). O shell apenas roteia visualmente entre eles. O calendário da Home não filtra nem consome dados de nenhum módulo. Sem store global, sem serviço cross-app — escopo mínimo até haver necessidade real de integração entre módulos.

## Tratamento de erro

Se o carregamento de um remote falhar (rede indisponível, `remoteEntry.json` fora do ar), o shell exibe um alerta (`po-alert`/toast) no lugar do conteúdo, sem quebrar o menu nem afetar os demais módulos já carregados. `loadRemoteModule` é envolvido em try/catch no momento da navegação lazy.

## Teste

Sem testes automatizados neste escopo. Validação manual:
- Cada item do menu do `cns-shell` carrega o remote correto no lugar certo da tela.
- Calendário renderiza corretamente na Home.
- Os 3 projetos **originais** continuam funcionando standalone dentro do Protheus, sem qualquer alteração de comportamento (build/deploy deles não muda).

## Fora de escopo (decidido para depois)

- Integração da rota `/cns` dentro do app principal `apia.com.br` (local do código desse site ainda não identificado).
- Reaproveitamento da sessão/login do `apia.com.br` pelo `cns-shell`.
- Qualquer funcionalidade de dados no calendário da Home (hoje puramente visual).

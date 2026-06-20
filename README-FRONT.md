# README-FRONT

## O que este arquivo explica

Este arquivo existe para deixar claro como o front do site esta organizado hoje, quais arquivos mandam em cada parte da interface e onde mexer quando voce quiser ajustar layout, texto, tema ou navegacao.

O objetivo do novo front foi:

- deixar o site mais pratico
- manter as mesmas funcoes principais
- preservar as cores e a identidade geral
- reduzir blocos de texto inutil
- centralizar a estrutura visual para facilitar manutencao

## Stack usada no front

Nada novo foi instalado so por causa da refacao do front.

O que ja existia e continua sendo a base:

- `Next.js` com App Router
- `React`
- `Tailwind CSS`
- `lucide-react`
- `date-fns`
- `next/image`
- `@radix-ui/react-dialog` no menu mobile

## Estrutura principal do front

### 1. Layout global

Arquivo:

- `app/layout.tsx`

Responsavel por:

- carregar o CSS global
- ler o cookie `dadg-theme`
- aplicar a classe `dark` no `html`
- envolver tudo com `SiteShell`

Na pratica:

- se o tema salvo for `dark`, o site ja abre escuro
- o layout global nao define mais fonte custom estranha

### 2. Casca do site

Arquivo:

- `app/components/site-shell.tsx`

Responsavel por:

- header principal
- navegacao desktop
- menu mobile
- footer
- botao de dark mode
- estrutura base de todas as paginas

Aqui ficam:

- logo do header
- links principais
- CTA de ouvidoria
- chips das redes no footer

Observacao:

- os `@` do footer ja foram removidos aqui

### 3. Toggle de tema

Arquivo:

- `app/components/theme-toggle.tsx`

Responsavel por:

- alternar entre claro e escuro
- salvar a escolha em `cookie`
- salvar tambem em `localStorage`
- reaplicar o tema quando a pessoa volta depois

Cookie usado:

- `dadg-theme`

### 4. Estilos base

Arquivo:

- `app/globals.css`

Aqui ficam os estilos globais do novo front:

- variaveis de cor
- superfices glass
- classes utilitarias de secao
- comportamento visual geral do light e dark mode

Se quiser mexer no clima visual geral do site, normalmente e aqui que voce comeca.

### 5. Blocos reutilizaveis de pagina

Arquivo:

- `app/components/site-sections.tsx`

Componentes principais:

- `PageHero`
- `SectionHeading`
- `InfoCard`
- `StatStrip`

Esses componentes foram criados para evitar repetir o mesmo layout em varias paginas.

## Conteudo centralizado

Arquivo:

- `app/lib/site-content.ts`

Esse arquivo virou um ponto central para dados institucionais reutilizados no front.

Hoje ele concentra:

- `siteNavigation`
- `socialAccounts`
- `coordinatorProfiles`
- `coordinatorCards`

Se voce quiser trocar:

- nome de item do menu
- descricao do menu mobile
- links sociais do footer
- dados das coordenadorias

o lugar certo normalmente e esse arquivo.

## Paginas que ja seguem a estrutura nova

### Home

Arquivo:

- `app/page.tsx`

O que tem:

- hero principal
- cards de acesso rapido
- cards das coordenadorias
- CTA final para ouvidoria
- popup compacto com proximos eventos

Componente importante da home:

- `app/components/UpcomingSchedulePopup.tsx`

Esse popup:

- fica fixo no canto inferior direito
- abre recolhido por padrao
- pode expandir
- pode ser fechado
- busca eventos das proximas 2 semanas
- foi ajustado para nao passar do header nem estourar a tela

### Eventos

Arquivos:

- `app/eventos/page.tsx`
- `app/components/ScheduleClient.tsx`

O fluxo e:

- a pagina monta o hero
- o `ScheduleClient` cuida do calendario
- os eventos sao buscados pela rota `api/get/eventsByDate`

### Certificados

Arquivo principal:

- `app/certificados/page.tsx`

Essa pagina faz:

- busca por nome, email, CPF ou evento
- salva busca e resultados no `localStorage`
- mostra cards clicaveis com os resultados

Comportamento visual atual:

- a barra de busca continua clara
- os cards de resultado adaptam no dark mode
- o texto dos cards foi ajustado para nao sumir no escuro

### Visualizacao do certificado aberto

Arquivo:

- `app/certificados/meuCertificado/[certificateId]/page.tsx`

Importante:

- essa tela foi mantida visualmente isolada do tema
- mesmo com dark mode ativo, o mostrador do certificado continua branco

Isso foi feito para nao quebrar a leitura e nem mudar o visual do certificado em si.

### Coordenadorias

Arquivo principal:

- `app/coordenadorias/page.tsx`

Essa pagina agora funciona como uma vitrine simples das coordenadorias.

Ela usa:

- `coordinatorCards` de `app/lib/site-content.ts`

Comportamento atual:

- cards com imagem
- identidade de cor por coordenadoria
- contraste corrigido no dark mode

### Mural

Arquivo:

- `app/mural/page.tsx`

O mural foi simplificado para:

- hero curto
- lista direta de avisos
- leitura rapida

Os avisos sao puxados do Contentful.

### Outras paginas ja alinhadas ao novo padrao

Arquivos:

- `app/sobre/page.tsx`
- `app/contato/page.tsx`
- `app/ouvidoria/page.tsx`

Essas paginas tambem usam a base nova com `PageHero` e `InfoCard`.

## Coordenadorias: o que esta novo e o que ainda e legado

Existe um template novo para coordenadorias:

- `app/components/coordinator-template.tsx`

Esse arquivo foi pensado para padronizar paginas internas de coordenadoria com:

- hero
- blocos de contexto
- valores
- destaques
- equipe
- QR code quando existir

Mas atencao:

- nem todas as paginas internas de coordenadoria foram migradas para esse template ainda

Paginas que ainda podem ter estrutura antiga ou CSS proprio:

- `app/coordenadorias/caep/page.tsx`
- `app/coordenadorias/caes/page.tsx`
- `app/coordenadorias/cac/page.tsx`
- `app/coordenadorias/clam/page.tsx`
- `app/coordenadorias/clev/page.tsx`
- `app/coordenadorias/clam/liga/[id]/page.tsx`

Ou seja:

- a pagina lista `/coordenadorias` esta no padrao novo
- varias paginas internas ainda carregam estrutura antiga

## Fluxos de dados importantes

### 1. Eventos

Rota usada:

- `app/api/get/eventsByDate/route.ts`

Consumidores principais:

- `app/components/ScheduleClient.tsx`
- `app/components/UpcomingSchedulePopup.tsx`

### 2. Mural

Fonte:

- `app/lib/contentful.ts`

Consumidor:

- `app/mural/page.tsx`

### 3. Certificados

Rotas importantes:

- `app/api/get/myCertificate/[search]/route.ts`
- `app/api/get/myCertificateById/[certificateId]/route.ts`
- `app/api/get/templateProxy/[certificateId]/route.ts`
- `app/api/get/templateScanProxy/[certificateId]/route.ts`
- `app/api/get/downloadCertificate/[certificateId]/route.ts`

Fluxo resumido:

1. a busca lista certificados
2. o clique abre a pagina individual
3. a pagina individual busca os dados e o template/imagem do certificado
4. o usuario pode visualizar e baixar

## Atencoes tecnicas importantes

### 1. Dark mode

O dark mode agora depende de dois pontos:

- cookie `dadg-theme`
- `localStorage` com a mesma chave

Se um dia o tema parar de persistir, os primeiros arquivos para revisar sao:

- `app/layout.tsx`
- `app/components/theme-toggle.tsx`

### 2. Imagens com `fill`

Quando usar `next/image` com `fill`, coloque `sizes`.

Isso ja foi ajustado nas areas refeitas para evitar warning do Next.

### 3. Certificados e tema

Nao aplique dark mode no mostrador interno do certificado aberto sem querer.

Essa foi uma decisao intencional para manter:

- leitura correta
- visual original
- contraste confiavel para impressao e download

### 4. APIs de certificado e variaveis de ambiente

Hoje existe uma atencao importante no backend dos certificados:

- algumas rotas de certificado esperam nomes de env como `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_ENDPOINT`
- no `.env.local` atual existem nomes como `R2_ACCESS_KEY`, `R2_SECRET_KEY` e `R2_ENDPOINT_URL`

Se a busca abrir e a pagina individual do certificado der erro `CredentialsError`, esse e um dos primeiros pontos para conferir.

### 5. AWS SDK

O projeto ainda usa `aws-sdk` v2 em parte do fluxo de certificados.

Isso gera warning de biblioteca antiga, mas esse warning e separado do problema de credenciais.

## Pastas e arquivos que ainda carregam legado

Ainda existem arquivos antigos no projeto que nao sao o centro da nova estrutura:

- CSSs por pagina como `style.css`, `styles.css` e `styles.module.scss`
- componentes antigos como `MenuDrawer`, `DrawerMenu`, `Carousel` e outros

Isso nao significa que tudo esta errado.

Significa so que:

- a nova organizacao principal esta concentrada nos componentes compartilhados
- alguns pedacos antigos ainda coexistem e podem ser limpos aos poucos

## Como mexer rapido em cada tipo de ajuste

### Quero trocar menu, footer ou navegacao

Veja:

- `app/components/site-shell.tsx`
- `app/lib/site-content.ts`

### Quero trocar o comportamento do dark mode

Veja:

- `app/components/theme-toggle.tsx`
- `app/layout.tsx`
- `app/globals.css`

### Quero trocar a cara geral das paginas novas

Veja:

- `app/components/site-sections.tsx`
- `app/globals.css`

### Quero editar a home

Veja:

- `app/page.tsx`
- `app/components/UpcomingSchedulePopup.tsx`

### Quero editar eventos

Veja:

- `app/eventos/page.tsx`
- `app/components/ScheduleClient.tsx`

### Quero editar certificados

Veja:

- `app/certificados/page.tsx`
- `app/certificados/meuCertificado/[certificateId]/page.tsx`

### Quero editar coordenadorias

Veja:

- lista geral: `app/coordenadorias/page.tsx`
- dados centrais: `app/lib/site-content.ts`
- template novo: `app/components/coordinator-template.tsx`
- paginas internas antigas: `app/coordenadorias/*`

### Quero editar mural

Veja:

- `app/mural/page.tsx`
- `app/lib/contentful.ts`

## Resumo curto

Hoje a espinha dorsal do front novo esta aqui:

- `app/layout.tsx`
- `app/components/site-shell.tsx`
- `app/components/theme-toggle.tsx`
- `app/components/site-sections.tsx`
- `app/lib/site-content.ts`
- `app/globals.css`

Se voce entender esses arquivos primeiro, quase todo o restante do front fica facil de localizar.

# Integração DADG: contas, eventos e certificados

Branch `codex/auditoria-integracao`, base `ce4fcfe`. Par: mesma branch no `dadg-site-principal`, base `14ed0c9`.

## O que foi implementado

- Guarda de autorização nos handlers, além do proxy. Escritas administrativas exigem sessão/role de administrador; token de aluno não substitui essa sessão.
- Consulta pública de certificados liberados com DTO sem CPF, e-mail ou ID de perfil, busca literal, paginação e limite por instância. PDF e imagens são servidos pelo backend. O conteúdo nominal do próprio certificado permanece público.
- Perfil identificado por issuer + subject, incluindo login social; inscrições usam ID interno do perfil e aceite vigente. O aluno tem um QR Code pessoal único, assinado pelo backend e exibido no perfil; a leitura só é aceita para inscrição confirmada (nas pagas, após confirmação pelo provedor).
- Inscrição transacional: janela, capacidade, duplicidade, conflito de horários; índice único evento/perfil obrigatório. Cancelamento gratuito antes do início preserva histórico; pagamento exige organização.
- Cobrança de evento no Mercado Pago com valor imutável em centavos, reserva de 15 minutos, preferência única, webhook assinado, conciliação com trava e recuperação de falha incerta. CLAM mantém o provedor existente.
- Entrada, saída e emissão com transação e auditoria. A presença é registrada por etapa do cronograma. Política de emissão: evento terminou + carga horária definida + percentual mínimo de etapas com entrada e saída (campo do evento, padrão 100%); máximo de 100 certificados por chamada, com repetição idempotente. Arquivar evento preserva certificados e participantes.
- Biblioteca de certificados separada do histórico de inscrições. Solicitação manual, justificativa do administrador, aprovar/rejeitar/revogar e histórico de decisões. Vínculo automático exige CPF válido e e-mail verificado coincidentes; nome nunca autoriza vínculo. Qualquer solicitação/decisão anterior impede vínculo automático.
- Upload valida bytes, decodifica imagem (até 40 milhões de pixels) ou PDF (até 50 páginas), limite de 10 MB e compensação R2. Importação XLSX/CSV com prévia, limites e lote transacional deduplicado. XLS antigo precisa ser convertido para XLSX/CSV.
- HTML do blog sanitizado, leituras limitadas; dependências atualizadas; CI de lint, tipos, testes, auditoria de dependências e build.

## Pré-requisitos de ativação

Em 11/10/2026 o `audit-maintenance.ts --mode=apply` foi executado no banco `dadg` de produção, com aprovação explícita e backup prévio (mongodump local `backup-11-10`): zero duplicidades evento/perfil, quatro coleções e quatro índices criados, nenhum documento alterado. Os scripts de QA nunca foram executados contra banco real. Não habilitar eventos novos antes de preparar os índices e homologar o fluxo. `CERTIFICATE_AUTO_LINK_ENABLED` deve continuar ausente/false até a auditoria do acervo; a revisão manual continua disponível.

O usuário exige aprovação explícita antes de qualquer acesso a banco, inclusive inspeção. Para alterações, exige também backup recuperável. Os comandos abaixo são um roteiro, não uma autorização para execução.

### Banco

MongoDB precisa suportar transações (replica set/Atlas). Configure `MONGODB_URI` e, preferencialmente, `MONGODB_DB` explícito. Auto-criação de coleções e índices foi desabilitada no aplicativo. Para uma instalação nova, executar também a manutenção de perfis existente com aprovação própria.

1. Confirmar ambiente, banco, coleções e identificador do backup; testar recuperação antes de alterações em dados reais.
2. Carregar as variáveis do ambiente escolhido sem imprimir segredos. Inspeção somente leitura:

```powershell
npx tsx scripts/audit-maintenance.ts --db=NOME_EXATO --mode=inspect
```

Lê `certificates.participants` (duplicidades de perfil/evento) e `certificates.datails` (contagem/cobertura de campos); imprime apenas agregados. Esta inspeção não prova titularidade nem qualidade do CPF/e-mail: o acervo ainda precisa dessa conferência antes do vínculo automático.

3. Após aprovação distinta e backup confirmado:

```powershell
npx tsx scripts/audit-maintenance.ts --db=NOME_EXATO --mode=apply --backup-id=IDENTIFICADOR_RECUPERAVEL
```

Repete a inspeção e cria as coleções `events.paymentOrders`, `events.audit`, `certificates.claims`, `certificates.imports`; cria índices em participantes (único parcial evento/perfil), certificados (perfil/liberação), solicitações (perfil/status) e cobranças (status/expiração). Não converte eventos históricos nem vincula documentos em massa. Interrompe diante de duplicidades antes do índice único. O identificador de backup é declarado pelo operador; o script não verifica a existência do backup.

4. Conferir contadores dos eventos que receberão novas inscrições antes de publicá-los. O script não reconta nem corrige eventos antigos. `CERTIFICATE_ONLY` permanece histórico.

### Auth0

Site: `/criar-conta` abre Universal Login com `screen_hint=signup`, retorno `/perfil`. Habilitar signup no tenant e revisar callbacks/origens dos dois ambientes. Backend preserva `DADG_ADMIN_ROLE_NAME=Administrador` e claim `https://dadg.com.br/roles` no ID token administrativo.

Token de acesso do aluno precisa ter issuer/audience esperados e e-mail verificado. Para API customizada, adicionar uma Post Login Action ao fluxo, usando claims com namespace:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  api.accessToken.setCustomClaim('https://dadg.com.br/email', event.user.email);
  api.accessToken.setCustomClaim('https://dadg.com.br/email_verified', event.user.email_verified === true);
};
```

No backend, definir `STUDENT_AUTH0_EMAIL_CLAIM=https://dadg.com.br/email` e `STUDENT_AUTH0_EMAIL_VERIFIED_CLAIM=https://dadg.com.br/email_verified`. Defaults são `email`/`email_verified`. Usuário deve entrar novamente para receber claims novas. Não presumir e-mail verificado apenas por estar autenticado.

### Pagamentos, cron e arquivos

- `APP_BASE_URL`: URL HTTPS deste backend; `STUDENT_SITE_URL`: URL do site do aluno.
- `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` do ambiente. Eventos notificam `/api/events/webhook`; CLAM preserva sua configuração atual. Homologar assinatura, retries, pagamento aprovado, pendente, estorno e chargeback.
- `CRON_SECRET`: segredo longo. O `vercel.json` agenda GET `/api/cron/reconcile-payments` a cada 15 minutos; a Vercel envia `Authorization: Bearer <segredo>` sozinha e só executa o cron em produção (plano Pro). O agendamento passa a valer no primeiro deploy de produção com esse arquivo e com `CRON_SECRET` definido; sem a variável a rota responde 401. Processa até 10 cobranças de evento + 10 CLAM por chamada.
- Preferência com criação incerta sem confirmação do provedor continua em revisão e mantém a reserva. Não liberar a vaga manualmente enquanto houver cobrança potencialmente pagável. `/event-payments` permite consultar e conciliar. Estornos são feitos no provedor e depois conciliados; o painel não inventa quitação nem dispara reembolso automático.
- R2: `R2_ENDPOINT_URL` (ou `R2_ENDPOINT`), `R2_ACCESS_KEY`/`R2_ACCESS_KEY_ID`, `R2_SECRET_KEY`/`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_SUBFOLDER`.
- Manter chaves de CPF existentes: `PROFILE_CPF_ACTIVE_KEY_VERSION`, `PROFILE_CPF_ENCRYPTION_KEY_<VERSAO>`, `PROFILE_CPF_LOOKUP_KEY`; não rotacionar sem plano próprio.
- Limite de consulta pública em memória protege cada instância. Em produção, configurar também regra de taxa no CDN/WAF; cabeçalho de IP deve ser sobrescrito pelo proxy confiável.

## Validação e limites

Verificações sem banco: `npm run lint`, `npm run typecheck`, `npm test`, `npm audit`, `npm run build`. Build usa credenciais fictícias e `DB_ACCESS_DISABLED=1` nas verificações locais/CI. Esse flag deve estar AUSENTE em produção. Há aviso de empacotamento dinâmico no SDK Auth0 (DPoP); não é confirmação de falha no login.

Testes de fronteira executam handlers com dependências falsas: escrita recusada antes da mutação; scan liberado/oculto, com e sem `|front`; DTO, regex literal, provas de vínculo, upload, CSV/XLSX, autorização e contratos de pagamento.

Teste transacional inicial executado após autorização explícita e confirmação de backup; resultado PASS:

```powershell
$env:APPROVED_TEMP_DB_TEST='yes'
npx tsx scripts/qa-audit-integration.ts
```

Cria um MongoMemoryReplSet local e o banco `dadg_audit_integration`, sem ler `.env` e substituindo a URI por uma gerada localmente. Coleções: `users.profiles`, `users.privacyAcceptances`, `certificates.events`, `certificates.participants`, `certificates.datails`, `certificates.claims`, `events.paymentOrders`, `events.audit`. Escreve fixtures/índices e remove somente a instância temporária no final; fixtures são a recuperação reproduzível. Gateway falso: nenhum pagamento real. Não confundir os testes unitários com esta prova de concorrência.

Ainda exigem homologação: Auth0 real (cadastro, confirmação de e-mail, login social), envio/consulta R2 e PDF real, pagamentos e retries no Mercado Pago, cron implantado, coleção histórica e evidências de titularidade. A auditoria anterior do acervo não concluiu a leitura por timeout. Não anunciar o vínculo automático como pronto para acervo inteiro.

## Ordem de publicação e rollback

1. Revisar e integrar backend; preparar ambiente/banco aprovado; homologar com evento novo e contas de teste.
2. Integrar site apontando para o backend compatível. Os aliases antigos do site preservam os caminhos, mas agora dependem do backend.
3. Ativar signup e publicar eventos novos após os testes; liberar vínculo automático apenas depois da auditoria histórica.
4. Se houver falha, fechar inscrições no painel e desabilitar vínculo automático. Preservar coleções novas, cobranças e auditoria; conciliar pagamentos em trânsito. Reverter ambos os deploys de forma coordenada. Não apagar histórico nem restaurar backup sobre pagamentos recentes sem reconciliação específica.

## Melhorias que continuam fora da prova desta entrega

Auditoria integral do banco real, testes autenticados no ambiente implantado, ajuste de conteúdos reais (processos seletivos antigos/de teste, contatos institucionais), matriz de permissões administrativas por função, moderação editorial e proteção distribuída contra abuso. Esses pontos precisam de dados/configuração ou decisões da organização; não foram simulados como concluídos.

## Limite da consulta pública através do site

Definir o mesmo `PUBLIC_PROXY_RATE_LIMIT_SECRET` aleatório nos dois projetos. O site envia uma chave de visitante sem IP em texto, assinada e com validade de 60 segundos; o backend verifica antes de aplicar o limite por visitante (60/minuto/instância). Sem assinatura, usa limite por rede (600/minuto/instância), para não concentrar todos os visitantes do site em um limite individual. O proxy da hospedagem deve sobrescrever `x-forwarded-for`. Complementar com proteção distribuída no CDN/WAF.

## Evidências da entrega

- `npm run typecheck`: passou nos dois projetos.
- `npm run lint`: passou; backend mantém um aviso de otimização de imagem em `app/Silvio/page.tsx`.
- `npm test`: 82 testes no backend e 17 no site, todos passaram (sem banco).
- `npm audit`: zero vulnerabilidades reportadas nos dois lockfiles após as atualizações.
- `npm run build`: builds completos passaram com credenciais fictícias e banco bloqueado; aviso de importação dinâmica do Auth0 permanece.
- `qa-audit-integration.ts`: PASS em Mongo local autorizado; confirmou inscrição paralela idempotente, contador, histórico do cancelamento, reserva paga, checkout sem duplicação, repetição de webhook, restrição de cancelamento pago, liberação e DTO público.
- `qa-audit-lifecycle.ts`: PASS após autorização específica da bateria ampliada e backup confirmado. No mesmo Mongo temporário: estorno repetido, expiração com fechamento prévio, cancelamento sem reabertura por replay, vínculo manual/aprovação/revogação, proibição de reassociar após revogar, correspondência automática com CPF/e-mail, rejeição de homônimo, entrada/saída, emissão única e bloqueio de remoção de presença após emitir. Autenticação e gateway foram simulados; transações e consultas foram reais no banco descartável.
- Revisão independente identificou e levou à correção de um alias legado com dados pessoais, da compatibilidade `scanId|front` e do parser CSV. Testes executam esses caminhos com dependências simuladas; o teste Mongo inicial confirma a filtragem real da consulta pública.
- Consulta pública liberada e escrita administrativa legítima foram mantidas em caminhos distintos. A prévia administrativa de template não depende de publicar um certificado para funcionar. Server action de prévia também exige administrador.
- Navegador interno bloqueou localhost (`ERR_BLOCKED_BY_CLIENT`) e Chrome não estava disponível; validação visual/interativa não foi concluída.

Essas evidências validam o código local; não comprovam configuração do tenant, pagamento externo, storage, cron, conteúdo institucional ou deploy. A ativação de produção permanece pendente dessas etapas e da aprovação de banco correspondente.

## Atualização de 11/10/2026: presença por QR

Correções e mudanças feitas depois da entrega inicial. Tudo validado apenas por lint, tipos, testes sem banco e build; a leitura real com câmera, o Auth0 e os scripts de QA com Mongo ainda não foram exercitados com este código.

### O que mudou

- **QR pessoal único.** Sai o ingresso por inscrição. O perfil do aluno devolve `attendanceQr`, formado pelo ID do perfil e uma assinatura HMAC-SHA256 com `ATTENDANCE_QR_SECRET`; nada é gravado no banco. A leitura passou de `GET` com o código na URL para `POST /api/v1/events/:id/checkin/scan` com `{ token, stageId }` no corpo. Respostas específicas: não inscrito (com o nome do aluno), aguardando pagamento, em revisão e cancelada. O código antigo por inscrição continua aceito durante a transição.
- **Leitor.** O QR do site voltou a ser escuro sobre fundo claro e o leitor aceita também imagem invertida. Antes disso a leitura não funcionava.
- **Presença por etapa.** Cada etapa do cronograma tem `id` estável (preservado ao salvar o cronograma) e o participante guarda `attendance: [{ stageId, checkedInAt, checkedOutAt }]`. Os campos `checkedIn`/`checkedOut` ficaram como resumo (primeira entrada, última saída). Conta a etapa com entrada e saída. Evento cujo cronograma ainda não tem `id` segue com uma entrada e uma saída até o cronograma ser salvo em Editar evento; presenças registradas no modelo antigo continuam valendo.
- **Certificado.** `minAttendancePercent` no evento (1 a 100, padrão 100). A carga horária do evento agora tem campo na criação e na edição; sem ela a liberação responde 409.
- **Edição de evento.** A tela reenviava o formulário inteiro a cada campo, com `isPaid: false` e `price: 0`. Isso bloqueava qualquer edição de evento com inscritos e tornava gratuito um evento pago sem inscritos. Agora envia só o campo salvo.
- **Adicionar sem QR.** Duplicidade e evento indisponível respondem 409 com mensagem. O lançamento manual conta a vaga mas não é barrado pela lotação; evento pago continua recusado. A entrada vai para a etapa selecionada.
- **CPF na lista de presença.** A lista devolve só `cpfMasked` e não envia mais CPF, CPF cifrado nem `qrToken`. A busca por CPF completo é um `POST` na mesma rota.
- **Operador de presença.** Tipo de acesso `operator` (role de administrador ou de operador). Alcança apenas `/presenca`, `/todosEventos/:id/presenca`, `GET /api/v1/events/attendance`, participantes, leitura, entrada/saída e lançamento manual. A auditoria grava o papel de quem registrou.
- **Cancelamento.** O índice `qrToken_1` de produção é único e não esparso. Remover o campo ao cancelar faria a segunda inscrição cancelada falhar; o cancelamento e a conciliação passaram a trocar o valor por outro aleatório.

- **Sem boleto.** As cobranças de evento e do CLAM são criadas sem o tipo de pagamento `ticket` (boleto e lotérica). A reserva dura 15 minutos e a conciliação cancela o que estiver pendente, então um boleto seria cancelado antes de compensar. Ficam PIX e cartão.

### Configuração adicional

- `ATTENDANCE_QR_SECRET`: obrigatório, aleatório, com pelo menos 32 caracteres. Sem ele o perfil não mostra o QR e a leitura responde 503. Trocar o valor invalida todos os QR emitidos.
- `DADG_OPERATOR_ROLE_NAME`: nome exato da role do operador. Ausente, ninguém é operador.
- Auth0: criar a role, atribuí-la e garantir que ela chegue na claim `https://dadg.com.br/roles` do ID token do painel. Se a Action filtra roles por nome, incluir a nova.
- Nenhum índice novo. `attendance`, `id` das etapas e `minAttendancePercent` passam a ser gravados conforme o uso; eventos antigos não são convertidos.

### Pendências

- Homologar com dois celulares: entrada e saída em duas etapas, aluno não inscrito, operador barrado nas telas de administrador, emissão com percentual abaixo de 100.
- Rodar de novo `qa-audit-integration.ts` e `qa-audit-lifecycle.ts`, com aprovação. Eles não cobrem a presença por etapa: as fixtures criam cronograma sem `id`.
- Resolvido em parte: na lista de presença o administrador cancela inscrição de evento gratuito, inclusive lançamento manual e inscrição com presença, com motivo obrigatório gravado em `events.audit` (`POST /api/v1/events/:id/registration/:participantId/cancel`). A vaga volta, a presença fica no histórico e não gera certificado; com certificado emitido o cancelamento é recusado. O operador não tem o botão nem a rota. Continuam sem tela: inscrição paga (segue pelo estorno no provedor e pela conciliação) e participante em revisão, cuja resolução depende de regra da organização.
- Resolvido: o leitor usa o jsQR 1.4.0 empacotado como dependência, sem script externo em tempo de execução.

# CLAM: inscrição, pagamento e operação

Esta implementação integra as PRs #35, #36 e #37 nessa ordem. O site do aluno deve usar a branch complementar baseada na PR #34. A quantidade é de 1 a 4 ligas, limitada também pelo processo e pelas ligas disponíveis. Após o primeiro pagamento confirmado, não há alteração de quantidade nem compra complementar, inclusive após estorno.

## Contrato HTTP

Todas as rotas do aluno usam a identidade do token validado no servidor. Campos de preço ou identidade enviados pelo navegador são rejeitados. O pagador é validado separadamente da identidade do candidato.

- `POST /api/v1/selective-processes/:id/checkout`: criação ou retomada da mesma contratação.
- `POST /api/v1/selective-processes/:id/checkout/replace`: substituição explícita de uma sessão pendente.
- Ambos exigem `Idempotency-Key` com 16–128 caracteres alfanuméricos, hífen ou sublinhado. O frontend encaminha esse header.
- Corpo: `{ examsCount, payer }`; substituição acrescenta `previousSessionId`. Pagador: nome, CPF, CEP, rua, número, bairro, complemento opcional, telefone e e-mail.
- Sucesso: `{ success: true, data: { sessionId, init_point, expiresAt, examsCount, totalAmount } }`. O valor e a quantidade vêm do contrato persistido.
- Quantidade diferente sem substituição explícita: 409 `PAYMENT_REPLACEMENT_REQUIRED`.
- Reutilização da chave com outro conteúdo: 409 `IDEMPOTENCY_CONFLICT`.
- Operação concorrente: 409 `PAYMENT_PROCESSING`. Falha transitória: 503, com identificador de diagnóstico.
- Pagamento anterior aprovado durante a troca: 409 `ALREADY_ENROLLED`, com a contratação original efetivada.
- Cancelamento inconclusivo: `PAYMENT_CANCELLATION_PENDING`; não gera outra preferência.
- Contrato divergente, criação ambígua, pagamento antigo inesperado ou disputa: revisão. O cliente não deve tratar uma falha HTTP como autorização para emitir outra cobrança.

`GET .../:id/me` inclui quantidade, valor, URL quando disponível, prazo, situação da sessão e permissão de substituição. Estados adicionais: `PAYMENT_PROCESSING`, `PAYMENT_REVIEW_REQUIRED` e `PAYMENT_REVERSED`. A expiração local apenas informa o prazo; não libera capacidade nem autoriza uma cobrança nova.

## Consistência

A sessão guarda o contrato imutável: candidato, processo, quantidade, valor em centavos, BRL e referência externa. Preferência, pagamentos, solicitações de substituição e marcos de aprovação/reversão ficam associados a ela.

Uma reserva com ID determinístico por candidato/processo serializa criação, cancelamento, confirmação e escolha de ligas. Transações escrevem a reserva com token de bloqueio e atualizam a revisão do processo. A criação reserva uma vaga atomicamente antes de chamar o provedor. A substituição preserva a vaga; pagamento consome a reserva sem contar uma segunda vaga.

A assinatura HMAC do Mercado Pago é obrigatória e tem janela de cinco minutos. Os dois webhooks usam o mesmo serviço. O estado é consultado novamente no provedor: referência, valor e moeda devem coincidir. Pagamentos listados são consultados individualmente por ID. Notificações repetidas não criam outra inscrição/ticket e tentativas rejeitadas não apagam uma aprovação.

Aprovação, inscrição, ticket e reserva são persistidos na mesma transação. Estorno integral/chargeback revoga o ticket e libera uma vaga uma única vez. Estorno parcial, mediação ou pagamentos múltiplos exigem revisão e conservam a ocupação. Uma aprovação inesperada de sessão substituída ou cuja reserva já foi liberada bloqueia a inscrição para análise, sem atribuir automaticamente direitos a outra contratação.

A escolha de ligas é transacional e idempotente; não excede o crédito pago. Excluir uma liga remove a escolha e a nota, conservando a quantidade contratada.

## Mercado Pago

Configurar no ambiente correspondente:

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_WEBHOOK_URL`, ou `APP_BASE_URL` HTTPS para formar a URL
- `MERCADOPAGO_BACK_URL_SUCCESS`, `MERCADOPAGO_BACK_URL_PENDING`, `MERCADOPAGO_BACK_URL_FAILURE`

A substituição confere a referência da preferência, atualiza sua expiração e verifica o resultado. Em seguida cancela os pagamentos canceláveis e consulta novamente seu estado. Se a aprovação vencer a corrida, efetiva a contratação original. Timeout ou resposta ambígua conserva a reserva e exige reconciliação. Uma criação com resposta perdida é procurada por referência; não se repete cegamente o POST de criação.

APIs oficiais utilizadas:

- [Atualizar preferência](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/update-preference/put)
- [Cancelar pagamento](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/create-cancellation/put)

A expiração da preferência não equivale ao cancelamento de um PIX/boleto já emitido. É necessária homologação na conta de testes do provedor para os meios de pagamento habilitados, inclusive latência das consultas, validade da preferência e cancelamento concorrente. Os testes locais usam um provedor simulado e não comprovam funcionamento da conta de produção.

## Administração

O painel ativo permanece em `dadg-certificates`. Os acessos administrativos aposentados do frontend permanecem bloqueados.

- Processo: GET/POST na coleção; GET/PUT/DELETE por ID.
- Ligas: GET/POST na coleção; PUT/DELETE por ID.
- Preços: GET/PUT, com substituição integral dentro de transação.
- Notas e resultado: PUT em `applications/:applicationId/scores` e `.../final-status`.
- Reconciliação: POST em `/api/admin/selective-processes/payments/:sessionId/reconcile`. Exige administrador, consulta o Mercado Pago e repete o mesmo serviço de confirmação. Sessão expirada só libera a reserva depois da confirmação de encerramento no provedor.
- Exclusão de processo com qualquer inscrição/sessão vinculada: 409 `PROCESS_HAS_ENROLLMENTS`.
- Endpoints antigos de checkout com preço/usuário livres, sessões financeiras de demonstração, criação manual de inscrição/ticket e mudança manual de status retornam 410.

O painel do blog pagina em lotes de 20 artigos; o editor consulta `GET /api/v1/blog/admin/posts/:id` diretamente. Horários de provas são convertidos para horário local ao preencher o editor.

## Preparação explícita do banco

**Não há migração automática. Antes de qualquer consulta ou escrita, apresentar ambiente, banco, coleções, comando e efeitos e obter aprovação. Escritas também exigem backup recuperável confirmado.**

Usar replica set/cluster com suporte a transações. Executar manutenção com o tráfego CLAM suspenso. O script não carrega `.env` e não usa `MONGODB_URI`; exige `CLAM_MAINTENANCE_URI` e `CLAM_MAINTENANCE_DB` explícitos.

Coleções: `selectionprocesses`, `exams`, `pricingtiers`, `paymentsessions`, `paymentattributions`, `applications`, `tickets`, `applicationleagueselections`, `clam_reservations`.

Somente após aprovação de leitura:

```powershell
npx tsx scripts/clam-storage.ts --approved
```

Somente após aprovação de escrita e identificação do backup em `CLAM_RECOVERABLE_BACKUP`:

```powershell
npx tsx scripts/clam-storage.ts --approved --apply
```

O audit identifica duplicidades antes de criar índices. O apply cria as coleções ausentes e os índices declarados, convertendo índices não únicos conflitantes em únicos somente após a verificação. Não exclui documentos. Garante unicidade de inscrição por candidato/processo, ticket por inscrição, referência externa, preferência, pagamentos, chave de operação e escolha de liga.

Apenas processos antigos sem qualquer vínculo financeiro/inscrição/reserva recebem contadores iniciais zerados. Processos com dados legados são relatados para análise e permanecem bloqueados; o script não deduz direitos a partir de registros de demonstração. Também não é possível inicializá-los implicitamente pela edição administrativa. Reconstrução desses registros exige um procedimento específico, com backup e aprovação separados.

Sessões sem contrato verificável, preferência que não pode ser localizada ou aprovação inesperada após substituição/liberação exigem análise dos registros e do provedor. A reconciliação não inventa valores nem libera automaticamente bloqueios que envolvam contratações diferentes.

## Verificação local

Sem banco:

```powershell
$env:NODE_OPTIONS='--require="./scripts/no-database.cjs"'
npm test
npm run typecheck
```

Integração (somente após aprovação do banco descartável e confirmação da base vazia recuperável):

```powershell
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
$env:CLAM_RECOVERABLE_BACKUP='empty-baseline'
npx tsx scripts/qa-clam-integration.ts --approved
```

O teste inicia Mongo em 127.0.0.1, banco `clam_integration_test`, com diretório novo por execução. Não carrega `.env`; substitui a URI dentro do processo. Salva manifesto da base vazia antes de iniciar. Cria índices e fixtures, simula o Mercado Pago, testa transações e preserva o diretório após encerrar a instância.

Resultados desta entrega: 26 testes sem banco e 19 cenários de integração aprovados, usando MongoDB 8.2.6 local. Cobertura inclui quantidades 1–4, adulteração de entrada, idempotência, troca 1→4, cancelamento recusado/timeout, aprovação durante troca, resposta perdida, última vaga, webhook repetido/fora de ordem, estorno, seleção concorrente, devolução de crédito, exclusão com vínculos e rollback financeiro/de preços. TypeScript e lint pertinente foram executados nos dois repositórios; builds usam configuração fictícia. A inspeção de interface usa APIs interceptadas, em 1440×1000 e 390×844, e verificou acesso ao artigo 65.

A preparação foi aplicada apenas nas instâncias descartáveis autorizadas. Nenhum banco configurado nos arquivos de ambiente do projeto foi acessado. Permanecem externas a esta validação a configuração real de Auth0/Mercado Pago, a instalação aprovada de índices no ambiente de destino e a homologação de cobranças nesse ambiente.

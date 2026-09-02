# Inscrição em processos seletivos — API do candidato

Rotas consumidas pelo site do aluno (`dadg.com.br`) para listar processos
seletivos da CLAM, pagar a inscrição e escolher as ligas acadêmicas.

As rotas administrativas (`/api/admin/selective-processes/...`) continuam como
estavam e não são usadas pelo site do aluno.

## Fluxo

1. O candidato abre a listagem e escolhe um processo seletivo.
2. O site consulta a situação dele (`/me`) e decide o destino:
   - sem inscrição e período aberto → tela de pagamento;
   - pagamento pendente → volta para o link do Mercado Pago já gerado;
   - pagamento confirmado → painel de escolha das ligas.
3. O webhook do Mercado Pago confirma o pagamento, cria a `Application` e o
   `Ticket` com status `PAID`.
4. O candidato escolhe as ligas até o limite pago (`leagueAllowanceCount`).

## Rotas

### `GET /api/v1/selective-processes` — pública

```json
{
  "success": true,
  "data": [
    {
      "id": "65f21a9b3c4d5e0012345678",
      "registrationStartDate": "2026-09-01T00:00:00.000Z",
      "registrationEndDate": "2026-09-30T23:59:59.000Z",
      "maxExamsPerApplication": 3,
      "maxCapacity": 500,
      "paidCount": 120,
      "remainingCapacity": 380,
      "examsCount": 14,
      "hasStarted": true,
      "hasEnded": false,
      "isRegistrationOpen": true
    }
  ]
}
```

### `GET /api/v1/selective-processes/:id` — pública

Mesmos campos acima, mais `exams` (ligas com nome e datas da prova) e
`pricingTiers` (faixas de preço por quantidade de ligas).

### `GET /api/v1/selective-processes/:id/me` — candidato autenticado

```json
{
  "success": true,
  "data": {
    "status": "PAID_PENDING_LEAGUES",
    "canCheckout": false,
    "canSelectLeagues": true,
    "application": { "id": "...", "finalStatus": "PENDING_RESULTS" },
    "ticket": { "id": "...", "paymentStatus": "PAID", "totalAmount": 100, "leagueAllowanceCount": 2 },
    "payment": null,
    "selectedExamIds": ["..."],
    "remainingSelections": 2
  }
}
```

`status` assume um de: `REGISTRATION_NOT_OPEN`, `REGISTRATION_CLOSED`,
`SOLD_OUT`, `NOT_REGISTERED`, `PAYMENT_PENDING`, `PAID_PENDING_LEAGUES`,
`ENROLLED`.

### `POST /api/v1/selective-processes/:id/checkout` — candidato autenticado

```json
{
  "examsCount": 2,
  "payer": {
    "name": "João Silva",
    "cpf": "12345678900",
    "zipCode": "01001000",
    "street": "Rua Exemplo",
    "number": "123",
    "neighborhood": "Centro",
    "complement": "Apto 45",
    "phone": "34999999999",
    "email": "joao@email.com"
  }
}
```

O valor **não** é aceito do cliente: o total sai das faixas de preço
(`PricingTier`) do processo seletivo. Sem faixa cadastrada a rota devolve
`PRICING_NOT_CONFIGURED` (409).

Resposta: `init_point` (URL do Checkout Pro), `sessionId`, `expiresAt`,
`examsCount` e `totalAmount`.

Erros: `REGISTRATION_CLOSED`, `SOLD_OUT`, `ALREADY_ENROLLED`,
`EXAMS_EXCEED_MAX_PER_APPLICATION`, `PRICING_NOT_CONFIGURED`.

### `POST /api/v1/selective-processes/:id/leagues` — candidato autenticado

```json
{ "examIds": ["65f2...", "65f3..."] }
```

Só funciona com o pagamento confirmado. As escolhas são definitivas: cada liga
vira um registro em `ApplicationLeagueSelection` e não pode ser trocada.

Erros: `PAYMENT_NOT_CONFIRMED` (409), `LEAGUE_ALLOWANCE_EXCEEDED` (409),
`LEAGUES_ALREADY_SELECTED` (409), `EXAMS_INVALID_FOR_PROCESS` (400).

### `GET|PUT /api/admin/selective-processes/selection-processes/:id/pricing-tiers` — admin

Tabela de preços por quantidade de ligas. O `PUT` substitui a tabela inteira:

```json
{
  "pricingTiers": [
    { "examsCount": 1, "unitTotalPrice": 60 },
    { "examsCount": 2, "unitTotalPrice": 100 },
    { "examsCount": 3, "unitTotalPrice": 130 }
  ]
}
```

Quando não existe faixa exata para a quantidade escolhida, o preço é o da faixa
de 1 liga multiplicado pela quantidade.

## Confirmação de pagamento

O webhook do Mercado Pago recebe o `external_reference` gerado no checkout.
Esse valor passou a ser gravado em `PaymentSession.orderId`, e é por ele que a
sessão é reencontrada (com fallback por `_id` para sessões antigas) — antes a
busca era feita por `_id` usando um ObjectId que nunca era o da sessão, então o
pagamento nunca chegava a ser efetivado.

Com o pagamento aprovado, `confirmEnrollmentForPaymentSession` cria a
`Application` e o `Ticket` pago com `leagueAllowanceCount` igual à quantidade de
ligas contratadas (`paymentConfig.examsCount`). A função é idempotente, porque o
Mercado Pago pode reenviar a mesma notificação.

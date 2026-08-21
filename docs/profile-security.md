# Perfis DADG: configuração e manutenção segura

O backend é o único projeto que recebe as chaves do CPF. O site principal nunca deve receber essas variáveis. A autenticação dos alunos reutiliza `AUTH0_DOMAIN` e `AUTH0_AUDIENCE`; configure também a claim autenticada de e-mail em `STUDENT_AUTH0_EMAIL_CLAIM` (o padrão é `email`). O administrativo exige `DADG_ADMIN_ROLE_NAME` com o nome exato da role criada no Auth0. O ID interno da role não é usado na autorização: a Post-Login Action publica os nomes das roles na claim assinada `https://dadg.com.br/roles` do ID token.

No tenant Auth0, selecione a API JWT própria e use o mesmo Identifier em `AUTH0_AUDIENCE` no site e no backend. `AUTH0_DOMAIN` identifica o issuer do tenant e pode ser informado como domínio ou URL HTTPS; o backend o normaliza com a barra final. Garanta por Action/claim que o access token contenha o e-mail autenticado no nome configurado por `STUDENT_AUTH0_EMAIL_CLAIM`. Sem domínio, audience, nome da role administrativa ou claim válida, o sistema falha fechado.

## Autorização administrativa por role

Crie a role administrativa no Auth0 e grave o nome exato somente na configuração do backend:

```dotenv
DADG_ADMIN_ROLE_NAME=Administrador
```

O valor diferencia maiúsculas e minúsculas e deve corresponder exatamente ao nome cadastrado no Auth0. Em **Actions > Flows > Login**, crie uma Post-Login Action com o código abaixo e adicione-a ao fluxo. A role e o Client ID não são segredos; a claim é confiável porque integra o ID token assinado pelo Auth0.

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const roles = Array.isArray(event.authorization?.roles)
    ? event.authorization.roles
    : [];

  api.idToken.setCustomClaim("https://dadg.com.br/roles", roles);
};
```

Não publique a role no access token do aluno: as rotas administrativas aceitam apenas a sessão por cookie do aplicativo administrativo e verificam a claim do ID token. Depois de atribuir ou remover uma role, encerre a sessão e entre novamente para obter um token atualizado.

Como o site e o administrativo compartilham o mesmo cliente Auth0, mantenha um `AUTH0_SECRET` independente em cada deploy. Os projetos também usam nomes de cookie distintos (`dadg_site_session` e `dadg_admin_session`), evitando colisão entre `localhost:3001` e `localhost:3000`. Alterar o nome do cookie encerra somente as sessões antigas; não remove usuários nem roles do Auth0.

## Chaves locais

Gere cada chave de 32 bytes de forma independente, executando este bloco duas vezes no PowerShell. Não salve a saída em logs, tickets ou chats.

```powershell
$profileSecretBytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($profileSecretBytes)
[Convert]::ToBase64String($profileSecretBytes)
```

Em versões antigas do PowerShell/.NET sem o método estático `Fill`, use o equivalente compatível abaixo:

```powershell
$profileSecretBytes = [byte[]]::new(32)
$profileRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $profileRng.GetBytes($profileSecretBytes) } finally { $profileRng.Dispose() }
[Convert]::ToBase64String($profileSecretBytes)
```

Grave somente no `.env.local` do backend e no cofre do deploy:

```dotenv
PROFILE_CPF_ACTIVE_KEY_VERSION=v1
PROFILE_CPF_ENCRYPTION_KEY_V1=<primeiro valor>
PROFILE_CPF_LOOKUP_KEY=<segundo valor>
```

Mantenha a chave de criptografia em um gerenciador de senhas: sem ela os CPFs são irrecuperáveis. A chave de lookup é estável; trocá-la exige uma operação exclusiva para recalcular todos os HMACs.

## Verificação e índices

O comando padrão é somente leitura: valida o tamanho das chaves, conta duplicidades, informa que não aplicou índices e audita as versões sem exibir CPF ou segredo.

```powershell
npm run profile:maintenance
```

Somente após revisar duplicidades e autorizar explicitamente o banco-alvo:

```powershell
npm run profile:maintenance -- --apply
```

Os schemas usam `autoIndex: false`; iniciar a aplicação ou fazer deploy não cria índices automaticamente. Nunca execute `--apply` contra produção sem confirmação específica.

## Rotação

1. Gere `PROFILE_CPF_ENCRYPTION_KEY_V2` e mantenha V1 e V2 no cofre.
2. Defina `PROFILE_CPF_ACTIVE_KEY_VERSION=v2` para novas gravações.
3. Audite sem escrita: `npm run profile:maintenance -- --rotate-to=v2`.
4. Após autorização e backup verificado: `npm run profile:maintenance -- --rotate-to=v2 --apply`.
5. Execute novamente em modo leitura e remova V1 somente quando a contagem dessa versão for zero.

A rotação altera apenas o envelope AES-GCM; não imprime CPF, não muda o HMAC de busca e não reescreve inscrições ou certificados históricos.

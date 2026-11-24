# Perfis DADG: configuração e manutenção segura

O backend é o único projeto que recebe as chaves do CPF. O site principal nunca deve receber essas variáveis. O login usa o servidor próprio (Zitadel, OIDC padrão) com `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUDIENCE` (ID do projeto no Zitadel), `SESSION_SECRET` (64 caracteres hexadecimais) e `APP_BASE_URL`. A autenticação dos alunos (Bearer enviado pelo site) usa `OIDC_ISSUER` e `OIDC_AUDIENCE`; configure também a claim autenticada de e-mail em `STUDENT_AUTH0_EMAIL_CLAIM` (o padrão é `email`). O administrativo exige `DADG_ADMIN_ROLE_NAME` com o nome exato do papel criado no projeto do Zitadel.

`OIDC_ISSUER` é comparado EXATAMENTE com o `iss` dos tokens (sem barra no fim). As chaves públicas vêm do `jwks_uri` da descoberta (`/.well-known/openid-configuration`). Garanta que o access token contenha o e-mail autenticado no nome configurado por `STUDENT_AUTH0_EMAIL_CLAIM`. Sem issuer, audience, nome do papel administrativo ou claim válida, o sistema falha fechado.

## Autorização administrativa por papel

Crie o papel administrativo no projeto do Zitadel e grave o nome exato somente na configuração do backend:

```dotenv
DADG_ADMIN_ROLE_NAME=Administrador
```

O valor diferencia maiúsculas e minúsculas e deve corresponder exatamente à chave do papel no Zitadel. O login pede o escopo `urn:zitadel:iam:org:projects:roles`; os papéis chegam na claim `urn:zitadel:iam:org:project:roles` (objeto cujas chaves são os nomes) do ID token, do userinfo ou do access token JWT, e a sessão guarda só a lista de nomes.

Depois de atribuir ou remover um papel, encerre a sessão e entre novamente para obter um token atualizado.

A sessão do painel fica no cookie cifrado `dadg_admin_session` (dividido em `dadg_admin_session.0`, `.1`, ...), cifrado com `SESSION_SECRET`. Mantenha um `SESSION_SECRET` independente em cada deploy. Trocar o segredo encerra as sessões abertas; não remove usuários nem papéis do Zitadel.

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

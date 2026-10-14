# Organizador pessoal de horas

Área do aluno para reunir certificados e somar horas. Tudo é declarado pelo aluno: o DADG não verifica nem se responsabiliza por esses dados. Para fins oficiais valem os certificados emitidos e a carga horária registrada pelo DADG.

## O que faz

- Lista os certificados do DADG vinculados ao perfil com a carga horária oficial (`certificateHours`, texto livre; o número é lido de "4h", "8 horas", "4,5 h"; sem número legível, aparece sem horas e não entra na soma).
- Permite uma anotação pessoal por certificado do DADG (tipo e horas) que vale só para a soma do organizador. O certificado oficial, a consulta pública e o QR não mudam.
- Recebe certificados de fora do DADG em PDF, com título, tipo, instituição, data e horas, e permite editar, abrir (link de 60 s) e excluir.
- Soma as horas por tipo. Os tipos têm código estável para um mapeamento futuro às categorias oficiais de horas complementares.

## Limites

- Só PDF, até 4 MB por arquivo e 20 páginas. O limite vem do corpo de requisição da Vercel (cerca de 4,5 MB), porque o arquivo passa pelo site e pelo backend.
- Cota por aluno: 100 MB e 60 arquivos. Dois envios simultâneos podem passar um pouco da cota.
- O conteúdo é conferido (assinatura `%PDF-` e leitura com `pdf-lib`); PDF protegido por senha é recusado.
- Arquivos no R2 em `R2_SUBFOLDER/organizer/<perfil>/<id>.pdf`. Ao excluir, o registro sai primeiro; se o arquivo não for apagado, fica um objeto órfão.

## Rotas (aluno)

| Método | Rota |
|---|---|
| GET | `/api/v1/user/organizer` |
| POST | `/api/v1/user/organizer/uploads` (multipart: `file`, `title`, `type`, `institution`, `date`, `hours`) |
| PATCH, DELETE | `/api/v1/user/organizer/uploads/:id` |
| GET | `/api/v1/user/organizer/uploads/:id/file` |
| PUT, DELETE | `/api/v1/user/organizer/notes/:certificateId` |

## Antes de publicar

1. Coleções `users.externalCertificates` e `users.certificateNotes` com índices por perfil. A criação automática está desligada, como no restante do projeto. Com aprovação explícita e backup confirmado:

```powershell
npx tsx scripts/organizer-setup.ts --db=NOME_EXATO --mode=inspect
npx tsx scripts/organizer-setup.ts --db=NOME_EXATO --mode=apply --backup-id=IDENTIFICADOR_RECUPERAVEL
```

2. Aviso de privacidade: incluir o tratamento dos PDFs enviados (finalidade, quem acessa, por quanto tempo ficam e o que acontece ao excluir a conta). O texto é decisão da organização; a mudança gera nova versão e novo aceite.
3. Conferir o espaço já usado no R2 (os 10 GB gratuitos são da conta inteira).

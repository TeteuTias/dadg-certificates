# Relatórios e correção da CLAM

A página `/selective-processes/:id/reports` reúne conferência cadastral, dias de prova, vagas por liga, quantidade de questões, exportações e importação de acertos. Somente administradores acessam os endpoints. Respostas e downloads usam `Cache-Control: private, no-store`.

## Cadastro e identidade

O perfil geral acrescenta `registrationNumber` (matrícula/RA), `birthDate` (data civil `YYYY-MM-DD`), `phone` e `contactEmail`. Os campos continuam opcionais nos demais módulos. Checkout e escolha de ligas da CLAM exigem perfil completo e aceite do aviso vigente; a resposta é `428 PROFILE_INCOMPLETE` com `missingFields` quando houver pendências.

`candidateProfileId` é obtido no servidor pela identidade autenticada (issuer + subject), armazenado na sessão e transferido à inscrição na confirmação do pagamento. Relatórios consultam o perfil atual. Nome, CPF e contato do pagador nunca completam lacunas do participante. Sessões antigas sem vínculo continuam reconciliáveis; dados antigos não são migrados automaticamente. Uma escolha autenticada pode vincular o perfil à inscrição antiga. Inscrições pagas sem perfil vinculado aparecem como cadastro pendente.

O aviso de privacidade passa a `dadg-profile-privacy-v2`, incluindo dados acadêmicos e compartilhamento operacional. As chaves de criptografia de CPF já existentes são reutilizadas. **Não há variável nova obrigatória na Vercel para o recurso.** As variáveis `CLAM_MAINTENANCE_*` abaixo pertencem somente à execução manual de manutenção.

## Contratos dos relatórios

As listas usam uma transação com leitura `snapshot`. Entram inscrições cujo ticket e sessão estejam pagos, com reserva ativa paga, sem reversão e sem revisão. A relação geral inclui quem ainda não escolheu provas; relatórios por dia e por liga contam somente escolhas registradas.

ExcelJS 4.4.0 gera e lê `.xlsx`. Cabeçalhos azuis, filtros, primeira linha congelada, linhas alternadas e formato de data `dd/mm/yyyy`. Matrícula, CPF, telefone e identificadores técnicos são texto, preservando zeros iniciais. Correção: nome, período, matrícula, nascimento, nota e três colunas ocultas (`_Inscricao`, `_Prova`, `_Processo`). Preservar essas colunas ao reordenar linhas.

Os dias podem seguir datas civis em `America/Sao_Paulo` ou o arquivo importado com `Liga` e `Dia`. O modo por arquivo não modifica o calendário. Liga pode ser ID, sigla ou nome exato; falta/ambiguidade aparece na prévia para correção do arquivo. Vagas por liga são independentes da capacidade financeira; ausente e zero não produzem divisão.

Nota é quantidade inteira de acertos entre zero e `questionCount` (padrão 15). Célula vazia não altera; zero é válido. Escolhas novas têm nota nula. Zeros antigos sem horário de correção aparecem em branco. Não há classificação, desempate ou aprovação automática nesta entrega.

Prévia não grava. Confirmação revalida direitos, perfil, matrícula, escolhas, notas e revisão do processo, grava tudo atomicamente e registra administrador/horário/alterações em `clam_report_audit`. Alterações concorrentes exigem nova prévia. A chave `Idempotency-Key` identifica a confirmação; repetições com o mesmo conteúdo retornam o resultado já salvo. O lançamento manual existente usa o mesmo serviço.

Limites: `.xlsx`, 10 MiB por arquivo, 50 mil linhas de dados, 30 colunas, 1.000 entradas ZIP e 100 MiB descompactados. Fórmulas em campos de entrada, cabeçalhos duplicados, identificadores numéricos, arquivo de outro processo e matrículas divergentes/duplicadas são rejeitados. Prévia e confirmação são separadas; nenhuma importação parcialmente inválida é gravada.

## API administrativa

Base: `/api/admin/selective-processes/selection-processes/:id/reports/`.

| Método e ação | Entrada / saída |
| --- | --- |
| GET `summary` | Totais, pendências cadastrais, matrículas duplicadas e configuração |
| GET `export?kind=all\|day1\|day2\|counts\|registrations\|scores` | Arquivo XLSX; `examId` seleciona uma liga no arquivo de correção |
| GET `template?kind=days\|seats` | Modelo para preenchimento |
| POST `settings` | JSON: `revision`, `config`, `exams` com ID, sigla, vagas e questões |
| POST `preview` | FormData: `file`, `kind` (`scores`, `days`, `seats`) |
| POST `confirm` | Mesmo arquivo e tipo, `previewHash`, cabeçalho `Idempotency-Key` |

## Preparação explícita do armazenamento

**Não foi aplicada automaticamente ao banco do projeto.** Antes da primeira gravação administrativa, preparar a coleção `clam_report_audit` (índice `_id` padrão) e o índice único parcial `clam_exam_acronym_unique` em `exams`, com `{ selectionProcessId: 1, acronym: 1 }`, somente quando `acronym` for string.

O `AGENTS.md` exige autorização específica antes de qualquer acesso, incluindo dry-run; escrita exige backup recuperável confirmado. Informar ambiente, banco, coleções, comando e efeitos antes de executar. O script não lê `.env` e exige destino explícito. Não executar estes exemplos sem essa autorização.

```powershell
# Definir CLAM_MAINTENANCE_URI e CLAM_MAINTENANCE_DB para o destino autorizado.
npx tsx scripts/clam-reports-storage.ts --approved
# Somente após autorização de escrita e confirmação do backup:
npx tsx scripts/clam-reports-storage.ts --approved --apply
```

O modo somente leitura verifica conflitos de siglas e existência da coleção. `--apply` exige `CLAM_RECOVERABLE_BACKUP`, cria coleção/índice sem corrigir ou apagar registros. Havendo conflitos, interrompe sem aplicação. Não modifica processos antigos, perfis, pagamentos ou outros databases. Deve ser executado com tráfego de configuração CLAM suspenso durante a preparação.

## Validação reproduzível

Sem banco:

```powershell
$env:NODE_OPTIONS='--require=./scripts/no-database.cjs'
npm test
npm run typecheck
# Testes do frontend no worktree irmão, usando o runner instalado no backend:
npx tsx --test ../clam-reports-frontend/tests/profile-client.test.ts
```

O preloader impede tentativas de conexão Mongo. Builds usam configuração fictícia de Auth0, backend e Mercado Pago. Downloads de fontes públicas precisam de rede. Serviços externos não são comprovados por esse build.

Integração real de Mongo, somente após autorização específica:

```powershell
$env:NODE_OPTIONS=$null
$env:CLAM_RECOVERABLE_BACKUP='empty-baseline'
npx tsx scripts/qa-clam-reports.ts --approved
```

Esse script força `127.0.0.1:27020`, banco `clam_reports_integration_test`, diretório vazio novo por execução; nunca carrega `.env` nem reutiliza a URI do projeto. Registra manifesto da base vazia antes de iniciar. Mercado Pago é simulado. Cria somente as 13 coleções listadas na autorização, testa alterações em dados fictícios e preserva o diretório ao terminar. Exemplos XLSX saem em `.cache/clam-report-samples`.

Resultado em 07/09/2026: 13 cenários transacionais aprovados, incluindo concorrência, idempotência, rollback após falha na auditoria, cadastro incompleto, perfil atualizado, pagador diferente, direitos revertidos/em revisão, calendário, vagas, notas manuais e exclusão de liga. Os arquivos foram reabertos para conferir valores, zeros iniciais, estilos e colunas ocultas. O renderizador de prévia pode exibir strings numéricas sem zeros; os valores do XLSX e o formato Texto foram conferidos diretamente com ExcelJS.

Validação visual usa aplicações locais com cookies fictícios e respostas de API interceptadas. Ela cobre a interface desktop/mobile e o retorno do perfil à CLAM, sem representar validação de Auth0/Mercado Pago em produção. PRs e merges permanecem manuais.

Conferência final em 08/09/2026: 39 testes do backend e 4 do frontend aprovados; TypeScript, lint dos arquivos alterados e builds dos dois worktrees concluídos. Prévia e confirmação de importação também conferidas na interface com respostas fictícias. O build do frontend utiliza o fallback das estatísticas da home, pois não recebe configuração de banco real. Permanecem os avisos existentes de múltiplos lockfiles, fontes pré-carregadas e AWS SDK v2.

As 11 planilhas de demonstração e um arquivo de orientação estão em `output/clam-relatorios-exemplos/planilhas-clam-exemplos.zip` no worktree backend. Esse pacote local usa somente os dados fictícios do teste Mongo e não é versionado.

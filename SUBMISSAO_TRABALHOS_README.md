# Sistema de Submissão de Trabalhos - Documentação

## Visão Geral

Este documento descreve a implementação do sistema de submissão de trabalhos científicos para o projeto **dadg-certificates**. O sistema permite que usuários autenticados submetam trabalhos em diferentes modalidades para eventos específicos, com suporte para múltiplos autores, participantes e orientadores.

## Estrutura de Dados

### Coleção: `certificates.events`

A coleção de eventos foi estendida para incluir as modalidades de submissão e prazo de submissão:

```typescript
{
  _id: ObjectId;
  eventName: string;
  eventDescription: string;
  modalities: Array<{
    name: string;        // Ex: "Artigo Científico"
    code: string;        // Ex: "ART"
    description: string; // Descrição da modalidade
  }>;
  submission_deadline: Date;
  // ... outros campos existentes
}
```

### Coleção: `article.projects`

Nova coleção para armazenar os trabalhos submetidos:

```typescript
{
  _id: ObjectId;
  Modalidade: string;           // Código da modalidade (ART, POST, ORAL, etc)
  Nome_do_projeto: string;      // Nome do trabalho
  project_config: {
    max_authors: number;        // Máximo de autores
    max_participants: number;   // Máximo de participantes
    max_advisors: number;       // Máximo de orientadores
  };
  authors: Array<{
    name: string;
    email: string;
    institution: string;
    is_advisor: boolean;
  }>;
  participants: Array<{
    name: string;
    email: string;
    role: string;
    is_advisor: boolean;
  }>;
  event_id: ObjectId;           // Referência ao evento
  file_url: string;             // URL do arquivo no R2
  created_at: Date;
}
```

## Modalidades Disponíveis

| Código | Nome | Descrição |
|--------|------|-----------|
| ART | Artigo Científico | Submissão de artigo científico completo |
| POST | Pôster Científico | Apresentação em formato pôster científico |
| ORAL | Apresentação Oral | Apresentação oral com slides |
| RES | Resumo Simples | Submissão apenas de resumo |
| REXP | Resumo Expandido | Submissão de resumo com conteúdo detalhado |
| CASO | Relato de Caso | Apresentação de relato clínico ou estudo de caso |
| REV | Revisão Sistemática | Submissão de revisão sistemática da literatura |
| PROJ | Projeto de Pesquisa | Submissão de proposta ou projeto científico |

## APIs Implementadas

### 1. GET `/api/v1/events/modalities`

**Descrição:** Lista todos os eventos abertos com suas modalidades de submissão.

**Autenticação:** Requerida (Bearer Token)

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "eventName": "Conferência Científica 2026",
      "eventDescription": "Conferência anual de pesquisa",
      "submission_deadline": "2026-06-30T23:59:59Z",
      "modalities": [
        {
          "name": "Artigo Científico",
          "code": "ART",
          "description": "Submissão de artigo científico completo"
        }
      ]
    }
  ]
}
```

### 2. POST `/api/v1/articles/submit`

**Descrição:** Submete um novo trabalho com arquivo.

**Autenticação:** Requerida (Bearer Token)

**Content-Type:** multipart/form-data

**Parâmetros:**
- `event_id` (string, obrigatório): ID do evento
- `modality` (string, obrigatório): Código da modalidade
- `project_name` (string, obrigatório): Nome do projeto
- `file` (file, obrigatório): Arquivo do trabalho (PDF, DOC, DOCX, TXT)
- `authors` (JSON, obrigatório): Array de autores
- `participants` (JSON, obrigatório): Array de participantes
- `project_config` (JSON, obrigatório): Configuração do projeto

**Exemplo de Request:**
```javascript
const formData = new FormData();
formData.append('event_id', '507f1f77bcf86cd799439011');
formData.append('modality', 'ART');
formData.append('project_name', 'Estudo sobre IA');
formData.append('file', fileInput.files[0]);
formData.append('authors', JSON.stringify([
  {
    name: 'João Silva',
    email: 'joao@email.com',
    institution: 'Universidade Federal',
    is_advisor: true
  }
]));
formData.append('participants', JSON.stringify([
  {
    name: 'Maria Santos',
    email: 'maria@email.com',
    role: 'Pesquisadora',
    is_advisor: false
  }
]));
formData.append('project_config', JSON.stringify({
  max_authors: 1,
  max_participants: 4,
  max_advisors: 1
}));

const response = await fetch('/api/v1/articles/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Resposta (200):**
```json
{
  "success": true,
  "message": "Trabalho submetido com sucesso",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "file_url": "https://r2.example.com/trabalhos-dadg/507f1f77bcf86cd799439011/abc123.pdf"
  }
}
```

### 3. GET `/api/v1/articles/list`

**Descrição:** Lista todos os trabalhos submetidos (opcionalmente filtrados por evento).

**Autenticação:** Requerida (Bearer Token)

**Query Parameters:**
- `event_id` (string, opcional): Filtrar por ID do evento

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "Modalidade": "ART",
      "Nome_do_projeto": "Estudo sobre IA",
      "authors": [...],
      "participants": [...],
      "event_id": {
        "eventName": "Conferência Científica 2026"
      },
      "file_url": "https://r2.example.com/trabalhos-dadg/...",
      "created_at": "2026-04-13T10:30:00Z"
    }
  ]
}
```

## Componentes Frontend

### 1. Página de Submissão (`/submeterTrabalho`)

**Localização:** `/app/submeterTrabalho/page.tsx`

**Funcionalidades:**
- Seleção de evento com informações e prazo de submissão
- Seleção de modalidade com descrição
- Preenchimento de dados do projeto
- Upload de arquivo
- Gerenciamento dinâmico de autores (adicionar/remover)
- Gerenciamento dinâmico de participantes (adicionar/remover)
- Validação de campos obrigatórios
- Feedback de sucesso/erro

**Recursos:**
- Formulário responsivo
- Validação em tempo real
- Limite de autores/participantes conforme configuração
- Suporte a múltiplos formatos de arquivo

### 2. Página de Visualização (`/visualizarTrabalhos`)

**Localização:** `/app/visualizarTrabalhos/page.tsx`

**Funcionalidades:**
- Listagem de todos os trabalhos submetidos
- Grid responsivo com cards dos trabalhos
- Modal com detalhes completos
- Download de arquivo
- Informações de autores e participantes
- Indicação de orientadores

**Recursos:**
- Busca e filtro por evento
- Ordenação por data de submissão
- Interface intuitiva e responsiva
- Acesso direto ao arquivo

## Modelos Mongoose

### ArticleProjectModel

**Localização:** `/lib/models/ArticleProjectModel.ts`

```typescript
export interface IArticleProject extends Document {
  _id: ObjectId;
  Modalidade: string;
  Nome_do_projeto: string;
  project_config: IProjectConfig;
  authors: IAuthor[];
  participants: IParticipant[];
  created_at: Date;
  event_id: ObjectId;
  file_url: string;
}
```

## Integração com R2 (Cloudflare)

O sistema utiliza o R2 (S3-compatível) da Cloudflare para armazenar os arquivos submetidos.

**Configuração (`.env`):**
```
R2_ACCESS_KEY=seu_access_key
R2_SECRET_KEY=seu_secret_key
R2_ENDPOINT_URL=https://seu_endpoint.r2.cloudflarestorage.com
R2_BUCKET_NAME=dadgcertificados
```

**Estrutura de Pastas no R2:**
```
trabalhos-dadg/
├── {event_id}/
│   ├── {uuid}.pdf
│   ├── {uuid}.docx
│   └── ...
```

## Fluxo de Submissão

```
1. Usuário acessa /submeterTrabalho
   ↓
2. Sistema carrega eventos disponíveis via GET /api/v1/events/modalities
   ↓
3. Usuário seleciona evento e modalidade
   ↓
4. Usuário preenche dados do projeto, autores e participantes
   ↓
5. Usuário faz upload do arquivo
   ↓
6. Sistema valida todos os campos
   ↓
7. Sistema envia POST /api/v1/articles/submit com FormData
   ↓
8. API valida evento e modalidade
   ↓
9. API faz upload do arquivo para R2
   ↓
10. API salva documento em article.projects
    ↓
11. Sistema exibe mensagem de sucesso
    ↓
12. Usuário pode visualizar em /visualizarTrabalhos
```

## Validações

### Frontend
- Todos os campos obrigatórios devem ser preenchidos
- Email deve ter formato válido
- Arquivo deve ter extensão permitida (.pdf, .doc, .docx, .txt)
- Número de autores não pode exceder max_authors
- Número de participantes não pode exceder max_participants

### Backend
- Token de autenticação deve ser válido
- Evento deve existir e estar aberto
- Modalidade deve ser válida para o evento selecionado
- Arquivo deve ser enviado
- Todos os campos obrigatórios devem estar presentes

## Tratamento de Erros

| Código | Mensagem | Causa |
|--------|----------|-------|
| 400 | Campos obrigatórios não fornecidos | Faltam campos no formulário |
| 400 | Modalidade inválida para este evento | Modalidade não existe no evento |
| 401 | Token não fornecido | Usuário não autenticado |
| 401 | Token inválido | Token expirado ou inválido |
| 404 | Evento não encontrado | Event_id não existe |
| 500 | Erro ao submeter trabalho | Erro interno do servidor |

## Segurança

- **Autenticação:** Todas as rotas requerem token JWT válido
- **Autorização:** Usuários só podem acessar seus próprios trabalhos (implementar conforme necessário)
- **Validação:** Todos os inputs são validados no backend
- **Upload:** Arquivos são renomeados com UUID para evitar conflitos
- **CORS:** Configurar conforme necessário para produção

## Próximos Passos

1. **Implementar paginação** na listagem de trabalhos
2. **Adicionar filtros avançados** (por modalidade, data, evento)
3. **Implementar notificações por email** ao submeter trabalho
4. **Adicionar edição** de trabalhos submetidos
5. **Implementar revisão** de trabalhos por comissão
6. **Adicionar relatórios** de submissões
7. **Implementar sistema de certificados** para trabalhos aceitos

## Troubleshooting

### Erro ao fazer upload
- Verificar se as credenciais do R2 estão corretas
- Verificar se o bucket existe
- Verificar permissões de acesso

### Trabalho não aparece na listagem
- Verificar se o documento foi salvo no MongoDB
- Verificar conexão com banco de dados
- Verificar se o usuário tem permissão de acesso

### Evento não aparece na seleção
- Verificar se o evento tem `isOpen: true`
- Verificar se as modalidades estão configuradas
- Verificar se o prazo de submissão é futuro

## Suporte

Para questões ou problemas, consulte a documentação do projeto ou abra uma issue no repositório.

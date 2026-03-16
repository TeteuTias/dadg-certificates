/**
 * Temos aqui a política de acesso para TODAS as rotas da API, utilizando o sistema Gateway Pattern. Ela utiliza o conceito de:
 * "Secure by Default", isso significa que, caso a rota não esteja especificada aqui, ela será
 * BLOQUEADA por padrão!
 */

export type RouteConfig = {
  path: string;          // O caminho da rota (pode ser uma string ou REGEX);
  isPublic: boolean;     // Caso seja true, não é necessário autenticação;
  authType?: 'both' | 'cookie' | 'bearer'; // Tipo de auth exigida
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" // Especifica o tipo de método permitido. Caso não especificado, permite acesso a TODOS!
  allowedOrigins?: string[]; // (Opcional) Quem pode acessar. Caso especificado, permite apenas as rotas especificadas. Caso não exista, permite TODAS
};

export const API_ROUTE_MAP: RouteConfig[] = [
  {
    //
    // >>>> CERTIFICADOS <<<<
    //
    // Acesso ao PDF final do certificado
    path: '^/api/v1/certificates/[^/]+/download$',
    isPublic: true,
    method: 'GET'
  },
  {
    // Leitura do QR Code de validação
    path: '^/api/v1/certificates/[^/]+/scan$',
    isPublic: true,
    method: 'GET'
  },
  {
    // Proxy do template (bypass do Cloudflare R2)
    path: '^/api/v1/certificates/[^/]+/template$',
    isPublic: true,
    method: 'GET'
  },
  {
    // Visualizar detalhes técnicos de 1 certificado específico
    path: '^/api/v1/certificates/[^/]+$',
    isPublic: true,
    method: 'GET'
  },
  {
    // Pesquisa/Listagem de certificados (Livre, como você mencionou)
    path: '^/api/v1/certificates$',
    isPublic: true,
    method: 'GET'
  },
  {
    // PROTEÇÃO GLOBAL DE CERTIFICADOS: Qualquer POST, PUT ou DELETE será barrado
    // Se não for GET (pego pelas regras acima), cai aqui e exige autenticação e é necessário vir do próprio app.
    path: '^/api/v1/certificates',
    isPublic: false,
    authType: 'both',
    allowedOrigins:["http://localhost:3000", "https://certificados.dadg.com.br/"]
  },

  // ========================================================================
  // >>>> LIGAS ACADÊMICAS (Leagues) <<<<
  // ========================================================================
  {
    // Visualizar página de uma liga específica
    path: '^/api/v1/leagues/[^/]+$',
    isPublic: true,
    method: 'GET'
  },
  {
    // Listar nomes e siglas para selects/dropdowns
    path: '^/api/v1/leagues$',
    isPublic: true,
    method: 'GET'
  },
  {
    // PROTEÇÃO: Criação ou edição de Ligas
    path: '^/api/v1/leagues',
    isPublic: false,
    authType: 'both',
    allowedOrigins:["http://localhost:3000", "https://certificados.dadg.com.br/"],
  },

  // ========================================================================
  // 3. EVENTOS (Events)
  // ========================================================================
  {
    // Visualizar detalhes de um evento
    path: '^/api/v1/events/[^/]+$',
    isPublic: true,
    method: 'GET'
  },
  {
    // Listar eventos por data
    path: '^/api/v1/events$',
    isPublic: true,
    method: 'GET'
  },
  {
    // PROTEÇÃO: Criação e configuração de Eventos 
    // (Restrito ao dadgSite via Bearer Token, por exemplo)
    path: '^/api/v1/events',
    isPublic: false,
    authType: 'bearer',
    allowedOrigins:["http://localhost:3000", "https://certificados.dadg.com.br"],
  }
];
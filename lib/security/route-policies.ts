import { ObjectId } from "bson";
/**
 * Temos aqui a política de acesso para TODAS as rotas da API, utilizando o sistema Gateway Pattern. Ela utiliza o conceito de:
 * "Secure by Default", isso significa que, caso a rota não esteja especificada aqui, ela será
 * BLOQUEADA por padrão!
 */

export type RouteConfig = {
  path: string;          // O caminho da rota (pode ser uma string ou REGEX);
  authType?: 'both' | 'cookie' | 'bearer'; // Tipo de auth exigida
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" // Especifica o tipo de método permitido. Caso não especificado, permite acesso a TODOS!
  allowedOrigins?: string[]; // (Opcional) Quem pode acessar. Caso especificado, permite apenas as rotas especificadas. Caso não exista, permite TODAS
} & (
    | {
      isPublic: true;
    }
    | {
      isPublic: false;
      allowedUsers?: ObjectId[]; // Como o Id do usuário é retirado exclusivamente quando há login, isPublic deve ser obrigatoriamente falso!
    }
  )

export const API_ROUTE_MAP: RouteConfig[] = [
  //
  // >>> TESTE NAO DEIXE NADA DE IMPORTANTE AQUI PLMDS !!! ESTA ABERTO PARA TODOS!!!<<< 
  {
    path: '^/api/v1/test$',
    isPublic: false,
  },
  {
    path: '^/teste$',
    isPublic: false,
  },
  //
  //
  //
  // >>> SISTEMA PÚBLICO <<<
  //
  {
    path: '/_next/',
    isPublic: true,
  },
  //
  // >>>> ROTAS JÁ EXISTENTES [TEMPORÁRIAS] <<<
  // >>>> Como a mudança é brusca, POR ENQUANTO VAI CONTINUAR FUNCIONADO. APENAS NO PRÓPRIO APP
  //
  {
    path: "/todosCertificados/allCertificates",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/delete/eventAndAllCertificates$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/allCertificates$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/allEvents$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/allModificationHistory$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/CertificateWithPopulateByEvent/[^/]+$", // Dinâmico: [certificateId]
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/eventById/[^/]+$", // Dinâmico: [eventId]
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/events/[^/]+/participants$", // Dinâmico: [eventId] no meio da rota
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/createManyCertificates$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/createNewCertificate$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/createNewEvent$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/updateCertificate$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/updateEvent$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/createNewCertificate$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/createNewEvent$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/v1/certificates/[^/]+/delete$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/updateCertificate$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/updateEvent$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/put/uploadCertificateTemplate$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/v1/warnings$",
    isPublic: false,
    authType: 'both',
    method: "POST",
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  //
  // >>>> ROTAS NÃO API <<<<
  //
  {
    path: '^/$',
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/createCertificate(/.*)?$',
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/criarEvento(/.*)?$',
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/historicoDeModificacoes(/.*)?$',
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/Avisos$',
    isPublic: false,
    authType: 'cookie',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/todosCertificados(/.*)?$',
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/todosEventos(/.*)?$',
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/Silvio(/.*)?$',
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  // >>>> CERTIFICADOS <<<<
  {
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
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
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
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"],
  },

  // ========================================================================
  // 3. EVENTOS (Events)
  // ========================================================================
  {
    path: '^/api/v1/events/closedForRegistration/[0-9]{4}-[0-9]{2}$', // Dinâmico: "YYYY-MM"
    isPublic: false,
    authType: 'both',
    method: 'GET',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"],
  },
  {
    // Visualizar detalhes de um evento
    path: '^/api/v1/events/[0-9a-fA-F]{24}$',
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
    path: '^/api/v1/events/(user/)?([0-9a-fA-F]{24})$',
    isPublic: false,
    authType: 'both',
    method: 'GET',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"],
  },
  {
    path: "/api/v1/events/openForRegistration",
    isPublic: false,
    authType: 'both',
    method: 'GET',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"],
  },

  //
  // PUBLIC
  {
    path: '^/Silvio.png$',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"],
  }
];

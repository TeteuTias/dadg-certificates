import { ObjectId } from "bson";

export type RouteConfig = {
  path: string;          
  authType?: 'both' | 'cookie' | 'bearer'; 
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" 
  allowedOrigins?: string[]; 
} & (
    | {
      isPublic: true;
    }
    | {
      isPublic: false;
      allowedUsers?: ObjectId[]; 
    }
  )

export const API_ROUTE_MAP: RouteConfig[] = [
  {
    path: '^/api/v1/test$',
    isPublic: false,
  },
  {
    path: '/_next/',
    isPublic: true,
  },
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
    path: "^/api/get/CertificateWithPopulateByEvent/[^/]+$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/eventById/[^/]+$",
    isPublic: false,
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: "^/api/get/events/[^/]+/participants$",
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
    path: "^/api/v1/certificates/[^/]+/delete$",
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
  {
    path: '^/submeterTrabalho',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br", "https://www.dadg.com.br"]
  },
  {
    path: '^/visualizarTrabalhos',
    isPublic: false,
    authType: 'cookie',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br", "https://www.dadg.com.br"]
  },
  {
    path: '^/api/v1/certificates/[^/]+/download$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/certificates/[^/]+/scan$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/certificates/[^/]+/template$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/certificates/[^/]+$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/certificates$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/certificates',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"]
  },
  {
    path: '^/api/v1/leagues/[^/]+$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/leagues$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/leagues',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"],
  },
  {
    path: '^/api/v1/events/modalities',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br", "https://www.dadg.com.br"],
  },
  {
    path: '^/api/v1/events/[^/]+$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/events$',
    isPublic: true,
    method: 'GET'
  },
  {
    path: '^/api/v1/events',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br", "https://www.dadg.com.br"],
  },
  {
    path: '^/api/v1/articles',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br", "https://www.dadg.com.br"],
  },
  {
    path: '^/Silvio.png$',
    isPublic: false,
    authType: 'both',
    allowedOrigins: ["http://localhost:3000", "https://certificados.dadg.com.br"],
  }
];

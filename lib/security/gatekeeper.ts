import { ObjectId } from "bson";
import { NextRequest } from "next/server"
import { RouteConfig } from "./route-policies";
import { User } from "@auth0/nextjs-auth0/types";
import { verifyToken } from "./verifyToken";
import { JWTPayload } from "jose";
import { API_ROUTE_MAP } from "./route-policies";
import { auth0 } from "../auth0";

export default class GateKeeper {
    private origin: string;
    private path: string;
    private method: string;
    private apiRouteMap: RouteConfig[];
    private request: NextRequest
    constructor(request: NextRequest) {
        this.request = request
        this.path = this.request.nextUrl.pathname; //  Não uso o new URL pq o nextUrl é ótimo    
        // Extraindo method e padronizando como maiúsuclo
        this.method = this.request.method.toUpperCase();

        // O 'origin' é enviado pelo browser em chamadas CORS. 
        // O 'referer' é um fallback caso a chamada venha de um link direto.
        // Já limpamos a barra final aqui para evitar erros de string.
        this.origin = this.request.nextUrl.origin
            .replace(/\/$/, "");
        this.apiRouteMap = API_ROUTE_MAP;
    }

    /**
     * Executa a verificação baseada no mapa de rotas injetado.
     * Ele apenas verifica autenticidade de token se, somente se, isPublic for falso!
     */
    public async validate() {
        const policy = this.apiRouteMap.find(route => {
            const isPathMatch = new RegExp(route.path).test(this.path);
            const isMethodMatch = !route.method || route.method === this.method;
            return isPathMatch && isMethodMatch;
        });


        // Caso a rota não exista no mapa (Secure by Default)
        if (!policy) {
            return { authorized: false, status: 403, message: "Bloqueio: Rota não mapeada." };
        }

        // Se não for pública, o primeiro passo é verificar a autenticação
        if (policy?.isPublic === false) {
            const s = await this.identifySession();

            if (!s) {
                return { authorized: false, status: 401, message: "Sessão não identificada." };
            }

            // Validando 'allowedUsers'
            if (policy.allowedUsers && policy.allowedUsers.length > 0) {
                // Usamos o 'id' que já vem normalizado (sem prefixos tipo auth0|)
                const userId = s.sub.replace("auth0|", "");

                if (!ObjectId.isValid(userId)) {
                    return { authorized: false, status: 403, message: "O usuário não possui um identificador válido." };
                }

                // A FORMA CORRETA DE COMPARAR OBJECTIDS EM ARRAYS:
                const isAllowed = policy.allowedUsers.some(allowedId =>
                    allowedId.toString() === userId
                );

                if (!isAllowed) {
                    return {
                        authorized: false,
                        status: 403,
                        message: "O usuário não tem autorização para acessar essa rota."
                    };
                }
            }
        }
        // Validação de Origem (Somente se a policy exigir)
        if (policy.allowedOrigins && policy.allowedOrigins.length > 0) {
            const isAllowed = policy.allowedOrigins.some(allowed =>
                allowed.replace(/\/$/, "") === this.origin
            );
            if (!isAllowed) {
                return { authorized: false, status: 403, message: "Origem não autorizada." };
            }
        }

        // Se for pública, libera. Caso contrário, sinaliza que precisa de Auth.
        if (policy.isPublic) {
            return { authorized: true };
        }

        return {
            authorized: true,
            requiresAuth: true,
            authType: policy.authType
        };
    }

    private normalize(user: JWTPayload): User {
        /**
         * Serve apenas para normalizar o Token. É algo simples, mas deve ser centralizado para caso faça algo complexo com ele depois
         * ele já vai estar centralizado.
         */
        const normalUser = user as User
        return normalUser
    }
    /**
     * Resolve e normaliza a identidade do usuário a partir de múltiplas fontes (Cookie/Bearer).
     * * @returns {Promise<ApexSession | null>} Objeto de sessão padronizado ou null caso não identificado.
     * * @important Esta função NÃO realiza verificações de autorização ou política de acesso.
     */
    public async identifySession(): Promise<User | null> {
        // Primeiro, vamos tentar identificar a sessão pelo Bearer.
        const authHeader = this.request.headers.get("authorization");
        if (authHeader?.startsWith("Bearer ")) {
            const payload = await verifyToken(authHeader);
            if (payload) return this.normalize(payload);
        }
        // Tenta identificar via Cookie (Sessão de Navegador)
        // No App Router, getSession pode ser chamado sem o 'req' para usar o contexto global
        try {
            const session = await auth0.getSession();

            if (session?.user) {
                return this.normalize(session.user);
            }
        } catch (e) {
            console.error(">>> GateKeeper: Erro ao buscar sessão de cookie", e);
        }

        return null;
    }
}
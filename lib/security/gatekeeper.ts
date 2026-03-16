import { NextRequest } from "next/server"
import { RouteConfig } from "./route-policies";

export default class GateKeeper {
    private origin: string;
    private path: string;
    private method: string;
    private apiRouteMap: RouteConfig[];

    constructor(request: NextRequest, API_ROUTE_MAP: RouteConfig[]) {
        this.path = request.nextUrl.pathname; //  Não uso o new URL pq o nextUrl é ótimo    
        // Extraindo method e padronizando como maiúsuclo
        this.method = request.method.toUpperCase();

        // O 'origin' é enviado pelo browser em chamadas CORS. 
        // O 'referer' é um fallback caso a chamada venha de um link direto.
        // Já limpamos a barra final aqui para evitar erros de string.
        this.origin = request.nextUrl.origin
            .replace(/\/$/, "");

        this.apiRouteMap = API_ROUTE_MAP;
    }

    /**
     * Executa a verificação baseada no mapa de rotas injetado.
     */
    public validate() {
        const policy = this.apiRouteMap.find(route => {
            const isPathMatch = new RegExp(route.path).test(this.path);
            const isMethodMatch = !route.method || route.method === this.method;
            return isPathMatch && isMethodMatch;
        });

        // Caso a rota não exista no mapa (Secure by Default)
        if (!policy) {
            console.log(">>> Bloqueado: "+this.path)
            return { authorized: false, status: 403, message: "Bloqueio: Rota não mapeada." };
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
}
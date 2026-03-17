import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose'

// Configura o conjunto de chaves remotas da Auth0
const JWKS = createRemoteJWKSet(
    new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
)

/**
 * 
 * @param token O token CRÚ
 * @returns  JWTPayload ou null
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        // Lembre-se, ele espera algo no formato: "Bearer <token>"
        // Assim, devemos limpa-lo.
        if (!token.startsWith("Bearer ")) {
            return {
                authorized: false,
                message: "Tipo de autenticação inválido. Use o formato: Bearer <token>"
            };
        }
        const tokenLimpo = token.startsWith("Bearer ")
            ? token.split(" ")[1]
            : token;
        const { payload } = await jwtVerify(tokenLimpo, JWKS, {
            issuer: `https://${process.env.AUTH0_DOMAIN}/`,
            // O Audience é o Identifier da sua API que você criou no painel da Auth0
            // audience: process.env.AUTH0_AUDIENCE,
        })
        return payload
    } catch (error) {
        console.error('Erro na validação do token:', error)
        return null
    }
}
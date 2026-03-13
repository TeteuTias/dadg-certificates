import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose'

// Configura o conjunto de chaves remotas da Auth0
const JWKS = createRemoteJWKSet(
    new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
)

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWKS, {
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
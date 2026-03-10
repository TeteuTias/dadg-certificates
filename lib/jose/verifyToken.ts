import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';

// 

/**
 * @abstract BasicamenteUsa o jwtVerfy da biblioteca Jose para autenticar de fora o token de acesso do auth0, usando as chaves públicas.
 * @param token Consiste no token retirado de Request
 * @returns Retorna um tipo JWTPayload se autenticado e null se não autenticado
*/
export async function verifyToken(token: string, AUTH0_DOMAIN: string, issuer: string): Promise<JWTPayload | null> {
  // Remove qualquer protocolo que já exista e força o https://
  const cleanDomain = AUTH0_DOMAIN.replace(/^https?:\/\//, '');
  const JWKS_URL = new URL(`https://${cleanDomain}/.well-known/jwks.json`);

  // faz o fetch e o cache das chaves públicas automaticamente
  const JWKS = createRemoteJWKSet(JWKS_URL);
  try {

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: issuer,
      audience: process.env.AUTH0_AUDIENCE, // O identificador da sua API
    });

    return payload;
  } catch (error) {
    console.error("Token inválido:", error);
    return null;
  }
}
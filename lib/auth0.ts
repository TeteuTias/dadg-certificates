import { Auth0Client } from "@auth0/nextjs-auth0/server"

// Exemplo de configuração condicional
const isProd = process.env.NODE_ENV === 'production';

export const auth0 = new Auth0Client({

    appBaseUrl: isProd
        ? process.env.NEXT_PUBLIC_APP_BASE_URL
        : 'http://localhost:3000',
    // ...
});

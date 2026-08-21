import { Auth0Client } from "@auth0/nextjs-auth0/server"
import { adminSessionUser } from "./security/adminSession"

export const auth0 = new Auth0Client({
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    beforeSessionSaved: async (session) => ({
        ...session,
        user: adminSessionUser(session.user),
    }),
    session: {
        cookie: {
            name: 'dadg_admin_session',
        },
    },
});

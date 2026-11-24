import { getSession } from "./auth/session";

export async function getUserId() {
    const session = await getSession()

    return session?.user?.sub.replace("auth0|", "");
}

/*
export default (async function getUserId() {
    const session = await getSession();
    return session?.refreshToken;
})();
*/
import { auth0 } from "./auth0";

export async function getUserId() {
    const session = await auth0.getSession()

    return session?.user?.sub.replace("auth0|", "");
}

/*
export default (async function getUserId() {
    const session = await getSession();
    return session?.refreshToken;
})();
*/
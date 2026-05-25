import { User } from "@auth0/nextjs-auth0/types";

export function isAdmin(user: User | null): boolean {
  // O usuário pediu para permitir o acesso a todos que têm login (Auth0).
  // Portanto, basta checar se o usuário existe (está logado).
  return !!user;
}

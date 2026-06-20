"use client"
import { useUser, getAccessToken } from '@auth0/nextjs-auth0'; // Na v4 geralmente é Auth0Provider
import { useUserContext } from '@/lib/userProvider';
export default function () {
    const a = useUserContext()
    return (
        <main className="w-full min-h-screen bg-yellow-100">
            <h1 onClick={() => console.log(a)}>Estou Autenticado - {a.tokenVar}</h1>
        </main>
    )
}
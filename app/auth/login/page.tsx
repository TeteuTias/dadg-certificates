import { auth0 } from "@/app/src/lib/auth0/Auth0Client"
export default async function Home() {
  const session = await auth0.getSession()
  if (!session) {
    return (
      <main>
        <a href="/auth/login?screen_hint=signup">Sign up</a>
        <a href="/auth/login">Log in</a>
      </main>
    )
  }

  return (
    <main>
      <h1>Welcome, {session.user.name}!</h1>
    </main>
  )
}
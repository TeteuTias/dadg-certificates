"use client"
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@auth0/nextjs-auth0"


export default function Home() {

  const { user, } = useUser()

  async function fetchData() {


    // call external API with the token...
  }
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="w-full text-center">Escolha uma Opção</h1>
        <article className="flex justify-center items-center bg-yellow-100 gap-4">
          <Card title="Eventos" path="/todosEventos" />
          <Card title="Certificados" path="/todosCertificados" />
        </article>

      </main>

    </div>
  );
}
const Card: React.FC<{ title: string, path: string }> = ({ title, path }) => {
  return (
    <Link href={path} prefetch={true} className="bg-red-900 w-full">
      <div className="bg-red-100 p-10">
        <div>
          <h1>{title}</h1>
        </div>
        <div>
        </div>
      </div>
    </Link>
  )
}
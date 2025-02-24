"use client"
import Link from "next/link";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";

export default function Home() {



  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-[#0B2545]" style={PoppinsFontLib.style}>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="w-full text-center text-[50px] text-white">Escolha uma Opção</h1>
        <div className="w-full">
        <article className="flex justify-center items-center gap-4">
          <Card title="Eventos" path="/todosEventos" />
          <Card title="Certificados" path="/todosCertificados" />
        </article>
        </div>

      </main>

    </div>
  );
}
const Card: React.FC<{ title: string, path: string }> = ({ title, path }) => {
  return (
    <Link href={path} prefetch={true} className=" w-full">
      <div className="bg-[#eef4ed] p-10 border-b-[7px] border-r-[7px] border-b-black border-r-black ">
        <div className="text-center">
          <h1 className="font-extrabold">{title}</h1>
        </div>
        <div>
        </div>
      </div>
    </Link>
  )
}
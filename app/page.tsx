"use client"
import Link from "next/link";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import React, { useState } from "react";


export default function Home() {



  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-[#0B2545]" style={PoppinsFontLib.style}>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="w-full text-center text-[50px] text-white">Escolha uma Opção</h1>
        <div className="w-full">
          <article className="flex justify-center items-center gap-4">
            <ExpansiveCard title="Certificados">
              <Card title="Ver Certificados" path="/todosCertificados/allCertificates" />
              <Card title="Criar Certificado" path="/createCertificate" />
            </ExpansiveCard>
            <ExpansiveCard title="Eventos">
              <Card title="Ver Eventos" path="/todosEventos/" />
              <Card title="Criar Eventos" path="/criarEvento/" />
            </ExpansiveCard>
          </article>
        </div>

      </main>

    </div>
  );
}

const ExpansiveCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => {

  const [isOpen, setIsOpen] = useState<boolean>(false)

  const toggleIsOpen = () => {
    setIsOpen((prev) => !prev)
  }

  return (
    <div>

      < main className=" w-full">
        <div className="bg-[#eef4ed] p-10 border-b-[7px] border-r-[7px] border-b-black border-r-black cursor-pointer" onClick={toggleIsOpen}>
          <div className="text-center">
            <h1 className="font-extrabold">{title}</h1>
          </div>
          <div>
          </div>
        </div>
      </main>

      {
        isOpen &&
        <main className="flex items-center content-center justify-center align-center w-full absolute inset-0 bg-yellow-900/70">
          <article className="flex flex-col justify-center items-center gap-4">
            <div className="cursor-pointer" onClick={toggleIsOpen}>
              <p className="font-extrabold bg-white px-5">FECHAR</p>
            </div>
            <div className="flex flex-row space-x-3">
              {React.Children.map(children, (child) => child)}
            </div>
          </article>
        </main>
      }


    </div >
  )
}

const Card: React.FC<{ title: string, path: string }> = ({ title, path }) => {
  return (
    <Link href={path} prefetch={true} className=" w-full">
      <div className="flex items-center justify-center align-center content-center bg-[#eef4ed] p-10 border-b-[7px] border-r-[7px] border-b-black border-r-black max-h-[60px] min-h-[60px]">
        <h1 className="font-extrabold w-full text-center">{title}</h1>
        <div>
        </div>
      </div>
    </Link>
  )
}
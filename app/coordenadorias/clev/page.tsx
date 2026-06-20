"use client";

import React from "react";
import Image from "next/image";
import { CoordenadoriaLayout, ContentSection } from "../../components/CoordenadoriaLayout";
import { useTheme } from "next-themes";
import { CheckCircle2 } from "lucide-react";

export default function ClevPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== "light" : true;

  return (
    <CoordenadoriaLayout
      acronym="CLEV"
      title="Coordenadoria Local de Estágios e Vivências"
      description="Transformando experiências acadêmicas em oportunidades de crescimento profissional e conectando você ao mundo prático da medicina."
      logoSrc="/coordinators/CLEV.jpg"
      themeColor="teal"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <ContentSection title="Quem Somos">
          <p>
            Somos a Coordenadoria Local de Estágios e Vivências, responsável por gerenciar e organizar as experiências práticas 
            internacionais e nacionais dos estudantes de medicina.
          </p>
        </ContentSection>

        <ContentSection title="O que buscamos">
          <p>
            Buscamos proporcionar experiências práticas de qualidade, garantindo que os estudantes tenham acesso a estágios 
            que complementem sua formação.
          </p>
        </ContentSection>

        <ContentSection title="Nossa Missão">
          <p>
            Garantir que cada estudante tenha acesso a experiências práticas de qualidade, 
            contribuindo para uma formação médica global e completa.
          </p>
        </ContentSection>
      </div>

      <ContentSection title="Nossos Valores">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { title: "Excelência", desc: "Na formação prática" },
            { title: "Organização", desc: "E eficiência" },
            { title: "Compromisso", desc: "Com a qualidade" },
            { title: "Inovação", desc: "Nos processos" }
          ].map((val, idx) => (
            <div key={idx} className="flex flex-col items-center text-center">
              <CheckCircle2 className={`w-8 h-8 mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{val.title}</span>
              <span className={`text-sm ${isDark ? 'text-blue-200/70' : 'text-slate-600'}`}>{val.desc}</span>
            </div>
          ))}
        </div>
      </ContentSection>

      <ContentSection title="Entre no nosso grupo">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <p className="mb-4">
              Faça parte do nosso grupo do WhatsApp para receber todas as informações sobre os eventos, oportunidades de estágios 
              e vivências da CLEV em primeira mão.
            </p>
            <p className="text-sm italic opacity-80">
              Escaneie o QR Code ao lado ou clique se estiver no celular para entrar diretamente no grupo.
            </p>
          </div>
          <div className={`p-4 rounded-3xl shrink-0 ${isDark ? 'bg-white' : 'bg-white border border-blue-100 shadow-xl'}`}>
            <Image 
              src="/QRCLEV.png" 
              alt="QR Code WhatsApp CLEV" 
              width={200} 
              height={200} 
              className="rounded-xl"
            />
          </div>
        </div>
      </ContentSection>
    </CoordenadoriaLayout>
  );
}
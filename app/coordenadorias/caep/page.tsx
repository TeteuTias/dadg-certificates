"use client";

import React from "react";
import { CoordenadoriaLayout, ContentSection } from "../../components/CoordenadoriaLayout";
import { Lightbulb, Microscope, BookOpen } from "lucide-react";
import { useTheme } from "next-themes";

export default function CaepPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== "light" : true;

  return (
    <CoordenadoriaLayout
      acronym="CAEP"
      title="Coordenadoria Acadêmica de Extensão e Pesquisa"
      description="A CAEP atua fomentando a pesquisa científica, promovendo simpósios, congressos e projetos de extensão que impactam a sociedade."
      logoSrc="/coordinators/CAEP.jpg"
      themeColor="indigo"
    >
      <ContentSection title="Nossa Missão">
        <p className="text-lg">
          Fomentar o pensamento científico e a responsabilidade social entre os estudantes de medicina do IMEPAC. A CAEP atua como ponte entre a sala de aula e a comunidade, desenvolvendo projetos de extensão que impactam a sociedade e pesquisas que avançam a fronteira do conhecimento médico.
        </p>
      </ContentSection>

      <ContentSection title="Projetos em Andamento">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-6 rounded-2xl border transition-all hover:-translate-y-1 shadow-sm ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-blue-50 hover:shadow-md'}`}>
            <Microscope className={`w-10 h-10 mb-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Simpósio de Iniciação Científica
            </h3>
            <p className={`text-sm ${isDark ? 'text-blue-100/70' : 'text-slate-600'}`}>
              Organização do evento anual para apresentação de resumos e artigos científicos produzidos pelos acadêmicos durante o semestre.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border transition-all hover:-translate-y-1 shadow-sm ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-blue-50 hover:shadow-md'}`}>
            <Lightbulb className={`w-10 h-10 mb-4 ${isDark ? 'text-yellow-400' : 'text-amber-500'}`} />
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Projeto Saúde na Escola
            </h3>
            <p className={`text-sm ${isDark ? 'text-blue-100/70' : 'text-slate-600'}`}>
              Ações de extensão voltadas para a educação em saúde em escolas públicas da região, focando em prevenção primária.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border transition-all hover:-translate-y-1 shadow-sm ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-blue-50 hover:shadow-md'}`}>
            <BookOpen className={`w-10 h-10 mb-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Mentoria Acadêmica
            </h3>
            <p className={`text-sm ${isDark ? 'text-blue-100/70' : 'text-slate-600'}`}>
              Programa de apoio à submissão de projetos no Comitê de Ética em Pesquisa (CEP) e formatação de artigos.
            </p>
          </div>
        </div>
      </ContentSection>
    </CoordenadoriaLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CoordenadoriaLayout, ContentSection } from "../../components/CoordenadoriaLayout";
import { IAcademicLeague } from "@/app/lib/models/AcademicLeagues";
import { Award, BookOpenCheck, ChevronDown, ChevronUp, Network, Users } from "lucide-react";

const quickLinks = [
  { label: "Missao", href: "#missao" },
  { label: "Valores", href: "#valores" },
  { label: "Destaques", href: "#destaques" },
  { label: "Equipe", href: "#equipe" },
  { label: "Ligas", href: "#ligas" },
];

export default function CLAMPage() {
  const [activeSection, setActiveSection] = useState<"basic" | "clinic" | null>(null);
  const [data, setData] = useState<Pick<IAcademicLeague, "_id" | "name" | "acronym" | "type">[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/get/getAllNamesAndAcronym");
        if (!res.ok) throw new Error("Network response was not ok");
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const toggleSection = (section: "basic" | "clinic") => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <CoordenadoriaLayout
      acronym="CLAM"
      title="Coordenadoria de Ligas Academicas de Medicina"
      description="A CLAM e o orgao responsavel por coordenar e integrar todas as ligas academicas da Imepac, fomentando o desenvolvimento cientifico."
      logoSrc="/coordinators/CLAM_logo.png"
      themeColor="red"
      quickLinks={quickLinks}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ContentSection id="missao" title="Missao">
          <p>
            A CLAM atua como o pilar central na coordenacao e integracao de todas as Ligas Academicas de Medicina,
            conectando estudantes a projetos extracurriculares, pesquisa, extensao e aprofundamento pratico.
          </p>
        </ContentSection>

        <ContentSection id="valores" title="Valores">
          <p>
            Integracao, responsabilidade academica, colaboracao entre ligas, incentivo cientifico e compromisso com
            uma formacao medica mais completa.
          </p>
        </ContentSection>
      </div>

      <ContentSection id="destaques" title="Destaques">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Network,
              title: "Integracao",
              text: "Aproxima as ligas, organiza demandas comuns e fortalece a troca entre os projetos.",
            },
            {
              icon: BookOpenCheck,
              title: "Desenvolvimento",
              text: "Estimula atividades cientificas, eventos, aulas abertas e vivencias complementares.",
            },
            {
              icon: Award,
              title: "Reconhecimento",
              text: "Valoriza a participacao discente e apoia a organizacao das iniciativas academicas.",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="p-6 rounded-2xl border transition-all duration-300 bg-white dark:bg-white/5 border-red-50 dark:border-white/10 hover:border-red-200 dark:hover:border-white/20 hover:-translate-y-1">
                <Icon className="w-9 h-9 mb-4 text-red-600 dark:text-red-300" />
                <h4 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{item.title}</h4>
                <p className="text-sm text-slate-600 dark:text-blue-100/70">{item.text}</p>
              </div>
            );
          })}
        </div>
      </ContentSection>

      <ContentSection id="equipe" title="Equipe">
        <div className="flex flex-col md:flex-row gap-6 md:items-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <Users className="w-8 h-8 text-red-600 dark:text-red-300" />
          </div>
          <div>
            <p>
              A equipe da CLAM acompanha as ligas academicas, apoia a comunicacao entre coordenadores e facilita a
              organizacao das atividades ao longo do semestre.
            </p>
            <p className="mt-3 text-base opacity-75">
              Para demandas especificas, procure a coordenadoria responsavel pela liga ou acompanhe os canais oficiais do DADG.
            </p>
          </div>
        </div>
      </ContentSection>

      <ContentSection id="ligas" title="Ligas Academicas">
        <div className="space-y-6 mt-4">
          <div className="rounded-2xl border transition-colors duration-300 overflow-hidden bg-white/50 dark:bg-white/5 border-red-100 dark:border-white/10">
            <button
              onClick={() => toggleSection("basic")}
              className="w-full flex items-center justify-between p-6 font-semibold text-xl transition-colors hover:bg-red-50/50 dark:hover:bg-white/5"
            >
              Ciclo Basico
              {activeSection === "basic" ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>

            {activeSection === "basic" && (
              <div className="p-6 pt-0 border-t border-red-50 dark:border-white/10">
                <ul className="space-y-3 mt-4">
                  {data.filter((league) => league.type === "basic").map((league, index) => (
                    <li key={index}>
                      <Link href={`/coordenadorias/clam/liga/${league._id}`} className="block p-4 rounded-xl border transition-all shadow-sm bg-white dark:bg-transparent border-red-50 dark:border-white/5 hover:border-red-200 dark:hover:border-white/20 dark:hover:bg-white/5">
                        {league.name} <span className="font-bold">({league.acronym})</span>
                      </Link>
                    </li>
                  ))}
                  {data.filter((league) => league.type === "basic").length === 0 && (
                    <p className="text-sm opacity-60">Nenhuma liga encontrada.</p>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border transition-colors duration-300 overflow-hidden bg-white/50 dark:bg-white/5 border-red-100 dark:border-white/10">
            <button
              onClick={() => toggleSection("clinic")}
              className="w-full flex items-center justify-between p-6 font-semibold text-xl transition-colors hover:bg-red-50/50 dark:hover:bg-white/5"
            >
              Ciclo Clinico
              {activeSection === "clinic" ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>

            {activeSection === "clinic" && (
              <div className="p-6 pt-0 border-t border-red-50 dark:border-white/10">
                <ul className="space-y-3 mt-4">
                  {data.filter((league) => league.type === "clinic").map((league, index) => (
                    <li key={index}>
                      <Link href={`/coordenadorias/clam/liga/${league._id}`} className="block p-4 rounded-xl border transition-all shadow-sm bg-white dark:bg-transparent border-red-50 dark:border-white/5 hover:border-red-200 dark:hover:border-white/20 dark:hover:bg-white/5">
                        {league.name} <span className="font-bold">({league.acronym})</span>
                      </Link>
                    </li>
                  ))}
                  {data.filter((league) => league.type === "clinic").length === 0 && (
                    <p className="text-sm opacity-60">Nenhuma liga encontrada.</p>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </ContentSection>
    </CoordenadoriaLayout>
  );
}

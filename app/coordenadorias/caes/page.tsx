"use client";

import React from "react";
import { CoordenadoriaLayout, ContentSection } from "../../components/CoordenadoriaLayout";

export default function CaesPage() {
  return (
    <CoordenadoriaLayout
      acronym="CAES"
      title="Coordenadoria Acadêmica de Educação em Saúde"
      description="Trazendo e levando a educação na saúde para a comunidade onde ela pode transformar a qualidade de vida da população para melhor."
      logoSrc="/coordinators/CAES.jpg"
      themeColor="green"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ContentSection title="Quem Somos">
          <p>
            Somos a Coordenadoria Acadêmica de Educação em Saúde. Trabalhamos incansavelmente para promover 
            projetos e ações focados em aprimorar a educação contínua da saúde dentro e fora da comunidade acadêmica.
          </p>
        </ContentSection>

        <ContentSection title="O que buscamos">
          <p>
            Buscamos trazer e levar a educação na saúde para a comunidade onde ela pode transformar a qualidade de vida da população para melhor, criando um ambiente de prevenção e bem-estar.
          </p>
        </ContentSection>
      </div>

      <ContentSection title="Nossos valores">
        <ul className="space-y-4 font-medium">
          <li className="flex items-center gap-3">
            <span className="text-blue-500 text-2xl">→</span> Compromisso com a excelência
          </li>
          <li className="flex items-center gap-3">
            <span className="text-blue-500 text-2xl">→</span> Ética
          </li>
          <li className="flex items-center gap-3">
            <span className="text-blue-500 text-2xl">→</span> Educação e saúde para a população
          </li>
          <li className="flex items-center gap-3">
            <span className="text-blue-500 text-2xl">→</span> Inovação e evolução constante
          </li>
        </ul>
      </ContentSection>

      <ContentSection title="Nossa missão">
        <p>
          Trabalhamos para impactar positivamente a vida das pessoas e transformar a comunidade em um lugar melhor, 
          aliando a nossa prática médica estudantil ao compromisso com a transformação social e a saúde pública.
        </p>
      </ContentSection>
    </CoordenadoriaLayout>
  );
}
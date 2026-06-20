"use client";

import React from "react";
import Image from "next/image";
import { CoordenadoriaLayout, ContentSection } from "../../components/CoordenadoriaLayout";

const teamMembers = [
  { name: 'Mateus Rosa', role: 'Coordenador', photo: '/membersCAC/mateus.jpg' },
  { name: 'Nicoly Gonzaga', role: 'Coordenadora', photo: '/membersCAC/nicoly.jpeg' },
  { name: 'Gianluca Zambiazi', role: 'Núcleo de Apoio', photo: '/membersCAC/gianluca.jpeg' },
  { name: 'Rafaela Luiza Gonzaga', role: 'Núcleo de Apoio', photo: '/membersCAC/rafaela.png' },
  { name: 'Lucas Borges', role: 'Núcleo de Apoio', photo: '/membersCAC/lucas.jpg' },
  { name: 'Heloísa Benatt', role: 'Núcleo de Apoio', photo: '/membersCAC/helo.jpeg' },
  { name: 'Vitor Barcelos', role: 'Núcleo de Apoio', photo: '/membersCAC/vitor_barcelos.jpg' },
  { name: 'Gabriel Ramalho', role: 'Núcleo de Apoio', photo: '/membersCAC/gabriel_ramalho.jpg' }
];

export default function CacPage() {
  return (
    <CoordenadoriaLayout
      acronym="CAC"
      title="Coordenadoria Acadêmica de Certificados e TI"
      description="O CAC atua trazendo inovação, tecnologia e organização para os processos de Certificados do DADG e melhorando a plataforma do aluno."
      logoSrc="/coordinators/CAC.jpg"
      themeColor="blue"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <ContentSection title="Visão">
          <p>Ser a ponte entre setores, pessoas e ideias com empatia e excelência.</p>
        </ContentSection>

        <ContentSection title="Missão">
          <p>Garantir inovação e organização para os certificados e aprimorar o portal para trazer a melhor experiência para os discentes.</p>
        </ContentSection>

        <ContentSection title="Valores">
          <p>Empatia, Transparência, Agilidade, Organização e Colaboração.</p>
        </ContentSection>
      </div>

      <ContentSection title={`Equipe CAC ${new Date().getFullYear()}`}>
        <p className="mb-8 italic opacity-80">Nossa coordenadoria valoriza cada conquista como um reconhecimento oficial.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {teamMembers.map((member, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-2 bg-white dark:bg-white/5 border-blue-50 dark:border-white/10 shadow-md dark:shadow-lg hover:shadow-xl hover:border-blue-200 dark:hover:bg-white/10 dark:hover:border-white/20">
              <div className="relative w-28 h-28 rounded-full mb-4 overflow-hidden border-4 border-blue-100 dark:border-[#002B5B]">
                {member.photo ? (
                  <Image src={member.photo} alt={member.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-2xl font-bold opacity-50">{member.name.charAt(0)}</span>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-lg mb-1 text-slate-900 dark:text-white">{member.name}</h3>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-300">{member.role}</p>
            </div>
          ))}
        </div>
      </ContentSection>
    </CoordenadoriaLayout>
  );
}

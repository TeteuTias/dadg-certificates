'use client';

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";

const coordenadorias = [
  {
    href: "/coordenadorias/caep",
    label: "CAEP",
    title: "Extensão e Pesquisa",
    desc: "Coordenadoria Acadêmica de Extensão e Pesquisa. Fomentando a produção científica e projetos sociais.",
    icon: <Image src="/coordinators/CAEP.jpg" alt="CAEP" width={64} height={64} className="object-cover w-full h-full rounded-full" />
  },
  {
    href: "/coordenadorias/caes",
    label: "CAES",
    title: "Educação em Saúde",
    desc: "Coordenadoria Acadêmica de Educação em Saúde. Focada na promoção da saúde e educação continuada.",
    icon: <Image src="/coordinators/CAES.jpg" alt="CAES" width={64} height={64} className="object-cover w-full h-full rounded-full" />
  },
  {
    href: "/coordenadorias/clam",
    label: "CLAM",
    title: "Ligas Acadêmicas",
    desc: "Coordenadoria de Ligas Acadêmicas de Medicina. Integrando o ensino prático e teórico extracurricular.",
    icon: <Image src="/coordinators/CLAM_logo.png" alt="CLAM" width={64} height={64} className="object-cover w-full h-full rounded-full" />
  },
  {
    href: "/coordenadorias/cac",
    label: "CAC",
    title: "Certificados e TI",
    desc: "Coordenadoria Acadêmica de Certificados e TI. Inovação tecnológica e gestão documental do DADG.",
    icon: <Image src="/coordinators/CAC.jpg" alt="CAC" width={64} height={64} className="object-cover w-full h-full rounded-full" />
  },
  {
    href: "/coordenadorias/clev",
    label: "CLEV",
    title: "Estágios e Vivências",
    desc: "Coordenadoria Local de Estágios e Vivências. Intercâmbio médico e experiências práticas internacionais.",
    icon: <Image src="/coordinators/CLEV.jpg" alt="CLEV" width={64} height={64} className="object-cover w-full h-full rounded-full" />
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function CoordenadoriasPage() {
  return (
    <main className="min-h-screen flex flex-col transition-colors duration-500 bg-white dark:bg-[#001021]">
      {/* HERO INTERNO */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden flex flex-col items-center justify-center text-center transition-colors duration-500 bg-slate-50 dark:bg-[#002B5B]">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-slate-50 dark:from-[#00152b] dark:to-[#002B5B] dark:opacity-80 transition-colors duration-500" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] transition-colors duration-500" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 font-serif tracking-tight drop-shadow-md transition-colors duration-500 text-[#002B5B] dark:text-white">
            Nossas Coordenadorias
          </h1>
          <p className="text-lg md:text-xl font-light leading-relaxed transition-colors duration-500 text-slate-600 dark:text-blue-100/90">
            As engrenagens que movem o Diretório Acadêmico. Conheça as pastas dedicadas a enriquecer a experiência dos estudantes de medicina do IMEPAC, desde a pesquisa científica até o intercâmbio internacional.
          </p>
        </motion.div>
      </section>

      {/* WAVE DE TRANSIÇÃO (Opcional, para manter a fluidez) */}
      <div className="w-full transition-colors duration-500 bg-slate-50 dark:bg-[#002B5B]">
        <svg viewBox="0 0 1440 120" className="w-full h-auto block" preserveAspectRatio="none">
          <path className="fill-[#ffffff] dark:fill-[#001021]" d="M0,0 C480,120 960,120 1440,0 L1440,120 L0,120 Z" />
        </svg>
      </div>

      {/* GRID DE COORDENADORIAS */}
      <section className="flex-grow px-6 py-20 pb-32 relative">
        {/* Subtle background pattern for light mode to enhance glassmorphism */}
        <div className="absolute inset-0 bg-[radial-gradient(#002B5B_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none transition-opacity duration-500 opacity-[0.02] dark:opacity-0" />

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10"
        >
          {coordenadorias.map((coord) => (
            <motion.div key={coord.label} variants={cardVariants}>
              <Link href={coord.href} className="block h-full outline-none">
                <div className="group relative flex flex-col h-full p-8 rounded-3xl backdrop-blur-md hover:-translate-y-2 transition-all duration-500 overflow-hidden cursor-pointer bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-blue-300 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(30,58,138,0.08)] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/10 dark:hover:border-white/25 dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
                  {/* Glow de fundo */}
                  <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-[50px] opacity-0 transition-opacity duration-500 pointer-events-none bg-blue-400 group-hover:opacity-10 dark:bg-blue-500 dark:group-hover:opacity-20" />
                  
                  {/* Logo Animado */}
                  <div className="mb-6 w-20 h-20 rounded-full relative z-10 flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-110 transition-transform duration-500">
                    {/* Spinning Gradient Border */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-400 dark:from-blue-600 dark:via-emerald-500 dark:to-indigo-500 animate-[spin_4s_linear_infinite] group-hover:animate-[spin_2s_linear_infinite]" />
                    {/* Inner White Circle */}
                    <div className="absolute inset-1 bg-white dark:bg-slate-900 rounded-full z-10" />
                    {/* Logo Image */}
                    <div className="relative z-20 w-full h-full p-[2px] rounded-full overflow-hidden">
                      {coord.icon}
                    </div>
                  </div>
                  
                  <div className="flex items-baseline gap-3 mb-3 relative z-10">
                    <h2 className="text-2xl font-bold font-serif transition-colors duration-500 text-slate-900 dark:text-white">{coord.label}</h2>
                    <span className="text-sm font-medium tracking-wider uppercase transition-colors duration-500 text-blue-700 dark:text-blue-300">{coord.title}</span>
                  </div>
                  
                  <p className="text-sm md:text-base leading-relaxed flex-grow relative z-10 transition-colors duration-500 text-slate-600 dark:text-blue-100/70">
                    {coord.desc}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-8 font-bold text-sm uppercase tracking-wider relative z-10 transition-colors duration-300 text-[#002B5B] group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-200">
                    Ver Ações
                    <svg className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </main>
  );
}

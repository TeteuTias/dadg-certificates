"use client";

import Link from "next/link";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import React, { useState } from "react";
import {
  Bell,
  Calendar,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  Plus,
  Sparkles,
  X,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden" style={PoppinsFontLib.style}>
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-[#002B5B]/30 to-transparent pointer-events-none" />
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10 px-4 md:px-8 pt-20 pb-12">
        <div className="text-center mb-16 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            Sistema de <span className="text-blue-500">Certificados</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
            Gerencie certificados, eventos e histórico de modificações de forma eficiente e profissional.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-8">O que vamos fazer hoje?</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ExpansiveCard
            title="Certificados"
            icon={<GraduationCap size={40} className="text-blue-400" />}
            description="Visualize, crie e gerencie todos os certificados do sistema"
          >
            <Card title="Ver Certificados" path="/todosCertificados/allCertificates" icon={<Eye size={24} />} />
            <Card title="Criar Certificado" path="/createCertificate" icon={<Plus size={24} />} />
          </ExpansiveCard>

          <Link href="/Avisos" prefetch className="group block">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl h-full flex flex-col items-center justify-center text-center transition-all hover:bg-slate-800/80 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] hover:-translate-y-1">
              <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Bell size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Avisos</h3>
              <p className="text-slate-400 text-sm mb-6 flex-grow">
                Dispare e-mails automáticos para as coordenadorias com validação.
              </p>
              <ArrowRight className="text-blue-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link href="/historicoDeModificacoes" prefetch className="group block">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl h-full flex flex-col items-center justify-center text-center transition-all hover:bg-slate-800/80 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] hover:-translate-y-1">
              <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Histórico</h3>
              <p className="text-slate-400 text-sm mb-6 flex-grow">
                Acompanhe todas as alterações realizadas no sistema.
              </p>
              <ArrowRight className="text-blue-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <ExpansiveCard
            title="Eventos"
            icon={<Calendar size={40} className="text-blue-400" />}
            description="Gerencie eventos e associe certificados a cada um deles"
          >
            <Card title="Ver Eventos" path="/todosEventos/" icon={<FolderOpen size={24} />} />
            <Card title="Criar Eventos" path="/criarEvento/" icon={<Sparkles size={24} />} />
          </ExpansiveCard>
        </div>
      </div>
    </div>
  );
}

const ExpansiveCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}> = ({ title, icon, description, children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const toggleIsOpen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <div className="group cursor-pointer h-full" onClick={toggleIsOpen}>
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl h-full flex flex-col items-center justify-center text-center transition-all hover:bg-slate-800/80 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] hover:-translate-y-1">
          <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
          {description && <p className="text-slate-400 text-sm mb-6 flex-grow">{description}</p>}
          <ArrowRight className="text-blue-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={toggleIsOpen}>
          <div className="bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(2,6,23,0.95)_100%)] border border-slate-700 p-8 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col gap-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                {icon && <span className="scale-75 origin-left">{icon}</span>}
                {title}
              </h3>
              <button className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors" onClick={toggleIsOpen}>
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {React.Children.map(children, (child) => child)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Card: React.FC<{ title: string; path: string; icon?: React.ReactNode }> = ({
  title,
  path,
  icon,
}) => {
  return (
    <Link href={path} prefetch className="group block">
      <div className="bg-slate-800/50 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-4 transition-all hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)] hover:-translate-y-1 h-full min-h-[140px]">
        {icon && <div className="text-blue-400 group-hover:scale-110 transition-transform">{icon}</div>}
        <h3 className="text-lg font-bold text-slate-200 group-hover:text-white transition-colors">{title}</h3>
      </div>
    </Link>
  );
};

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
} from "lucide-react";
import "./page.css";

export default function Home() {
  return (
    <div className="home-container" style={PoppinsFontLib.style}>
      <div className="home-hero">
        <div className="hero-content">
          <h1 className="home-title">Bem-vindo ao Sistema de Certificados</h1>
          <p className="home-subtitle">
            Gerencie certificados, eventos e historico de modificacoes de forma
            eficiente e profissional
          </p>
        </div>
      </div>

      <div className="home-section">
        <h2 className="section-title">O que vamos fazer hoje?</h2>
        <div className="home-options">
          <ExpansiveCard
            title="Certificados"
            icon={<GraduationCap size={56} />}
            description="Visualize, crie e gerencie todos os certificados do sistema"
          >
            <Card
              title="Ver Certificados"
              path="/todosCertificados/allCertificates"
              icon={<Eye size={32} />}
            />
            <Card title="Criar Certificado" path="/createCertificate" icon={<Plus size={32} />} />
          </ExpansiveCard>

          <div className="option-card">
            <Link href="/Avisos" prefetch className="glass-card option-card-content direct-card">
              <div className="card-icon">
                <Bell size={56} />
              </div>
              <h2 className="option-card-title">Avisos</h2>
              <p className="card-description">
                Dispare e-mails automaticos para as coordenadorias com validacao e
                feedback imediato
              </p>
              <div className="card-arrow">{"->"}</div>
            </Link>
          </div>

          <div className="option-card">
            <Link
              href="/historicoDeModificacoes"
              prefetch
              className="glass-card option-card-content direct-card"
            >
              <div className="card-icon">
                <FileText size={56} />
              </div>
              <h2 className="option-card-title">Historico de Modificacoes</h2>
              <p className="card-description">
                Acompanhe todas as alteracoes realizadas no sistema
              </p>
              <div className="card-arrow">{"->"}</div>
            </Link>
          </div>

          <ExpansiveCard
            title="Eventos"
            icon={<Calendar size={56} />}
            description="Gerencie eventos e associe certificados a cada um deles"
          >
            <Card title="Ver Eventos" path="/todosEventos/" icon={<FolderOpen size={32} />} />
            <Card title="Criar Eventos" path="/criarEvento/" icon={<Sparkles size={32} />} />
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

  const toggleIsOpen = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <div className="option-card">
        <div className="glass-card option-card-content" onClick={toggleIsOpen}>
          {icon && <div className="card-icon">{icon}</div>}
          <h2 className="option-card-title">{title}</h2>
          {description && <p className="card-description">{description}</p>}
          <div className="card-arrow">{"->"}</div>
        </div>
      </div>

      {isOpen && (
        <div className="expanded-overlay" onClick={toggleIsOpen}>
          <div className="expanded-content" onClick={(event) => event.stopPropagation()}>
            <div className="expanded-header">
              <h3 className="expanded-title">{title}</h3>
              <button className="glass-button close-button" onClick={toggleIsOpen}>
                <X size={18} />
                <span>Fechar</span>
              </button>
            </div>
            <div className="expanded-cards">{React.Children.map(children, (child) => child)}</div>
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
    <Link href={path} prefetch className="expanded-card-item glass-card">
      {icon && <div className="card-icon-small">{icon}</div>}
      <h3 className="expanded-card-title">{title}</h3>
    </Link>
  );
};

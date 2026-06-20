'use client';
import React from 'react';
import Link from 'next/link';
import './style.css';

const MenuDrawer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <button className="menu-close-button">
        <span className="menu-close-icon"></span>
      </button>
      <header className="header-container">
        <div>
          {/* Conteúdo da esquerda */}
        </div>
        <div className="header-center">
          <Link href="/">Início</Link>
          <Link href="/certificados">Certificados</Link>
          <Link href="/coordenadorias">Coordenadorias</Link>
        </div>
        <div>
          {/* Conteúdo da direita */}
        </div>
      </header>
      {children}
    </div>
  );
};

export default MenuDrawer; 
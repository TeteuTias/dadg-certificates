"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import "./Header.css";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Só ativa em mobile (largura <= 768px)
      if (window.innerWidth <= 768) {
        if (currentScrollY > 100) {
          setIsScrolled(true);
        } else {
          setIsScrolled(false);
        }
      } else {
        setIsScrolled(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    // Verifica também quando a janela é redimensionada
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [lastScrollY]);

  return (
    <header className={`header-container ${isScrolled ? "header-scrolled" : ""}`}>
      <nav className="header-nav">
        <Link href="/" className="header-logo">
          DADG Certificates
        </Link>
        <div className="header-links">
          <Link href="/" className="header-link">
            Home
          </Link>
          <Link href="/todosCertificados/allCertificates" className="header-link">
            Certificados
          </Link>
          <Link href="/todosEventos" className="header-link">
            Eventos
          </Link>
          <Link href="/historicoDeModificacoes" className="header-link">
            Histórico
          </Link>
        </div>
      </nav>
    </header>
  );
}


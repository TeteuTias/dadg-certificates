"use client";

import Link from "next/link";
import { ChevronDown, Eye, FolderOpen, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./Header.css";

type HeaderMenu = "certificates" | "events" | null;

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const headerMenusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (window.innerWidth <= 768) {
        setIsScrolled(currentScrollY > 100);
      } else {
        setIsScrolled(false);
      }

      setLastScrollY(currentScrollY);
    };

    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [lastScrollY]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!headerMenusRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleMenu = (menu: Exclude<HeaderMenu, null>) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  return (
    <header className={`header-container ${isScrolled ? "header-scrolled" : ""}`}>
      <nav className="header-nav">
        <Link href="/" className="header-logo">
          DADG Certificates
        </Link>

        <div className="header-links" ref={headerMenusRef}>
          <Link href="/" className="header-link">
            Home
          </Link>

          <div className={`header-dropdown ${openMenu === "certificates" ? "is-open" : ""}`}>
            <button
              type="button"
              className="header-link header-dropdown-trigger"
              onClick={() => toggleMenu("certificates")}
            >
              <span>Certificados</span>
              <ChevronDown size={16} className="header-dropdown-chevron" />
            </button>

            {openMenu === "certificates" && (
              <div className="glass-card header-dropdown-menu">
                <Link
                  href="/todosCertificados/allCertificates"
                  className="header-dropdown-link"
                  onClick={() => setOpenMenu(null)}
                >
                  <div className="header-dropdown-icon">
                    <Eye size={16} />
                  </div>
                  <div>
                    <strong>Ver certificados</strong>
                    <span>Abrir a listagem completa</span>
                  </div>
                </Link>

                <Link href="/createCertificate" className="header-dropdown-link" onClick={() => setOpenMenu(null)}>
                  <div className="header-dropdown-icon">
                    <Plus size={16} />
                  </div>
                  <div>
                    <strong>Criar certificado</strong>
                    <span>Escolher evento e emitir</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          <div className={`header-dropdown ${openMenu === "events" ? "is-open" : ""}`}>
            <button
              type="button"
              className="header-link header-dropdown-trigger"
              onClick={() => toggleMenu("events")}
            >
              <span>Eventos</span>
              <ChevronDown size={16} className="header-dropdown-chevron" />
            </button>

            {openMenu === "events" && (
              <div className="glass-card header-dropdown-menu">
                <Link href="/todosEventos" className="header-dropdown-link" onClick={() => setOpenMenu(null)}>
                  <div className="header-dropdown-icon">
                    <FolderOpen size={16} />
                  </div>
                  <div>
                    <strong>Ver eventos</strong>
                    <span>Abrir a listagem de eventos</span>
                  </div>
                </Link>

                <Link href="/criarEvento" className="header-dropdown-link" onClick={() => setOpenMenu(null)}>
                  <div className="header-dropdown-icon">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <strong>Criar evento</strong>
                    <span>Configurar um novo evento</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          <Link href="/historicoDeModificacoes" className="header-link">
            Historico
          </Link>
        </div>
      </nav>
    </header>
  );
}

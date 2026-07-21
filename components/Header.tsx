"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Eye, FolderOpen, Menu, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./Header.css";

type HeaderMenu = "certificates" | "events" | null;

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showSecretPrompt, setShowSecretPrompt] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [secretError, setSecretError] = useState("");
  const headerNavRef = useRef<HTMLElement>(null);
  const secretInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mobileBreakpoint = 768;

    const syncHeaderState = () => {
      const isMobileViewport = window.innerWidth <= mobileBreakpoint;
      setIsScrolled(isMobileViewport && window.scrollY > 24);
    };

    const handleResize = () => {
      if (window.innerWidth > mobileBreakpoint) {
        setIsScrolled(false);
        setIsMobileMenuOpen(false);
        setOpenMenu(null);
      }

      syncHeaderState();
    };

    syncHeaderState();

    window.addEventListener("scroll", syncHeaderState, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", syncHeaderState);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!headerNavRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!showSecretPrompt) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      secretInputRef.current?.focus();
    }, 40);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [showSecretPrompt]);

  const toggleMenu = (menu: Exclude<HeaderMenu, null>) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const toggleMobileMenu = () => {
    if (isMobileMenuOpen) {
      setOpenMenu(null);
    }

    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeNavigation = () => {
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
  };

  const closeSecretPrompt = () => {
    setShowSecretPrompt(false);
    setSecretInput("");
    setSecretError("");
    setLogoClickCount(0);
  };

  const handleLogoClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (showSecretPrompt) {
      event.preventDefault();
      return;
    }

    const nextClickCount = logoClickCount + 1;

    if (nextClickCount >= 5) {
      event.preventDefault();
      setOpenMenu(null);
      setIsMobileMenuOpen(false);
      setLogoClickCount(0);
      setSecretInput("");
      setSecretError("");
      setShowSecretPrompt(true);
      return;
    }

    setLogoClickCount(nextClickCount);
  };

  const handleSecretSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (secretInput.trim().toLowerCase() === "silvio") {
      closeSecretPrompt();
      router.push("/Silvio");
      return;
    }

    setSecretError('Senha incorreta. Tenta "Silvio".');
  };

  return (
    <>
      <header
        className={`header-container ${isScrolled ? "header-scrolled" : ""} ${
          isMobileMenuOpen ? "header-mobile-open" : ""
        }`}
      >
        <nav className="header-nav" ref={headerNavRef}>
          <div className="header-topbar">
            <Link
              href="/"
              className={`header-logo ${logoClickCount >= 3 ? "is-armed" : ""}`}
              onClick={(event) => {
                handleLogoClick(event);
                closeNavigation();
              }}
            >
              DADG Certificates
            </Link>

            <button
              type="button"
              className="header-mobile-toggle"
              onClick={toggleMobileMenu}
              aria-controls="header-navigation"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Fechar menu principal" : "Abrir menu principal"}
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              <span>{isMobileMenuOpen ? "Fechar" : "Menu"}</span>
            </button>
          </div>

          <div
            className={`header-links ${isMobileMenuOpen ? "is-mobile-open" : ""}`}
            id="header-navigation"
          >
            <Link href="/" className="header-link" onClick={closeNavigation}>
              Home
            </Link>

            <div className={`header-dropdown ${openMenu === "certificates" ? "is-open" : ""}`}>
              <button
                type="button"
                className="header-link header-dropdown-trigger"
                onClick={() => toggleMenu("certificates")}
                aria-expanded={openMenu === "certificates"}
              >
                <span>Certificados</span>
                <ChevronDown size={16} className="header-dropdown-chevron" />
              </button>

              {openMenu === "certificates" && (
                <div className="glass-card header-dropdown-menu">
                  <Link
                    href="/todosCertificados/allCertificates"
                    className="header-dropdown-link"
                    onClick={closeNavigation}
                  >
                    <div className="header-dropdown-icon">
                      <Eye size={16} />
                    </div>
                    <div>
                      <strong>Ver certificados</strong>
                      <span>Abrir a listagem completa</span>
                    </div>
                  </Link>

                  <Link
                    href="/createCertificate"
                    className="header-dropdown-link"
                    onClick={closeNavigation}
                  >
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
                aria-expanded={openMenu === "events"}
              >
                <span>Eventos</span>
                <ChevronDown size={16} className="header-dropdown-chevron" />
              </button>

              {openMenu === "events" && (
                <div className="glass-card header-dropdown-menu">
                  <Link href="/todosEventos" className="header-dropdown-link" onClick={closeNavigation}>
                    <div className="header-dropdown-icon">
                      <FolderOpen size={16} />
                    </div>
                    <div>
                      <strong>Ver eventos</strong>
                      <span>Abrir a listagem de eventos</span>
                    </div>
                  </Link>

                  <Link href="/criarEvento" className="header-dropdown-link" onClick={closeNavigation}>
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

            <Link href="/Avisos" className="header-link" onClick={closeNavigation}>
              Avisos
            </Link>

            <Link href="/historicoDeModificacoes" className="header-link" onClick={closeNavigation}>
              Historico
            </Link>
            
            <Link href="/configuracoes" className="header-link" onClick={closeNavigation}>
              Configurações
            </Link>
          </div>
        </nav>
      </header>

      {showSecretPrompt && (
        <div className="header-secret-overlay" onClick={closeSecretPrompt}>
          <div className="glass-card header-secret-modal" onClick={(event) => event.stopPropagation()}>
            <p className="header-secret-kicker">Modo secreto desbloqueado</p>
            <h2 className="header-secret-title">Digite a palavra magica</h2>
            <p className="header-secret-description">
              Se estiver tudo certo, o presidente aparece em grande estilo.
            </p>

            <form className="header-secret-form" onSubmit={handleSecretSubmit}>
              <input
                ref={secretInputRef}
                type="text"
                value={secretInput}
                onChange={(event) => {
                  setSecretInput(event.target.value);
                  if (secretError) {
                    setSecretError("");
                  }
                }}
                className="glass-input header-secret-input"
                placeholder="Digite aqui..."
                autoComplete="off"
                spellCheck={false}
              />

              <div className="header-secret-actions">
                <button type="button" className="glass-button" onClick={closeSecretPrompt}>
                  Fechar
                </button>
                <button type="submit" className="glass-button glass-button-primary">
                  Revelar
                </button>
              </div>
            </form>

            {secretError && <p className="header-secret-error">{secretError}</p>}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, FolderOpen, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./Header.css";

type HeaderMenu = "certificates" | "events" | null;

export default function Header() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showSecretPrompt, setShowSecretPrompt] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [secretError, setSecretError] = useState("");
  const headerMenusRef = useRef<HTMLDivElement>(null);
  const secretInputRef = useRef<HTMLInputElement>(null);

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
      <header className={`header-container ${isScrolled ? "header-scrolled" : ""}`}>
        <nav className="header-nav">
          <Link
            href="/"
            className={`header-logo ${logoClickCount >= 3 ? "is-armed" : ""}`}
            onClick={handleLogoClick}
          >
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

            <Link href="/Avisos" className="header-link">
              Avisos
            </Link>

            <Link href="/historicoDeModificacoes" className="header-link">
              Historico
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

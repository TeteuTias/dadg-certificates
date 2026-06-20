'use client';
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  HeartHandshake,
  Users,
  Plane,
  BadgeCheck,
  Home,
  FileText,
  LayoutGrid,
  Calendar,
  Mail,
  HelpCircle,
  MessageCircle,
  Bell,
  Menu,
  ChevronDown,
  Sun,
  Moon
} from "lucide-react";
import { useTheme } from "next-themes";

export default function MenuDrawer() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [coordenadoriasSubmenuOpen, setCoordenadoriasSubmenuOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState("250px");
  const [mounted, setMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(1024);
  const [hasNotification, setHasNotification] = useState(true);
  const pathname = usePathname() || '/';
  const { theme, setTheme } = useTheme();

  const headerBackgroundColor =
    pathname.startsWith("/coordenadorias/clam")
        ? "#0A7A1A"
        : pathname.startsWith("/coordenadorias/caes")
          ? "#056653"
          : pathname.startsWith("/coordenadorias/caep")
            ? "#000066"
            : pathname.startsWith("/coordenadorias/cac")
              ? "#050a4a"
              : pathname.startsWith("/coordenadorias/clev")
                ? "#526c94"
                : "#002B5B";
  const drawerBackgroundColor = headerBackgroundColor;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth < 768) {
        setDrawerWidth("80%");
      } else {
        setDrawerWidth("250px");
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleCoordenadoriasSubmenu = () => setCoordenadoriasSubmenuOpen((prev) => !prev);

  const coordenadoriasSubmenuItems = [
    {
      label: "CAEP",
      href: "/coordenadorias/caep",
      icon: <BookOpen size={16} />
    },
    {
      label: "CAES",
      href: "/coordenadorias/caes",
      icon: <HeartHandshake size={16} />
    },
    {
      label: "CLAM",
      href: "/coordenadorias/clam",
      icon: <Users size={16} />
    },
    {
      label: "CLEV",
      href: "/coordenadorias/clev",
      icon: <Plane size={16} />
    },
    {
      label: "CAC",
      href: "/coordenadorias/cac",
      icon: <BadgeCheck size={16} />
    }
  ];

  const coordenadoriasSubmenuMaxHeight = coordenadoriasSubmenuOpen
    ? `${coordenadoriasSubmenuItems.length * 40}px`
    : "0px";

  const isMobile = mounted ? windowWidth < 768 : false;
  // Fixed sizes — no shrink on scroll
  const headerHeight = isMobile ? "35px" : "45px";
  const headerFontSize = isMobile ? "12px" : "16px";
  const headerGap = isMobile ? "8px" : "16px";

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.style.setProperty("--dadg-header-height", headerHeight);
  }, [headerHeight, mounted]);

  return (
    <>
      {/* Container with drop-shadow that follows the SVG curve shape */}
      <div
        className="fixed top-0 left-0 w-full z-[1000]"
        style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.25))" }}
      >
        <header
          style={{
            position: "relative",
            width: "100%",
            height: headerHeight,
            backgroundColor: headerBackgroundColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 15px",
            color: "white",
            fontWeight: "bold",
            fontSize: headerFontSize,
            transition: "height 0.3s ease, font-size 0.3s ease, background-color 0.3s ease",
          }}
        >
        {/* Botão Hamburger */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={() => setMenuAberto(true)}
            className="text-white hover:text-blue-200 transition-colors relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10"
          >
            <Menu size={isMobile ? 24 : 26} strokeWidth={2} />
          </button>
        </div>

        {/* Curva SVG (Wave/Dip) contínua */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-[220px] h-[55px] md:w-[280px] md:h-[65px] z-[99]"
          style={{ 
            top: "calc(100% - 1px)", 
            color: headerBackgroundColor,
            transition: "color 0.3s ease" 
          }}
        >
          <svg
            viewBox="0 0 240 60"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <path d="M 0 0 C 60 0 60 60 120 60 C 180 60 180 0 240 0 Z" fill="currentColor" />
          </svg>
        </div>

        {/* Logo Flutuando na Curva */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 top-[2px] md:top-[6px] w-[75px] h-[75px] md:w-[90px] md:h-[90px] z-[100] cursor-pointer hover:scale-105 transition-transform">
          <div className="relative w-full h-full">
            <Image
              src="/dadg_sem_fundo.png"
              alt="Logo DADG"
              fill
              className="object-contain drop-shadow-sm"
              priority
            />
          </div>
        </Link>

        {/* Direita: Links e Notificações */}
        <div style={{ display: "flex", alignItems: "center", gap: headerGap }}>
          {/* Links (Escondido no mobile para não sobrepor o brasão) */}
          <div
            className="hidden md:flex"
            style={{
              justifyContent: "flex-end",
              alignItems: "center",
              gap: headerGap,
              textTransform: "uppercase",
            }}
          >
            <Link href="/coordenadorias" style={{ color: "white", textDecoration: "none", fontSize: headerFontSize, transition: "color 0.2s hover:text-blue-200" }}>
              Coordenadorias
            </Link>
            <Link href="/" style={{ color: "white", textDecoration: "none", fontSize: headerFontSize, transition: "color 0.2s hover:text-blue-200" }}>
              Início
            </Link>
            <Link href="/certificados" style={{ color: "white", textDecoration: "none", fontSize: headerFontSize, transition: "color 0.2s hover:text-blue-200" }}>
              Certificados
            </Link>
          </div>

          {/* Toggle Theme */}
          {mounted && (pathname === '/' || pathname === '/coordenadorias' || pathname === '/certificados') && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-white hover:text-blue-200 transition-colors relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={isMobile ? 18 : 20} /> : <Moon size={isMobile ? 18 : 20} />}
            </button>
          )}

          {/* Sino de Notificação */}
          <button
            onClick={() => {
              window.dispatchEvent(new Event('open-schedule-popup'));
              setHasNotification(false);
            }}
            className="text-white hover:text-blue-200 transition-colors relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10"
            aria-label="Abrir programação"
          >
            <Bell size={isMobile ? 18 : 20} />
            {hasNotification && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full shadow-[0_0_0_2px_rgba(0,43,91,1)]" style={{ boxShadow: `0 0 0 2px ${headerBackgroundColor}` }}></span>
            )}
          </button>
        </div>

        </header>
      </div>


      {/* DrawerMenu */}
      <div
        className="drawerContainer"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: drawerWidth,
          height: "100vh",
          backgroundColor: drawerBackgroundColor,
          color: "white",
          padding: isMobile ? "16px" : "20px",
          paddingTop: isMobile ? "60px" : "80px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? "12px" : "15px",
          zIndex: 1100,
          boxShadow: "2px 0 20px rgba(0, 0, 0, 0.3)",
          transform: menuAberto ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease, background-color 0.5s ease-in-out",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <button
          className="menu-close-button"
          onClick={() => setMenuAberto(false)}
          style={{
            cursor: "pointer",
            alignSelf: "flex-end",
            marginRight: isMobile ? "-5px" : "-10px",
            marginTop: isMobile ? "-5px" : "-10px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: "50%",
            width: isMobile ? "36px" : "40px",
            height: isMobile ? "36px" : "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease"
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "transform 0.3s ease" }}
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="menu-items" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link
            href="/"
            style={{
              color: "white",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : "12px",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              transition: "all 0.3s ease",
              background: pathname === "/" ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }}
            onClick={() => setMenuAberto(false)}
          >
            <Home size={isMobile ? 20 : 24} />
            Início
          </Link>

          <Link
            href="/certificados"
            style={{
              color: "white",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : "12px",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              transition: "all 0.3s ease",
              background: pathname === "/certificados" ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }}
            onClick={() => setMenuAberto(false)}
          >
            <FileText size={isMobile ? 20 : 24} />
            Certificados
          </Link>

          <Link
            href="/mural"
            style={{
              color: "white",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : "12px",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              transition: "all 0.3s ease",
              background: pathname === "/mural" ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }}
            onClick={() => setMenuAberto(false)}
          >
            <LayoutGrid size={isMobile ? 20 : 24} />
            Mural
          </Link>

          <Link
            href="/eventos"
            style={{
              color: "white",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : "12px",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              transition: "all 0.3s ease",
              background: pathname === "/eventos" ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }}
            onClick={() => setMenuAberto(false)}
          >
            <Calendar size={isMobile ? 20 : 24} />
            Eventos
          </Link>

          <Link 
            href="/ouvidoria" 
            style={{ 
              color: "white", 
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : "12px",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              transition: "all 0.3s ease",
              background: pathname === "/ouvidoria" ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }} 
            onClick={() => setMenuAberto(false)}
          >
            <MessageCircle size={isMobile ? 20 : 24} />
            Ouvidoria
          </Link>

          <Link 
            href="/contato" 
            style={{ 
              color: "white", 
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : "12px",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              transition: "all 0.3s ease",
              background: pathname === "/contato" ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }}
            onClick={() => setMenuAberto(false)}
          >
            <Mail size={isMobile ? 20 : 24} />
            Contato
          </Link>

          <Link
            href="/sobre"
            style={{
              color: "white",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : "12px",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              transition: "all 0.3s ease",
              background: pathname === "/sobre" ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }}
            onClick={() => setMenuAberto(false)}
          >
            <HelpCircle size={isMobile ? 20 : 24} />
            Sobre Nós
          </Link>
        </div>

        {/* Submenu para Coordenadorias */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: isMobile ? "10px 14px" : "12px 16px",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.3s ease",
              background: coordenadoriasSubmenuOpen ? "rgba(255, 255, 255, 0.1)" : "transparent",
              fontSize: isMobile ? "14px" : "16px"
            }}
            onClick={toggleCoordenadoriasSubmenu}
          >
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "12px" }}>
              <Users size={isMobile ? 20 : 24} />
              <span>Coordenadorias</span>
            </div>
            <ChevronDown
              size={isMobile ? 18 : 20}
              style={{
                transform: coordenadoriasSubmenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease"
              }}
            />
          </div>
          <div
            style={{
              marginLeft: "15px",
              overflow: "hidden",
              transition: "max-height 0.3s ease",
              maxHeight: coordenadoriasSubmenuMaxHeight,
            }}
          >
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              maxHeight: "200px",
              overflowY: "auto",
              paddingRight: "8px"
            }} className="drawer-submenu-content">
              {coordenadoriasSubmenuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    color: "white",
                    textDecoration: "none",
                    padding: isMobile ? "8px 14px" : "10px 16px",
                    borderRadius: "8px",
                    transition: "all 0.3s ease",
                    background: pathname === item.href ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: isMobile ? "8px" : "8px",
                    minHeight: isMobile ? "36px" : "40px",
                    fontSize: isMobile ? "13px" : "14px"
                  }}
                  onClick={() => setMenuAberto(false)}
                >
                  {React.cloneElement(item.icon, { size: isMobile ? 16 : 16 })}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

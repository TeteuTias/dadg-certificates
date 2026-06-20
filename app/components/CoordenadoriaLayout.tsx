"use client";
import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export type ThemeColor = 'blue' | 'green' | 'teal' | 'indigo' | 'slate' | 'red';

interface CoordenadoriaLayoutProps {
  acronym: string;
  title: string;
  description: string;
  logoSrc: string;
  themeColor?: ThemeColor;
  quickLinks?: { label: string; href: string }[];
  children: React.ReactNode;
}

const themeColors = {
  blue: {
    bg: 'bg-slate-50 dark:bg-[#001021]',
    text: 'text-blue-700 dark:text-blue-300',
    hoverText: 'hover:text-blue-800 dark:hover:text-white',
    border: 'border-blue-200 dark:border-white/10',
    borderHover: 'hover:border-blue-200 dark:hover:border-blue-800',
    shadow: 'shadow-blue-900/10 dark:shadow-none',
    radial: 'bg-[radial-gradient(#002B5B_1px,transparent_1px)] dark:bg-[radial-gradient(#002B5B_1px,transparent_1px)]',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-[#001a09]',
    text: 'text-emerald-700 dark:text-emerald-300',
    hoverText: 'hover:text-emerald-800 dark:hover:text-white',
    border: 'border-emerald-200 dark:border-white/10',
    borderHover: 'hover:border-emerald-200 dark:hover:border-emerald-800',
    shadow: 'shadow-emerald-900/10 dark:shadow-none',
    radial: 'bg-[radial-gradient(#064e3b_1px,transparent_1px)] dark:bg-[radial-gradient(#064e3b_1px,transparent_1px)]',
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-[#00181c]',
    text: 'text-teal-700 dark:text-teal-300',
    hoverText: 'hover:text-teal-800 dark:hover:text-white',
    border: 'border-teal-200 dark:border-white/10',
    borderHover: 'hover:border-teal-200 dark:hover:border-teal-800',
    shadow: 'shadow-teal-900/10 dark:shadow-none',
    radial: 'bg-[radial-gradient(#134e4a_1px,transparent_1px)] dark:bg-[radial-gradient(#134e4a_1px,transparent_1px)]',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-[#0a0021]',
    text: 'text-indigo-700 dark:text-indigo-300',
    hoverText: 'hover:text-indigo-800 dark:hover:text-white',
    border: 'border-indigo-200 dark:border-white/10',
    borderHover: 'hover:border-indigo-200 dark:hover:border-indigo-800',
    shadow: 'shadow-indigo-900/10 dark:shadow-none',
    radial: 'bg-[radial-gradient(#312e81_1px,transparent_1px)] dark:bg-[radial-gradient(#312e81_1px,transparent_1px)]',
  },
  red: {
    bg: 'bg-red-50 dark:bg-[#210000]',
    text: 'text-red-700 dark:text-red-300',
    hoverText: 'hover:text-red-800 dark:hover:text-white',
    border: 'border-red-200 dark:border-white/10',
    borderHover: 'hover:border-red-200 dark:hover:border-red-800',
    shadow: 'shadow-red-900/10 dark:shadow-none',
    radial: 'bg-[radial-gradient(#7f1d1d_1px,transparent_1px)] dark:bg-[radial-gradient(#7f1d1d_1px,transparent_1px)]',
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-[#0f172a]',
    text: 'text-slate-700 dark:text-slate-300',
    hoverText: 'hover:text-slate-800 dark:hover:text-white',
    border: 'border-slate-300 dark:border-white/10',
    borderHover: 'hover:border-slate-300 dark:hover:border-slate-700',
    shadow: 'shadow-slate-900/10 dark:shadow-none',
    radial: 'bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)]',
  }
};

export function CoordenadoriaLayout({
  acronym,
  title,
  description,
  logoSrc,
  themeColor = 'blue',
  quickLinks = [],
  children
}: CoordenadoriaLayoutProps) {
  const theme = themeColors[themeColor];

  return (
    <main className={`min-h-screen transition-colors duration-500 pt-32 pb-20 ${theme.bg}`}>
      <div className={`absolute inset-0 ${theme.radial} [background-size:24px_24px] pointer-events-none transition-opacity duration-500 opacity-[0.03] dark:opacity-20`} />
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        
        <Link href="/coordenadorias" className={`inline-flex items-center gap-2 mb-8 font-medium transition-colors ${theme.text} ${theme.hoverText}`}>
          <ChevronLeft className="w-4 h-4" />
          Voltar para Coordenadorias
        </Link>

        {/* Header da Coordenadoria */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-16 text-center md:text-left"
        >
          <div className={`relative w-48 h-48 rounded-full flex-shrink-0 p-1.5 shadow-2xl transition-all duration-500 overflow-hidden flex items-center justify-center bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-400 dark:from-blue-600 dark:via-emerald-500 dark:to-indigo-500`}>
            {/* Spinning Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-400 dark:from-blue-600 dark:via-emerald-500 dark:to-indigo-500 animate-[spin_6s_linear_infinite]" />
            {/* Inner background */}
            <div className="absolute inset-1.5 bg-white dark:bg-slate-900 rounded-full z-10" />
            {/* Logo Image */}
            <div className="relative z-20 w-full h-full rounded-full overflow-hidden">
              <Image 
                src={logoSrc} 
                alt={`Logo ${acronym}`} 
                fill
                className="object-cover p-1" 
              />
            </div>
          </div>
          
          <div className="mt-4">
            <h1 className="text-5xl md:text-7xl font-bold font-serif mb-4 transition-colors duration-500 text-slate-900 dark:text-white">
              {acronym}
            </h1>
            <h2 className={`text-xl md:text-2xl font-medium mb-4 tracking-wide uppercase transition-colors duration-500 ${theme.text}`}>
              {title}
            </h2>
            <p className="text-lg md:text-xl transition-colors duration-500 max-w-2xl leading-relaxed text-slate-600 dark:text-blue-100/70">
              {description}
            </p>
          </div>
        </motion.div>

        {quickLinks.length > 0 && (
          <nav
            aria-label="Navegacao rapida"
            className="sticky top-20 z-30 mb-10 -mx-6 px-6 py-3 backdrop-blur-xl bg-white/80 dark:bg-slate-950/75 border-y border-white/70 dark:border-white/10 shadow-sm"
          >
            <div className="flex gap-3 overflow-x-auto pb-1 md:justify-center">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 bg-white/80 dark:bg-white/5 ${theme.text} ${theme.border} ${theme.hoverText} hover:-translate-y-0.5 hover:bg-white dark:hover:bg-white/10`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* Content Inject */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-8"
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, { themeColor });
            }
            return child;
          })}
        </motion.div>
      </div>
    </main>
  );
}

export function ContentSection({ id, title, themeColor = 'blue', children }: { id?: string, title: string, themeColor?: ThemeColor, children: React.ReactNode }) {
  const theme = themeColors[themeColor];

  return (
    <section id={id} className={`scroll-mt-36 p-8 md:p-10 rounded-[2rem] backdrop-blur-md transition-all duration-500 bg-white/60 dark:bg-white/[0.04] border border-white/50 dark:border-white/10 ${theme.borderHover} ${theme.shadow}`}>
      <h3 className="text-2xl md:text-3xl font-bold font-serif mb-6 transition-colors duration-500 text-slate-900 dark:text-white">{title}</h3>
      <div className="text-lg leading-relaxed transition-colors duration-500 text-slate-700 dark:text-blue-100/80">
        {children}
      </div>
    </section>
  );
}

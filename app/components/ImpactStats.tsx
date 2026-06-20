"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { FileText, Grid, CalendarDays } from "lucide-react";

interface StatItem {
  prefix?: string;
  value: number;
  suffix?: string;
  label: string;
  description: string;
}

const defaultStats: StatItem[] = [
  {
    prefix: "+",
    value: 0,
    label: "Alunos Representados",
    description: "Vozes unidas em prol da excelência acadêmica",
  },
  {
    prefix: "+",
    value: 0,
    label: "Eventos Realizados",
    description: "Simpósios, workshops e congressos organizados",
  },
  {
    value: 0,
    label: "Ligas Acadêmicas Ativas",
    description: "Grupos focados em ensino, pesquisa e extensão",
  },
  {
    prefix: "+",
    value: 0,
    label: "Certificados Emitidos",
    description: "Reconhecimentos entregues à nossa comunidade",
  },
];

function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, value, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1], // expo out — fast start, satisfying settle
      onUpdate(latest) {
        if (ref.current) {
          ref.current.textContent = prefix + Math.round(latest).toLocaleString("pt-BR") + suffix;
        }
      },
    });
    return () => controls.stop();
  }, [inView, value, prefix, suffix]);

  return (
    <span ref={ref} aria-label={`${prefix}${value}${suffix}`}>
      {prefix}0{suffix}
    </span>
  );
}

export default function ImpactStats() {
  const [stats, setStats] = useState<StatItem[]>(defaultStats);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/get/homeStats');
        if (response.ok) {
          const data = await response.json();
          setStats([
            {
              prefix: "+",
              value: data.alunosRepresentados || 500,
              label: "Alunos Representados",
              description: "Vozes unidas em prol da excelência acadêmica",
            },
            {
              prefix: "+",
              value: data.eventosRealizados || 40,
              label: "Eventos Realizados",
              description: "Simpósios, workshops e congressos organizados",
            },
            {
              value: data.coordenadoriasAtivas || 6,
              label: "Coordenadorias Ativas",
              description: "Departamentos dedicados ao desenvolvimento estudantil",
            },
            {
              prefix: "+",
              value: data.certificadosEmitidos || 2000,
              label: "Certificados Emitidos",
              description: "Reconhecimentos entregues à nossa comunidade",
            },
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch home stats', error);
      }
    }
    
    fetchStats();
  }, []);

  return (
    <section
      aria-label="Números e impacto do DADG IMEPAC"
      className="relative z-10 w-full bg-[#002B5B] py-24 px-6 overflow-hidden"
    >
      {/* Subtle radial glow background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(59,130,246,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto">
        {/* Quick-access cards prominently styled */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
          }}
          className="mb-24 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8"
        >
          {[
            {
              href: "/certificados",
              label: "Certificados",
              desc: "Baixe seus certificados de eventos e ligas acadêmicas.",
              cta: "Acessar",
              icon: <FileText className="w-8 h-8" />,
            },
            {
              href: "/coordenadorias",
              label: "Coordenadorias",
              desc: "Conheça nossos departamentos e projetos de extensão.",
              cta: "Explorar",
              icon: <Grid className="w-8 h-8" />,
            },
            {
              href: "/eventos",
              label: "Eventos",
              desc: "Simpósios, workshops e congressos do nosso curso.",
              cta: "Programação",
              icon: <CalendarDays className="w-8 h-8" />,
            },
          ].map(({ href, label, desc, cta, icon }) => (
            <motion.a
              key={href}
              href={href}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
              }}
              className="group relative flex flex-col text-left p-8 rounded-3xl
                         bg-white/[0.04] hover:bg-white/[0.08]
                         border border-white/10 hover:border-white/25
                         shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.3)]
                         backdrop-blur-md
                         hover:-translate-y-2 transition-all duration-500 overflow-hidden"
            >
              {/* Decorative background glow for hover */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-400 rounded-full blur-[40px] opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" />
              
              <div className="text-white mb-5 p-3 bg-white/5 border border-white/10 rounded-2xl w-fit group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 shadow-inner">
                {icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-serif">{label}</h3>
              <p className="text-blue-100/70 text-sm leading-relaxed flex-grow">{desc}</p>
              
              <div className="flex items-center gap-2 mt-6 text-white font-bold text-xs uppercase tracking-wider transition-colors group-hover:text-blue-200">
                {cta}
                <svg className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <p className="text-blue-300 text-sm font-semibold uppercase tracking-[0.2em] mb-3">
            Nosso Impacto
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif">
            Números que falam por nós
          </h2>
        </motion.div>

        <motion.dl 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
              }}
              className="flex flex-col items-center text-center px-2"
            >
              <dt className="order-2 text-blue-200/80 text-sm md:text-base leading-snug mt-4 font-medium">
                {stat.label}
              </dt>
              <dd className="order-1 text-4xl sm:text-5xl md:text-5xl lg:text-6xl font-bold text-white tabular-nums leading-none drop-shadow-lg">
                <AnimatedCounter
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                />
              </dd>
              <p className="order-3 text-blue-300/60 text-xs leading-relaxed mt-2 hidden md:block">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </motion.dl>

      </div>

    </section>
  );
}


'use client'

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import * as Accordion from "@radix-ui/react-accordion";
import { Search, Loader2, FileCheck2, Fingerprint, ChevronDown } from "lucide-react";
import { ICertificate } from "../lib/models/CertificateModel";
import { useTheme } from "next-themes";

function Loader({ isDark }: { isDark: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  
  if (!mounted) return null;
  
  return ReactDOM.createPortal(
    <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 transition-colors duration-500 ${isDark ? 'bg-[#001021]/80' : 'bg-white/80'}`}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className={`w-12 h-12 animate-spin transition-colors duration-500 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        <span className={`font-medium tracking-widest uppercase text-sm transition-colors duration-500 ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>Buscando...</span>
      </div>
    </div>,
    document.body
  );
}

function SearchInterface({ isDark }: { isDark: boolean }) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [data, setData] = useState<ICertificate[]>([]);

  useEffect(() => {
    const savedSearch = localStorage.getItem('certificateSearch');
    const savedResults = localStorage.getItem('certificateResults');

    if (savedSearch) setInputValue(savedSearch);

    if (savedResults) {
      try {
        const parsedResults = JSON.parse(savedResults);
        setData(parsedResults);
      } catch (e) {
        // Ignora erro de parsing
      }
    }
  }, []);

  const handleSearch = async () => {
    if (!inputValue.trim()) return;
    
    setData([]);
    setIsLoading(true);
    setNoResults(false);

    try {
      const response = await fetch(`/api/get/myCertificate/${inputValue}`);
      const result: { data: ICertificate[] } = await response.json();

      if (!response.ok || result.data.length === 0) {
        setNoResults(true);
        localStorage.removeItem('certificateSearch');
        localStorage.removeItem('certificateResults');
      } else {
        setData(result.data);
        localStorage.setItem('certificateSearch', inputValue);
        localStorage.setItem('certificateResults', JSON.stringify(result.data));
      }
    } catch {
      setNoResults(true);
      localStorage.removeItem('certificateSearch');
      localStorage.removeItem('certificateResults');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center max-w-3xl mx-auto">
      {/* Barra de Pesquisa */}
      <div className="relative w-full group mb-10">
        <div className={`absolute -inset-1 bg-gradient-to-r ${isDark ? 'from-blue-500 to-blue-300' : 'from-blue-400 to-blue-600'} rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500`}></div>
        <div className={`relative flex items-center backdrop-blur-xl border rounded-2xl p-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-colors duration-500 ${isDark ? 'bg-[#00152b]/90 border-white/20' : 'bg-white/90 border-blue-200/50'}`}>
          <div className={`pl-4 pr-2 transition-colors duration-500 ${isDark ? 'text-blue-300/70' : 'text-blue-500/70'}`}>
            <Fingerprint className="w-6 h-6" />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className={`flex-1 bg-transparent border-none text-lg sm:text-xl focus:outline-none focus:ring-0 py-4 px-2 transition-colors duration-500 ${isDark ? 'text-white placeholder-blue-200/40' : 'text-slate-900 placeholder-slate-400'}`}
            placeholder="Digite o Nome, CPF ou Código..."
          />
          <button
            onClick={handleSearch}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-xl font-bold transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)]"
          >
            <Search className="w-5 h-5" />
            <span className="hidden sm:block">Buscar</span>
          </button>
        </div>
      </div>

      {isLoading && <Loader isDark={isDark} />}

      {/* Resultados */}
      <AnimatePresence mode="wait">
        {noResults && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`w-full p-6 text-center rounded-2xl border backdrop-blur-md transition-colors duration-500 ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}
          >
            <p className={`font-medium text-lg transition-colors duration-500 ${isDark ? 'text-red-200' : 'text-red-600'}`}>Nenhum certificado encontrado para "{inputValue}".</p>
          </motion.div>
        )}

        {!noResults && data.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full grid grid-cols-1 gap-4"
          >
            <div className="text-left mb-2 px-2">
              <span className={`text-sm font-semibold uppercase tracking-widest transition-colors duration-500 ${isDark ? 'text-blue-300/80' : 'text-blue-700/80'}`}>
                {data.length} {data.length === 1 ? 'Certificado Encontrado' : 'Certificados Encontrados'}
              </span>
            </div>
            
            {data.map((certificate, i) => (
              <motion.div
                key={String(certificate._id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group relative"
              >
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${isDark ? 'from-blue-400/20' : 'from-blue-600/20'} to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-300`}></div>
                <Link
                  prefetch={true}
                  href={`/certificados/meuCertificado/${String(certificate._id)}`}
                  className={`relative block p-6 rounded-2xl backdrop-blur-md border transition-all duration-300 overflow-hidden ${isDark ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 hover:border-white/25' : 'bg-white/60 hover:bg-white border-blue-100 hover:border-blue-300 shadow-sm'}`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl shrink-0 transition-colors duration-500 ${isDark ? 'bg-blue-500/10' : 'bg-blue-100'}`}>
                        <FileCheck2 className={`w-8 h-8 transition-colors duration-500 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold font-serif leading-tight mb-2 pr-4 transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {certificate.eventName}
                        </h3>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          <div>
                            <p className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 transition-colors duration-500 ${isDark ? 'text-blue-300/60' : 'text-blue-500/80'}`}>Titular</p>
                            <p className={`text-sm transition-colors duration-500 ${isDark ? 'text-blue-100' : 'text-slate-700'}`}>{certificate.ownerName}</p>
                          </div>
                          <div>
                            <p className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 transition-colors duration-500 ${isDark ? 'text-blue-300/60' : 'text-blue-500/80'}`}>Código</p>
                            <p className={`text-sm font-mono transition-colors duration-500 ${isDark ? 'text-blue-200/80' : 'text-slate-600'}`}>{String(certificate._id)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 sm:ml-auto w-full sm:w-auto">
                      <div className={`w-full sm:w-auto text-center px-4 py-2 text-sm font-bold rounded-lg border transition-colors ${isDark ? 'bg-blue-500/20 text-blue-200 border-blue-400/20 group-hover:bg-blue-600 group-hover:text-white' : 'bg-blue-100 text-blue-700 border-blue-200 group-hover:bg-blue-600 group-hover:text-white'}`}>
                        Visualizar
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CertificateFAQ({ isDark }: { isDark: boolean }) {
  const faqs = [
    {
      value: "nao-encontrado",
      question: "Meu certificado nÃ£o foi encontrado. O que fazer?",
      answer: (
        <>
          Verifique se o nome, CPF ou cÃ³digo foi digitado sem erros. Se vocÃª participou do evento recentemente, aguarde a disponibilizaÃ§Ã£o pela organizaÃ§Ã£o. Caso o problema continue, envie sua solicitaÃ§Ã£o pela{" "}
          <Link href="/ouvidoria" className={`font-semibold underline underline-offset-4 transition-colors ${isDark ? 'text-blue-200 hover:text-white' : 'text-blue-700 hover:text-blue-900'}`}>
            Ouvidoria
          </Link>
          .
        </>
      ),
    },
    {
      value: "baixar",
      question: "Como baixar meu certificado?",
      answer:
        "Depois de localizar seu certificado, clique em Visualizar. Na pÃ¡gina do certificado, use a opÃ§Ã£o de download para salvar o arquivo no seu dispositivo.",
    },
    {
      value: "nome-errado",
      question: "Meu nome estÃ¡ errado no certificado. Como corrigir?",
      answer:
        "Confira se vocÃª buscou pelo certificado correto. Se o erro estiver no documento emitido, solicite a correÃ§Ã£o informando seu nome completo, evento e cÃ³digo do certificado.",
    },
    {
      value: "codigo-verificador",
      question: "Onde encontro o cÃ³digo verificador?",
      answer:
        "O cÃ³digo verificador aparece nos dados do certificado e tambÃ©m pode ser usado na busca desta pÃ¡gina. Ele confirma a autenticidade do documento emitido pelo DADG.",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 w-full px-4 sm:px-6 mt-16"
      aria-labelledby="certificados-faq-title"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] mb-3 transition-colors duration-500 ${isDark ? 'text-blue-300/70' : 'text-blue-700/70'}`}>
            DÃºvidas frequentes
          </p>
          <h2 id="certificados-faq-title" className={`text-3xl sm:text-4xl font-bold font-serif transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Ajuda com certificados
          </h2>
        </div>

        <Accordion.Root
          type="single"
          collapsible
          className={`rounded-2xl border backdrop-blur-md overflow-hidden transition-colors duration-500 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white/70 border-blue-100 shadow-sm'}`}
        >
          {faqs.map((faq) => (
            <Accordion.Item key={faq.value} value={faq.value} className={`border-b last:border-b-0 transition-colors duration-500 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <Accordion.Header>
                <Accordion.Trigger className={`group flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors duration-300 ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-blue-50/70'}`}>
                  <span className={`text-base sm:text-lg font-semibold leading-snug transition-colors duration-300 ${isDark ? 'text-white group-hover:text-blue-200' : 'text-slate-900 group-hover:text-blue-700'}`}>
                    {faq.question}
                  </span>
                  <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180 ${isDark ? 'text-blue-300' : 'text-blue-700'}`} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className={`px-5 pb-5 pr-12 text-sm sm:text-base leading-relaxed transition-colors duration-300 ${isDark ? 'text-blue-100/75' : 'text-slate-600'}`}>
                  {faq.answer}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </motion.section>
  );
}

export default function CertificadosPage() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== 'light' : true;

  return (
    <main className={`min-h-screen flex flex-col pt-24 pb-20 overflow-x-hidden transition-colors duration-500 ${isDark ? 'bg-[#001021]' : 'bg-gray-50'}`}>
      {/* Background elements */}
      <div className={`absolute inset-0 bg-gradient-to-b ${isDark ? 'from-[#002B5B]/60' : 'from-blue-200/40'} to-transparent pointer-events-none transition-colors duration-500`} />
      <div className={`absolute inset-0 bg-[linear-gradient(to_right,${isDark ? '#ffffff05' : '#0000000a'}_1px,transparent_1px),linear-gradient(to_bottom,${isDark ? '#ffffff05' : '#0000000a'}_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none transition-colors duration-500`} />
      
      {/* Centralized Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center mt-10 mb-12"
      >
        <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold mb-6 font-serif tracking-tight drop-shadow-md transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Validação de Certificados
        </h1>
        <p className={`text-lg md:text-xl font-light leading-relaxed max-w-2xl mx-auto transition-colors duration-500 ${isDark ? 'text-blue-100/80' : 'text-slate-700'}`}>
          Acesse rapidamente seus certificados de participação em simpósios, ligas acadêmicas e eventos apoiados pelo DADG.
        </p>
      </motion.div>

      {/* Search Interface */}
      <section className="relative z-10 flex-grow px-4 sm:px-6 w-full">
        <SearchInterface isDark={isDark} />
      </section>

      <CertificateFAQ isDark={isDark} />
    </main>
  );
}

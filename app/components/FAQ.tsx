"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useTheme } from "next-themes";

const faqs = [
  {
    question: "O que é o DADG e quem ele representa?",
    answer:
      "O Diretório Acadêmico Diogo Guimarães (DADG) é a entidade de representação oficial dos estudantes de Medicina da IMEPAC Araguari. Atuamos como a ponte entre os alunos e a instituição, defendendo os interesses discentes, promovendo eventos acadêmicos e fomentando a vida universitária.",
  },
  {
    question: "Como faço para baixar meu certificado de participação?",
    answer:
      "Acesse a seção \"Certificados\" no menu superior ou clique no card de acesso rápido na página inicial. Você precisará inserir seu CPF ou e-mail cadastrado para localizar seus certificados. Em caso de problemas, entre em contato pelo nosso e-mail ou via ouvidoria.",
  },
  {
    question: "Como posso participar de uma coordenadoria do DADG?",
    answer:
      "As coordenadorias do DADG realizam processos seletivos periódicos, divulgados em nossas redes sociais e no site. Acesse a seção \"Coordenadorias\" para conhecer cada departamento e fique atento aos editais de seleção. Qualquer aluno regularmente matriculado pode se candidatar.",
  },
  {
    question: "O que é a Ouvidoria e quando devo utilizá-la?",
    answer:
      "A Ouvidoria é um canal confidencial para que você envie sugestões, reclamações, elogios ou denúncias relacionadas à vida acadêmica, à instituição ou ao próprio DADG. Utilize-a sempre que precisar de uma escuta imparcial ou quando outros canais não resolverem sua demanda.",
  },
  {
    question: "Onde posso acompanhar a agenda de eventos e simpósios?",
    answer:
      "A programação completa está disponível na seção \"Eventos\" do site e também é divulgada no nosso Instagram (@dadg.imepac). Você pode se inscrever nos eventos diretamente pela plataforma e, após sua participação, o certificado ficará disponível automaticamente.",
  },
  {
    question: "Como o DADG apoia o bem-estar dos estudantes?",
    answer:
      "Temos uma coordenadoria dedicada à Saúde Mental e Bem-Estar, que promove rodas de conversa, acompanhamento psicológico em parceria com a instituição, e campanhas de conscientização ao longo do ano. Também atuamos na mediação de conflitos entre alunos e a coordenação do curso.",
  },
];

function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== 'light' : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
    >
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span className={`text-base sm:text-lg font-semibold transition-colors duration-300 leading-snug ${isDark ? 'text-white group-hover:text-blue-300' : 'text-[#002B5B] group-hover:text-blue-700'}`}>
          {question}
        </span>
        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${isDark ? 'bg-blue-500/10 group-hover:bg-blue-500/20' : 'bg-[#002B5B]/8 group-hover:bg-[#002B5B]/15'}`}>
          {open ? (
            <Minus className={`w-4 h-4 transition-colors duration-300 ${isDark ? 'text-blue-300' : 'text-[#002B5B]'}`} />
          ) : (
            <Plus className={`w-4 h-4 transition-colors duration-300 ${isDark ? 'text-blue-300' : 'text-[#002B5B]'}`} />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className={`pb-5 leading-relaxed text-sm sm:text-base pr-12 transition-colors duration-300 ${isDark ? 'text-blue-100/70' : 'text-gray-600'}`}>
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`border-b transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-slate-200'}`} />
    </motion.div>
  );
}

export default function FAQ() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== 'light' : true;

  return (
    <section
      aria-label="Perguntas Frequentes"
      className={`relative z-10 w-full pt-24 pb-12 sm:pt-32 sm:pb-16 px-6 transition-colors duration-500 ${isDark ? 'bg-[#00152b]' : 'bg-[#F8FAFC]'}`}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] mb-3 transition-colors duration-500 ${isDark ? 'text-blue-400/80' : 'text-[#002B5B]/50'}`}>
            Tire suas dúvidas
          </p>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold font-serif transition-colors duration-500 ${isDark ? 'text-white' : 'text-[#002B5B]'}`}>
            Perguntas Frequentes
          </h2>
          <p className={`mt-4 text-lg max-w-xl mx-auto transition-colors duration-500 ${isDark ? 'text-blue-100/70' : 'text-gray-500'}`}>
            Tudo o que você precisa saber sobre o DADG, eventos, certificados e muito mais.
          </p>
        </motion.div>

        {/* Divider top */}
        <div className={`border-b mb-0 transition-colors duration-500 ${isDark ? 'border-white/10' : 'border-slate-200'}`} />

        {/* FAQ Items */}
        <div>
          {faqs.map((faq, i) => (
            <FAQItem key={i} {...faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

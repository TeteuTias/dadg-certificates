"use client";

import React, { useEffect, useState } from "react";
import Typewriter from "@/app/components/TypeWriter";
import WaveAnimation from "@/app/components/WaveComponent";
import { useTheme } from "next-themes";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function Page() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== "light" : true;

  return (
    <div className={`relative flex flex-col items-center justify-center min-h-screen w-full p-8 overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#001021]' : 'bg-slate-50'}`}>
      <div className={`absolute inset-0 bg-[radial-gradient(#002B5B_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-0' : 'opacity-[0.03]'}`} />

      <div className="absolute top-24 left-8 z-20">
        <Link href="/coordenadorias" className={`inline-flex items-center gap-2 font-medium transition-colors ${isDark ? 'text-blue-300 hover:text-white' : 'text-blue-600 hover:text-[#002B5B]'}`}>
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>
      </div>

      <h1 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-wide relative z-10 transition-colors duration-500 ${isDark ? 'text-white' : 'text-[#09427d]'}`}>
        <Typewriter text="EM BREVE" speed={100} />
      </h1>
      
      {isDark ? (
        <div className="opacity-50 mix-blend-screen w-full absolute bottom-0 left-0 right-0 h-[40vh] overflow-hidden pointer-events-none flex items-end">
          <WaveAnimation />
        </div>
      ) : (
        <div className="opacity-80 w-full absolute bottom-0 left-0 right-0 h-[40vh] overflow-hidden pointer-events-none flex items-end mix-blend-multiply">
          <WaveAnimation />
        </div>
      )}
    </div>
  );
}
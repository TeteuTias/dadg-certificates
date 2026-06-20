"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Users, Calendar } from "lucide-react";

const navItems = [
  {
    href: "/certificados",
    label: "Certificados",
    icon: Award,
  },
  {
    href: "/coordenadorias",
    label: "Coordenadorias",
    icon: Users,
  },
  {
    href: "/eventos",
    label: "Eventos",
    icon: Calendar,
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed bottom-0 left-0 right-0 z-[1002] md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-2px_16px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                className={`flex flex-col items-center justify-center gap-1 py-3 w-full transition-colors duration-200 ${
                  isActive
                    ? "text-[#002B5B]"
                    : "text-slate-400 hover:text-[#002B5B]"
                }`}
              >
                <span className="relative">
                  <Icon
                    className={`w-6 h-6 transition-transform duration-200 ${
                      isActive ? "scale-110" : ""
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#002B5B]" />
                  )}
                </span>
                <span className="text-[10px] font-medium tracking-wide">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

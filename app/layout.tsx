import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { auth0 } from "@/lib/auth0";
import { staffRole } from "@/lib/security/isAdmin";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "@dadg.imepac",
  description: "Plataforma desenvolvida pelo DADG",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // O cabeçalho mostra só o que o papel da sessão pode acessar; a autorização
  // de cada rota continua sendo aplicada no proxy e nos handlers.
  const session = await auth0.getSession().catch(() => null);
  const role = staffRole(session?.user ?? null);

  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <Header role={role} />
        {children}
      </body>
    </html>
  );
}

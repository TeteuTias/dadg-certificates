import type { Metadata } from "next";
import { UserProvider } from "@/lib/userProvider";
import "./globals.css";
import MenuDrawer from "./components/MenuDrawer";
import { auth0 } from "@/app/src/lib/auth0/Auth0Client"
import Preloader from "@/components/Preloader";
import { Inter, Playfair_Display } from "next/font/google";
import CustomCursor from "./components/CustomCursor";
import MobileBottomNav from "./components/MobileBottomNav";
import { ThemeProvider } from "./components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const SITE_URL = "https://dadg.imepac.edu.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DADG IMEPAC | Diretório Acadêmico Diogo Guimarães",
    template: "%s | DADG IMEPAC",
  },
  description:
    "O Diretório Acadêmico Diogo Guimarães é a representação oficial dos estudantes de Medicina da IMEPAC Araguari. Coordenadorias, eventos, certificados e liderança estudantil em um só lugar.",
  keywords: [
    "DADG",
    "IMEPAC",
    "Diretório Acadêmico",
    "Medicina Araguari",
    "Estudantes de Medicina",
    "Diogo Guimarães",
    "CAEP",
    "CAES",
    "CLAM",
    "CLEV",
    "CAC",
  ],
  icons: { icon: "/favicon_blue.png" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "DADG IMEPAC",
    title: "DADG IMEPAC | Diretório Acadêmico Diogo Guimarães",
    description:
      "Representação oficial dos estudantes de Medicina da IMEPAC Araguari. Conheça nossas coordenadorias, eventos e conquistas.",
    images: [
      {
        url: "/imepac-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Campus IMEPAC Araguari — Diretório Acadêmico Diogo Guimarães",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DADG IMEPAC | Diretório Acadêmico Diogo Guimarães",
    description:
      "Representação oficial dos estudantes de Medicina da IMEPAC Araguari.",
    images: ["/imepac-hero.jpg"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession()
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <CustomCursor />
          <Preloader />
          {/* Componente Client que contém a interatividade */}
          <MenuDrawer />
          {/* Bottom nav mobile */}
          <MobileBottomNav />
          <div className="main-content pb-16 md:pb-0">
            <UserProvider tokenVar={session?.tokenSet.idToken || undefined}>
              {children}
            </UserProvider>
          </div>
          <script dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('contextmenu', event => event.preventDefault());
              document.addEventListener('dragstart', event => {
                if (event.target.nodeName === 'IMG') event.preventDefault();
              });
            `
          }} />
        </ThemeProvider>
      </body>
    </html>
  );
}

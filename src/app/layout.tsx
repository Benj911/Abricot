import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

// Configuration des polices optimisées pour les Web Vitals (display: "swap" évite les flashs de texte invisible)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Métadonnées SEO et d'accessibilité (titre lu en premier par les lecteurs d'écran)
export const metadata: Metadata = {
  title: "Abricot.co - Gestion de projet IA",
  description: "Outil SaaS de gestion de projet innovant pour freelances",
};

/**
 * Root Layout (Composant Racine)
 * Socle structurel de l'application. Ne contient pas d'UI métier (Header/Footer),
 * mais initialise le document HTML, la langue, l'antialiasing et les variables CSS globales (polices).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="fr" // Indispensable pour l'accessibilité (reconnaissance vocale et lecteurs d'écran)
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
    >
      {/* Remplacement des anciennes variables CSS par les valeurs hexadécimales 
        conformément aux standards du projet (Design en dur).
      */}
      <body className="min-h-full flex flex-col bg-[#FAFAFA] text-[#1E1E1E]">
        {children}
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { ClaraAssistant } from "@/components/ui/clara-assistant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deuda Clara RD | Tu Asistente Financiera",
  description: "La plataforma #1 en República Dominicana para organizar deudas, crear estrategias de pago y alcanzar tu libertad financiera. Con Clara, tu IA experta.",
  keywords: ["deudas", "finanzas", "república dominicana", "ahorro", "inversión", "claro", "qik"],
  authors: [{ name: "Deuda Clara RD" }],
  openGraph: {
    title: "Deuda Clara RD",
    description: "Toma el control de tus finanzas hoy mismo.",
    type: "website",
    locale: "es_DO",
    siteName: "Deuda Clara RD",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deuda Clara RD",
    description: "Tu asistente financiera inteligente.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Deuda Clara",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}>
        <Providers>
          {children}
          <ClaraAssistant />
        </Providers>
      </body>
    </html>
  );
}

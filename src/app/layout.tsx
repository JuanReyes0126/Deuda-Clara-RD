import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/layout/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Deuda Clara RD",
    template: "%s | Deuda Clara RD",
  },
  description:
    "Aplicación para entender deudas, intereses, vencimientos y construir un plan inteligente de salida en República Dominicana.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/brand/deuda-clara-favicon-20260408.ico?v=4", type: "image/x-icon" },
      { url: "/brand/deuda-clara-logo-20260408.png?v=4", type: "image/png" },
    ],
    shortcut: ["/brand/deuda-clara-favicon-20260408.ico?v=4"],
    apple: [{ url: "/brand/deuda-clara-logo-20260408.png?v=4", type: "image/png" }],
  },
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Deuda Clara RD",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  openGraph: {
    type: "website",
    locale: "es_DO",
    siteName: "Deuda Clara RD",
    title: "Deuda Clara RD",
    description: "Aplicación para entender deudas y crear un plan de salida inteligente",
    images: [
      {
        url: "/brand/deuda-clara-logo-20260408.png",
        width: 512,
        height: 512,
        alt: "Deuda Clara RD Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deuda Clara RD",
    description: "Aplicación para entender deudas y crear un plan de salida inteligente",
    images: ["/brand/deuda-clara-logo-20260408.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es" className="min-h-full scroll-smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="apple-touch-icon" href="/brand/deuda-clara-logo-20260408.png?v=4" />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

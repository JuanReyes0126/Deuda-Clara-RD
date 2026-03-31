import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/layout/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deuda Clara RD",
  description:
    "Aplicación web para entender deudas, intereses, vencimientos y construir un plan inteligente de salida en República Dominicana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es" className="min-h-full scroll-smooth">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

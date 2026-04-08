import type { Metadata } from "next";

import { PublicInfoPage } from "@/components/layout/public-info-page";

export const metadata: Metadata = {
  title: "Seguridad | Deuda Clara RD",
  description:
    "Resumen de las medidas de seguridad, protección de datos y controles de acceso de Deuda Clara RD.",
};

const securityItems = [
  {
    title: "Protección de acceso",
    copy: "La app protege sesiones, acciones sensibles y recuperación de cuenta con controles diseñados para reducir accesos no autorizados.",
  },
  {
    title: "Privacidad por diseño",
    copy: "No necesitas conectar cuentas bancarias para empezar. Tú decides qué deudas, pagos y fechas registrar dentro de la app.",
  },
  {
    title: "Datos de pago",
    copy: "Los pagos de membresía se procesan a través de AZUL. Deuda Clara RD no guarda datos sensibles de tarjeta.",
  },
  {
    title: "Actividad importante",
    copy: "Registramos eventos relevantes de seguridad y operación para ayudar a detectar actividad inusual y mantener trazabilidad.",
  },
  {
    title: "Límites honestos",
    copy: "Ningún sistema conectado a internet puede prometer seguridad absoluta. Nuestro compromiso es aplicar medidas razonables, revisar riesgos y mejorar continuamente.",
  },
];

export default function SecurityPage() {
  return (
    <PublicInfoPage
      eyebrow="Seguridad"
      title="Protección de datos y controles de acceso para una app financiera real."
      description="Esta página resume nuestra postura de seguridad en lenguaje claro. Los detalles legales sobre tratamiento de datos están en la Política de Privacidad."
      cta={{ href: "/privacy", label: "Ver política de privacidad" }}
    >
      {securityItems.map((item) => (
        <section
          key={item.title}
          className="rounded-[1.6rem] border border-border/80 bg-secondary/45 p-5"
        >
          <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
          <p className="mt-2 text-sm leading-7 text-muted">{item.copy}</p>
        </section>
      ))}
    </PublicInfoPage>
  );
}

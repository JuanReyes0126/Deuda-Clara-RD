import type { Metadata } from "next";

import { PublicInfoPage } from "@/components/layout/public-info-page";

export const metadata: Metadata = {
  title: "Acerca de nosotros | Deuda Clara RD",
  description:
    "Conoce la misión de Deuda Clara RD y cómo ayudamos a organizar deudas personales en República Dominicana.",
};

const aboutItems = [
  {
    title: "Nuestra misión",
    copy: "Ayudar a personas en República Dominicana a entender sus deudas, ordenar pagos y tomar mejores decisiones sin sentirse perdidas entre números.",
  },
  {
    title: "Cómo ayudamos",
    copy: "Convertimos saldos, vencimientos, intereses y pagos mínimos en un panel claro con próximos pasos, recordatorios y simulaciones simples de entender.",
  },
  {
    title: "Lo que no somos",
    copy: "No somos un banco ni una firma de asesoría financiera. Deuda Clara RD es una herramienta tecnológica de organización y simulación personal.",
  },
  {
    title: "Nuestro enfoque",
    copy: "Primero claridad. Luego acción. Base ayuda a entender el problema, Premium ayuda a optimizar y Pro añade más seguimiento.",
  },
];

export default function AboutPage() {
  return (
    <PublicInfoPage
      eyebrow="Acerca de nosotros"
      title="Creamos Deuda Clara RD para que salir de deudas se sienta más claro."
      description="La app nace para personas que quieren ver su panorama completo, recibir recordatorios a tiempo y entender qué decisión puede ayudarles a pagar menos intereses."
      cta={{ href: "/registro", label: "Empezar gratis" }}
    >
      {aboutItems.map((item) => (
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

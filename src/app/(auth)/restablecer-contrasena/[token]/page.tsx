import { notFound } from "next/navigation";

import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({
  params,
}: ResetPasswordPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  return (
    <AuthPageShell
      eyebrow="Nuevo acceso"
      title="Elige una contraseña nueva y vuelve a tu panel con seguridad."
      description="Usa una clave fuerte. Cerramos las sesiones activas cuando completes este proceso."
      asideTitle="Buenas practicas"
      asideItems={[
        "Combina mayusculas, minusculas y numeros.",
        "Evita reutilizar contrasenas de otros servicios.",
        "Tras el cambio, te pediremos iniciar sesion de nuevo.",
      ]}
    >
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Restablecer contraseña
        </h2>
        <p className="text-sm leading-7 text-muted">
          El enlace es temporal. Si expira, podras solicitar otro.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </AuthPageShell>
  );
}

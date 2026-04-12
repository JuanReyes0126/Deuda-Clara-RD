import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      eyebrow="Recuperar acceso"
      title="Vuelve a entrar sin exponer tu cuenta ni tus datos financieros."
      description="Enviaremos un enlace seguro de un solo uso al correo asociado a tu cuenta."
      asideTitle="Seguridad del proceso"
      asideItems={[
        "Tokens únicos con expiración corta.",
        "Mensajes neutros para evitar filtración de cuentas existentes.",
        "Revocación de sesiones al completar el cambio de contraseña.",
      ]}
    >
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-semibold text-foreground">
          Recuperar contraseña
        </h2>
        <p className="text-sm leading-7 text-muted">
          Si tu correo existe en el sistema, te enviaremos instrucciones seguras.
        </p>
      </div>
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}

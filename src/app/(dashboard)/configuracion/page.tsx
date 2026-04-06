import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { requireUser } from "@/lib/auth/session";
import { isDemoSessionUser } from "@/lib/demo/session";
import {
  buildUserSettingsViewModel,
  getUserSettingsViewModel,
} from "@/server/settings/settings-service";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : undefined;
  const securityNotice =
    params?.security === "admin-mfa-required"
      ? "Activa la verificación en dos pasos para acceder al panel interno y a las rutas administrativas."
      : null;

  if (isDemoSessionUser(user)) {
    return (
      <SettingsPanel
        user={buildUserSettingsViewModel(user)}
        securityNotice={securityNotice}
      />
    );
  }

  const settingsViewModel = await getUserSettingsViewModel(user.id);

  return (
    <SettingsPanel
      user={settingsViewModel}
      securityNotice={securityNotice}
    />
  );
}

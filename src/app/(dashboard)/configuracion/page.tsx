import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { requireUser } from "@/lib/auth/session";
import { isDemoSessionUser } from "@/lib/demo/session";
import { getUserSettingsBundle } from "@/server/settings/settings-service";

export default async function SettingsPage() {
  const user = await requireUser();

  if (isDemoSessionUser(user)) {
    return <SettingsPanel user={user} />;
  }

  const settingsBundle = await getUserSettingsBundle(user.id);

  return <SettingsPanel user={settingsBundle} />;
}

import { HostUnlockForm } from "@/features/host/components/host-unlock-form";
import {
  getHostPanelRuntimeConfig,
  requireHostPanelUser,
} from "@/server/host/host-access";

export default async function HostUnlockPage() {
  await requireHostPanelUser({ allowMissingSecondary: true });
  const hostConfig = getHostPanelRuntimeConfig();

  return <HostUnlockForm secondaryMode={hostConfig.secondaryMode} />;
}

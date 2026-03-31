import { HostUnlockForm } from "@/features/host/components/host-unlock-form";
import { requireHostPanelUser } from "@/server/host/host-access";

export default async function HostUnlockPage() {
  await requireHostPanelUser({ allowMissingSecondary: true });

  return <HostUnlockForm />;
}

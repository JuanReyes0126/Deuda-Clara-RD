import type { ReactNode } from "react";

import { HostShell } from "@/features/host/components/host-shell";
import { requireHostPanelUser } from "@/server/host/host-access";

export default async function HostPanelLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireHostPanelUser();

  return (
    <HostShell
      userName={`${user.firstName} ${user.lastName}`}
      userEmail={user.email}
    >
      {children}
    </HostShell>
  );
}

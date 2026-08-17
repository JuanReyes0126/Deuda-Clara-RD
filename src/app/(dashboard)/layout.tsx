import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getRequestAppShellUser } from "@/server/request/request-user-context";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await getRequestAppShellUser();

  return <AppShell user={user}>{children}</AppShell>;
}

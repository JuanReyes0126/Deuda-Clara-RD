import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { requireHostPanelUser } from "@/server/host/host-access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireHostPanelUser();
  redirect("/host");

  return children;
}

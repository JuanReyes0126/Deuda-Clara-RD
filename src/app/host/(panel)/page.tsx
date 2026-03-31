import { AdminOverview } from "@/features/admin/components/admin-overview";
import { getAdminOverview } from "@/server/admin/admin-service";

export default async function HostPage() {
  const overview = await getAdminOverview();

  return <AdminOverview initialData={overview} internalMode />;
}

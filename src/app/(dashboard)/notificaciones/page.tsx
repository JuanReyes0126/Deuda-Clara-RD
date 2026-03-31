import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { requireUser } from "@/lib/auth/session";
import { demoNotifications } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import { hasMembershipAccess } from "@/lib/membership/plans";
import { listUserNotifications } from "@/server/notifications/notification-service";
import { getUserSettingsBundle } from "@/server/settings/settings-service";

export default async function NotificationsPage() {
  const user = await requireUser();

  if (isDemoSessionUser(user)) {
    return (
      <NotificationCenter
        initialNotifications={demoNotifications}
        premiumInsightsEnabled
      />
    );
  }

  const [notifications, settingsBundle] = await Promise.all([
    listUserNotifications(user.id),
    getUserSettingsBundle(user.id),
  ]);
  const premiumInsightsEnabled = hasMembershipAccess(
    settingsBundle.settings?.membershipTier,
    settingsBundle.settings?.membershipBillingStatus ?? "FREE",
  );

  return (
    <NotificationCenter
      initialNotifications={notifications}
      premiumInsightsEnabled={premiumInsightsEnabled}
    />
  );
}

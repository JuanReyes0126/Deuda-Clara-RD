import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { demoNotifications } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import { listUserNotifications } from "@/server/notifications/notification-service";
import { getRequestMembershipContext, getRequestSessionUser } from "@/server/request/request-user-context";

export default async function NotificationsPage() {
  const user = await getRequestSessionUser();

  if (isDemoSessionUser(user)) {
    return (
      <NotificationCenter
        initialNotifications={demoNotifications}
        membershipTier="NORMAL"
        billingStatus="ACTIVE"
      />
    );
  }

  const [notifications, membership] = await Promise.all([
    listUserNotifications(user.id),
    getRequestMembershipContext(),
  ]);
  return (
    <NotificationCenter
      initialNotifications={notifications}
      membershipTier={membership.membershipTier}
      billingStatus={membership.membershipBillingStatus}
    />
  );
}

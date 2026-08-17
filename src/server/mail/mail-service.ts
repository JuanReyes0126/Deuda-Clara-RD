import { Resend } from "resend";

import { getServerEnv } from "@/lib/env/server";
import { logServerInfo } from "@/server/observability/logger";

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendTransactionalEmail(input: SendMailInput) {
  const env = getServerEnv();

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    logServerInfo("Email skipped because Resend is not configured", {
      to: input.to,
      subject: input.subject,
    });
    return { queued: false };
  }

  const resend = new Resend(env.RESEND_API_KEY);

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return { queued: true };
}

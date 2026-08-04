import "server-only";
import { Resend } from "resend";
import { env, hasResend } from "@/lib/env";

let client: Resend | null = null;

function resend(): Resend | null {
  if (!hasResend) return null;
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};

/**
 * Best-effort transactional send via Resend. Never throws and returns whether
 * the message went out — email must not be able to break the calling flow.
 */
export async function sendEmail(args: SendArgs): Promise<boolean> {
  const r = resend();
  if (!r) {
    console.warn("[email] RESEND_API_KEY unset — skipping:", args.subject);
    return false;
  }
  try {
    const { error } = await r.emails.send({
      from: env.emailFrom,
      to: args.to,
      replyTo: env.emailReplyTo,
      subject: args.subject,
      html: args.html,
      ...(args.text ? { text: args.text } : {}),
      ...(args.headers ? { headers: args.headers } : {}),
    });
    if (error) {
      console.error("[email] send failed:", args.subject, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send threw:", args.subject, err);
    return false;
  }
}

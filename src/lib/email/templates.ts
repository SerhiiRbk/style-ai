import { BRAND } from "@/lib/brand";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Plain, inline-styled HTML email templates. Deliberately dependency-free
 * (no React Email) — the mail is simple and email clients only respect inline
 * styles anyway. Every builder returns a subject plus HTML and text bodies.
 */

const C = {
  ink: "#1a1712",
  stone: "#6b6357",
  paper: "#ffffff",
  cream: "#f5efe6",
  line: "#e7ddcf",
  brass: "#a9824c",
} as const;

/** Escape user/AI-supplied text before interpolating into HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailContent = { subject: string; html: string; text: string };

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${C.ink};color:${C.paper};text-decoration:none;font-size:15px;padding:12px 24px;border-radius:9999px;">${esc(label)}</a>`;
}

function layout(opts: {
  preheader: string;
  bodyHtml: string;
  unsubscribeUrl?: string | null;
}): string {
  const logoUrl = absoluteUrl(BRAND.logo);
  const unsub = opts.unsubscribeUrl
    ? `<br/>Don't want these reminders? <a href="${opts.unsubscribeUrl}" style="color:${C.stone};">Unsubscribe</a>.`
    : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
</head>
<body style="margin:0;padding:0;background:${C.cream};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.paper};border:1px solid ${C.line};border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px;border-bottom:1px solid ${C.line};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${logoUrl}" width="40" height="40" alt="${esc(BRAND.name)}" style="display:block;border-radius:8px;"/></td>
<td style="vertical-align:middle;padding-left:14px;font-size:26px;font-weight:700;letter-spacing:4px;color:${C.ink};text-transform:uppercase;">${esc(BRAND.name)}</td>
</tr></table>
</td></tr>
<tr><td style="padding:32px;">
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid ${C.line};font-size:12px;color:${C.stone};line-height:1.6;">
${esc(BRAND.name)} · ${esc(BRAND.tagline)}<br/>
Questions? Just reply to this email or write to <a href="mailto:${BRAND.contactEmail}" style="color:${C.stone};">${esc(BRAND.contactEmail)}</a>.${unsub}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:${C.ink};">${esc(text)}</h1>`;
}
function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.stone};">${esc(text)}</p>`;
}

/** 1. Report ready — the critical activation email. */
export function reportReadyEmail(opts: {
  headline: string | null;
  reportUrl: string;
}): EmailContent {
  const heading = opts.headline?.trim() || "Your style report is ready";
  const bodyHtml = `
${h1("Your report is ready")}
${p(heading)}
${p("Your personalised looks, colours, and shopping list are waiting — put together by Carlo.")}
<div style="margin:24px 0 8px;">${button(opts.reportUrl, "View my report")}</div>
`;
  return {
    subject: "Your Valetti style report is ready",
    html: layout({
      preheader: "Your personalised looks and shopping list are ready.",
      bodyHtml,
    }),
    text: `Your report is ready.\n\n${heading}\n\nView it: ${opts.reportUrl}`,
  };
}

/** 3. Generation hit a snag — reassure and route to retry. */
export function reportFailedEmail(opts: { reportsUrl: string }): EmailContent {
  const bodyHtml = `
${h1("We hit a snag")}
${p("Something went wrong while generating your report, and it didn't finish. Your credits are safe — you can retry in a moment from your reports page.")}
<div style="margin:24px 0 8px;">${button(opts.reportsUrl, "Go to my reports")}</div>
`;
  return {
    subject: "Your Valetti report needs another try",
    html: layout({
      preheader: "Your report didn't finish — your credits are safe.",
      bodyHtml,
    }),
    text: `Something went wrong generating your report. Your credits are safe — retry here: ${opts.reportsUrl}`,
  };
}

/** 2. Palette ready — delivered to A2 email captures. */
export function paletteEmail(opts: {
  subseasonLabel: string;
  swatches: { hex: string; name: string }[];
  note: string;
  ctaUrl: string;
}): EmailContent {
  // Swatch styled to echo the site: rounded, subtly bordered, with an inset
  // sheen + shadow for a tactile "relief". box-shadow is honoured by Apple Mail
  // and most mobile clients; where it's stripped (Gmail web) the border keeps a
  // clean edge. Each colour carries its name label underneath. Laid out 4-per-row
  // (like the site's mobile grid) so labels have room and nothing overflows the
  // fixed-width card.
  const swatchCell = (s: { hex: string; name: string }) =>
    `<td align="center" valign="top" width="25%" style="padding:0 6px 14px;">
<div style="width:52px;height:52px;margin:0 auto;border-radius:12px;background:${esc(
      s.hex,
    )};border:1px solid rgba(21,18,13,0.14);box-shadow:inset 0 2px 3px rgba(255,255,255,0.35),inset 0 -8px 13px rgba(21,18,13,0.18);" title="${esc(
      s.name,
    )}"></div>
<div style="margin-top:8px;font-size:11px;line-height:1.3;color:${C.stone};">${esc(
      s.name,
    )}</div>
</td>`;
  const rows: string[] = [];
  for (let i = 0; i < opts.swatches.length; i += 4) {
    rows.push(`<tr>${opts.swatches.slice(i, i + 4).map(swatchCell).join("")}</tr>`);
  }
  const bodyHtml = `
${h1(`Your colours: ${opts.subseasonLabel}`)}
${p(opts.note)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 22px;table-layout:fixed;">${rows.join(
    "",
  )}</table>
${p("Want the full picture? A complete report adds your wardrobe, photorealistic looks, try-on, and a shopping list — new accounts get free credits to start.")}
<div style="margin:20px 0 8px;">${button(opts.ctaUrl, "Unlock my full look")}</div>
`;
  return {
    subject: `Your colours — ${opts.subseasonLabel}`,
    html: layout({
      preheader: `Your ${opts.subseasonLabel} palette from Valetti.`,
      bodyHtml,
    }),
    text: `Your colours: ${opts.subseasonLabel}\n\n${opts.note}\n\nUnlock your full look: ${opts.ctaUrl}`,
  };
}

/** 2b. Daily-cap acknowledgement — captured when free readings are at capacity. */
export function capAckEmail(opts: { ctaUrl: string }): EmailContent {
  const bodyHtml = `
${h1("You're on the list")}
${p("We were at capacity for free colour readings today. We'll email your palette as soon as things free up — usually by the next morning.")}
${p("In the meantime, you can jump straight to a full report and skip the queue.")}
<div style="margin:20px 0 8px;">${button(opts.ctaUrl, "See a full report")}</div>
`;
  return {
    subject: "Your Valetti colour reading — you're on the list",
    html: layout({
      preheader: "We'll send your palette as soon as capacity frees up.",
      bodyHtml,
    }),
    text: `You're on the list — we'll email your palette when capacity frees up.\n\nSee a full report: ${opts.ctaUrl}`,
  };
}

/** 4. Unused credits reminder — lifecycle mail, carries an unsubscribe link. */
export function creditsReminderEmail(opts: {
  balance: number;
  ctaUrl: string;
  unsubscribeUrl: string;
}): EmailContent {
  const bodyHtml = `
${h1("Your credits are waiting")}
${p(
  `You still have ${opts.balance} credit${opts.balance === 1 ? "" : "s"} on your Valetti account. That's enough to put Carlo to work on your next look.`,
)}
<div style="margin:20px 0 8px;">${button(opts.ctaUrl, "Use my credits")}</div>
`;
  return {
    subject: `You have ${opts.balance} Valetti credit${opts.balance === 1 ? "" : "s"} to use`,
    html: layout({
      preheader: "Your credits are still on your account.",
      bodyHtml,
      unsubscribeUrl: opts.unsubscribeUrl,
    }),
    text: `You still have ${opts.balance} credit(s) on your Valetti account.\n\nUse them: ${opts.ctaUrl}\n\nUnsubscribe: ${opts.unsubscribeUrl}`,
  };
}

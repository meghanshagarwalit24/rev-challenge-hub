import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { z } from "zod";
import { getDb } from "./db";
import type { UserRecord } from "@/lib/storage";
import tls from "node:tls";

// ── Admin Auth ─────────────────────────────────────────────────────────────────
/** Verify admin password on the server (compares against ADMIN_PASSWORD env var). */
export const verifyAdminPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ password: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD ?? "admin123";
    return { ok: data.password === expected };
  });

/** Verify OTP settings panel password (compares against OTP_ADMIN_PAGE_PASSWORD env var). */
export const verifyOtpSettingsPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ password: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const expected = process.env.OTP_ADMIN_PAGE_PASSWORD ?? "u9V#4pL!2qX@8mT$7zK^1rN&6wB%3dH";
    return { ok: data.password === expected };
  });

// ── Admin Log ──────────────────────────────────────────────────────────────────
export interface AdminLog {
  logId: string;
  timestamp: string;
  action: string;
  details: string;
  country?: string;
  countryName?: string;
  ip?: string;
}

const addLogSchema = z.object({
  action: z.string().min(1),
  details: z.string(),
});

const getClientCountry = (): string => {
  const headers = getRequestHeaders();

  return (
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("x-country-code") ??
    "Unknown"
  );
};

const getCountryName = (countryCode: string): string => {
  if (!countryCode || countryCode === "Unknown") return "Unknown";

  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode.toUpperCase()) ?? countryCode
    );
  } catch {
    return countryCode;
  }
};

const getClientIp = (): string => {
  const headers = getRequestHeaders();
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    headers.get("cf-connecting-ip") ??
    headers.get("true-client-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-client-ip") ??
    forwardedFor ??
    "Unknown"
  );
};

/** Append a new admin log entry — logs are never deleted. */
export const addAdminLogFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => addLogSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    const country = getClientCountry();
    const entry: AdminLog = {
      logId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: data.action,
      details: data.details,
      country,
      countryName: getCountryName(country),
      ip: getClientIp(),
    };
    await db.collection("admin_logs").insertOne(entry);
    return { ok: true };
  });

/** Fetch all admin logs, newest first. Logs are read-only — no delete endpoint exists. */
export const getAdminLogsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection<AdminLog & { _id: unknown }>("admin_logs")
    .find({})
    .sort({ timestamp: -1 })
    .toArray();
  return docs.map(({ _id: _unused, ...rest }) => rest as AdminLog);
});

// ── Platform Settings ──────────────────────────────────────────────────────────
export interface PlatformSettings {
  ga4: string;
  metaPixel: string;
  clarity: string;
  recaptchaSite: string;
  recaptchaSecret: string;
  homeAnnouncementMode: "winner" | "text" | "leaderboard";
  homeAnnouncementTexts: string[];
  otpProvider: string;
  otpAccountSid: string;
  otpAuthToken: string;
  otpVerifyServiceSid: string;
  otpDefaultChannel: "sms" | "whatsapp" | "call" | "email";
  otpRegionProfile: string;
  leaderboardAdminEmail: string;
}

const settingsSchema = z.object({
  ga4: z.string(),
  metaPixel: z.string(),
  clarity: z.string(),
  recaptchaSite: z.string(),
  recaptchaSecret: z.string(),
  homeAnnouncementMode: z.enum(["winner", "text", "leaderboard"]).default("winner"),
  homeAnnouncementTexts: z.array(z.string()).length(5),
  otpProvider: z.string().default("twilio"),
  otpAccountSid: z.string().default(""),
  otpAuthToken: z.string().default(""),
  otpVerifyServiceSid: z.string().default(""),
  otpDefaultChannel: z.enum(["sms", "whatsapp", "call", "email"]).default("sms"),
  otpRegionProfile: z.string().default("INDIA"),
  leaderboardAdminEmail: z.string().default(""),
});

export const savePlatformSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    await db
      .collection("platform_settings")
      .updateOne(
        { _key: "main" },
        { $set: { _key: "main", ...data, updatedAt: new Date().toISOString() } },
        { upsert: true },
      );
    return { ok: true };
  });

export const getPlatformSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const doc = await db.collection("platform_settings").findOne({ _key: "main" });
  if (!doc)
    return {
      ga4: "",
      metaPixel: "",
      clarity: "",
      recaptchaSite: "",
      recaptchaSecret: "",
      homeAnnouncementMode: "winner",
      homeAnnouncementTexts: [
        "🔥 Play now and become today's Revital Energy Challenge winner!",
        "",
        "",
        "",
        "",
      ],
      otpProvider: "twilio",
      otpAccountSid: "",
      otpAuthToken: "",
      otpVerifyServiceSid: "",
      otpDefaultChannel: "sms",
      otpRegionProfile: "INDIA",
      leaderboardAdminEmail: "",
    } as PlatformSettings;
  const { _id: _a, _key: _b, updatedAt: _c, ...rest } = doc as Record<string, unknown>;

  const legacyText =
    typeof rest.homeAnnouncementText === "string"
      ? rest.homeAnnouncementText
      : "🔥 Play now and become today's Revital Energy Challenge winner!";
  const storedTexts = Array.isArray(rest.homeAnnouncementTexts)
    ? rest.homeAnnouncementTexts.filter((v): v is string => typeof v === "string").slice(0, 5)
    : [];
  while (storedTexts.length < 5) storedTexts.push(storedTexts.length === 0 ? legacyText : "");

  const otpDefaultChannel =
    rest.otpDefaultChannel === "whatsapp" ||
    rest.otpDefaultChannel === "call" ||
    rest.otpDefaultChannel === "email"
      ? rest.otpDefaultChannel
      : "sms";

  return {
    ...(rest as Omit<PlatformSettings, "homeAnnouncementTexts">),
    homeAnnouncementTexts: storedTexts,
    otpProvider: typeof rest.otpProvider === "string" ? rest.otpProvider : "twilio",
    otpAccountSid: typeof rest.otpAccountSid === "string" ? rest.otpAccountSid : "",
    otpAuthToken: typeof rest.otpAuthToken === "string" ? rest.otpAuthToken : "",
    otpVerifyServiceSid:
      typeof rest.otpVerifyServiceSid === "string" ? rest.otpVerifyServiceSid : "",
    otpDefaultChannel,
    otpRegionProfile: typeof rest.otpRegionProfile === "string" ? rest.otpRegionProfile : "INDIA",
    leaderboardAdminEmail:
      typeof rest.leaderboardAdminEmail === "string" ? rest.leaderboardAdminEmail : "",
  } as PlatformSettings;
});

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;
const GMAIL_FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || "revitalenergyuae@gmail.com";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "zkve peto wnre mhmx").replace(
  /\s+/g,
  "",
);

function generateWinnersSvg(
  lockDate: string,
  winners: Array<{ name: string; score: number }>,
): string {
  const rows = winners
    .slice(0, 10)
    .map(
      (winner, idx) =>
        `<text x="70" y="${210 + idx * 52}" font-size="31" text-anchor="start" font-family="Duplit SemiBold, Duplit, sans-serif" fill="#5A1E11">#${idx + 1} ${winner.name}</text>
<text x="980" y="${210 + idx * 52}" text-anchor="end" font-size="28" font-family="Arial, sans-serif" fill="#D97706">${winner.score}</text>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  <rect width="100%" height="100%" fill="#FFF7ED"/>
  <text x="540" y="90" text-anchor="middle" font-size="44" font-family="Arial, sans-serif" fill="#7C2D12">Revital Daily Winners</text>
  <text x="540" y="140" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" fill="#9A3412">${lockDate}</text>
  ${rows}
</svg>`;
}

type SmtpResponse = {
  code: number;
  text: string;
};

const SMTP_TIMEOUT_MS = 20_000;

function readSmtpResponse(socket: tls.TLSSocket): Promise<SmtpResponse> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error("Timed out waiting for SMTP response."));
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const finalLine = [...lines].reverse().find((line) => /^\d{3}\s/.test(line));
      if (!finalLine) return;

      cleanup();
      resolve({ code: Number(finalLine.slice(0, 3)), text: buffer });
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

async function expectSmtp(
  socket: tls.TLSSocket,
  expectedCodes: number[],
  command?: string,
): Promise<SmtpResponse> {
  if (command) socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.text.trim()}`);
  }
  return response;
}

const sanitizeMailHeader = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();
const dotStuff = (value: string): string => value.replace(/^\./gm, "..");
const chunkBase64 = (value: string): string => value.match(/.{1,76}/g)?.join("\r\n") ?? "";

async function sendViaGmailSmtp(
  to: string,
  subject: string,
  body: string,
  attachment?: { filename: string; contentType: string; content: string },
): Promise<void> {
  if (!GMAIL_FROM_EMAIL || !GMAIL_APP_PASSWORD) {
    throw new Error("Missing Gmail SMTP credentials. Set GMAIL_FROM_EMAIL and GMAIL_APP_PASSWORD.");
  }

  const socket = tls.connect({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    servername: GMAIL_SMTP_HOST,
  });
  socket.setTimeout(SMTP_TIMEOUT_MS);

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });

    await expectSmtp(socket, [220]);
    await expectSmtp(socket, [250], "EHLO revital.local");
    await expectSmtp(socket, [334], "AUTH LOGIN");
    await expectSmtp(socket, [334], Buffer.from(GMAIL_FROM_EMAIL).toString("base64"));
    await expectSmtp(socket, [235], Buffer.from(GMAIL_APP_PASSWORD).toString("base64"));
    await expectSmtp(socket, [250], `MAIL FROM:<${GMAIL_FROM_EMAIL}>`);
    await expectSmtp(socket, [250, 251], `RCPT TO:<${to}>`);
    await expectSmtp(socket, [354], "DATA");

    const safeSubject = sanitizeMailHeader(subject);
    const safeFrom = sanitizeMailHeader(GMAIL_FROM_EMAIL);
    const safeTo = sanitizeMailHeader(to);
    const safeBody = dotStuff(body);

    if (!attachment) {
      socket.write(
        `Subject: ${safeSubject}\r\nFrom: ${safeFrom}\r\nTo: ${safeTo}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${safeBody}\r\n.\r\n`,
      );
    } else {
      const boundary = `revital_${Date.now()}`;
      const encoded = chunkBase64(Buffer.from(attachment.content, "utf8").toString("base64"));
      socket.write(
        `Subject: ${safeSubject}\r\nFrom: ${safeFrom}\r\nTo: ${safeTo}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${safeBody}\r\n\r\n--${boundary}\r\nContent-Type: ${attachment.contentType}; name="${sanitizeMailHeader(attachment.filename)}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${sanitizeMailHeader(attachment.filename)}"\r\n\r\n${encoded}\r\n--${boundary}--\r\n.\r\n`,
      );
    }

    await expectSmtp(socket, [250]);
    await expectSmtp(socket, [221], "QUIT");
  } finally {
    socket.end();
  }
}

const parseAdminEmails = (input: string): string[] =>
  input
    .split(/[;,\n]/)
    .map((email) => email.trim())
    .filter(Boolean);

const formatUaeDate = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);

export const lockDailyTopTenAndNotifyFn = createServerFn({ method: "POST" }).handler(async () => {
  const db = await getDb();
  const settingsDoc = await db.collection("platform_settings").findOne({ _key: "main" });
  const settings = (settingsDoc ?? {}) as Partial<PlatformSettings>;
  const lockDate = formatUaeDate(new Date());

  const users = await db.collection<UserRecord>("users").find({}).toArray();
  const ranked = users
    .map((u) => {
      const best = (u.playAttempts ?? [])
        .filter((a) => a.date === lockDate)
        .reduce<number>((m, a) => Math.max(m, a.total), -1);
      return { userId: u.userId, name: u.name || u.contact, score: best };
    })
    .filter((u) => u.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (!ranked.length) return { ok: true, lockDate, winners: 0, mailed: false };

  await Promise.all(
    ranked.map((winner) =>
      db
        .collection<UserRecord>("users")
        .updateOne({ userId: winner.userId }, { $addToSet: { winnerLockDates: lockDate } }),
    ),
  );

  const adminEmails = parseAdminEmails(settings.leaderboardAdminEmail || "");
  if (!adminEmails.length) {
    return { ok: true, lockDate, winners: ranked.length, mailed: false };
  }
  const subject = `Leaderboard locked for ${lockDate} (UAE)`;
  const text = ranked.map((w, i) => `#${i + 1} ${w.name} — ${w.score}`).join("\n");
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    weekday: "long",
  }).format(new Date(`${lockDate}T12:00:00+04:00`));
  const enrichedSubject = `Winners Locked: ${lockDate} (${dayName}) UAE`;
  const winnersSvg = generateWinnersSvg(lockDate, ranked);
  await Promise.all(
    adminEmails.map((email) =>
      sendViaGmailSmtp(email, enrichedSubject, text, {
        filename: `revital-winners-${lockDate}.svg`,
        contentType: "image/svg+xml",
        content: winnersSvg,
      }),
    ),
  );
  return { ok: true, lockDate, winners: ranked.length, mailed: true, adminEmails };
});

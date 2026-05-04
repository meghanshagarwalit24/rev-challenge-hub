import { createServerFn } from "@tanstack/react-start";
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
}

const addLogSchema = z.object({
  action: z.string().min(1),
  details: z.string(),
});

/** Append a new admin log entry — logs are never deleted. */
export const addAdminLogFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => addLogSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    const entry: AdminLog = {
      logId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: data.action,
      details: data.details,
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
const GMAIL_FROM_EMAIL = "revitalenergyuae@gmail.com";
const GMAIL_APP_PASSWORD = "zkve peto wnre mhmx";

async function sendViaGmailSmtp(to: string, subject: string, body: string): Promise<void> {
  const socket = tls.connect({ host: GMAIL_SMTP_HOST, port: GMAIL_SMTP_PORT, servername: GMAIL_SMTP_HOST });
  const readResponse = () =>
    new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        if (/^\d{3}[\s-]/m.test(text)) {
          socket.off("data", onData);
          resolve(text);
        }
      };
      socket.on("data", onData);
      socket.once("error", reject);
    });
  const send = async (line: string) => {
    socket.write(`${line}\r\n`);
    await readResponse();
  };
  await readResponse();
  await send(`EHLO revital.local`);
  await send(`AUTH LOGIN`);
  await send(Buffer.from(GMAIL_FROM_EMAIL).toString("base64"));
  await send(Buffer.from(GMAIL_APP_PASSWORD).toString("base64"));
  await send(`MAIL FROM:<${GMAIL_FROM_EMAIL}>`);
  await send(`RCPT TO:<${to}>`);
  await send(`DATA`);
  socket.write(`Subject: ${subject}\r\nFrom: ${GMAIL_FROM_EMAIL}\r\nTo: ${to}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.\r\n`);
  await readResponse();
  await send("QUIT");
  socket.end();
}

const formatUaeDate = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);

export const lockDailyTopTenAndNotifyFn = createServerFn({ method: "POST" }).handler(async () => {
  const db = await getDb();
  const settingsDoc = await db.collection("platform_settings").findOne({ _key: "main" });
  const settings = (settingsDoc ?? {}) as Partial<PlatformSettings>;
  const lockDate = formatUaeDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

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
      db.collection<UserRecord>("users").updateOne(
        { userId: winner.userId },
        { $addToSet: { winnerLockDates: lockDate } },
      ),
    ),
  );

  const adminEmail = (settings.leaderboardAdminEmail || "").trim();
  if (!adminEmail) {
    return { ok: true, lockDate, winners: ranked.length, mailed: false };
  }
  const subject = `Leaderboard locked for ${lockDate} (UAE)`;
  const text = ranked.map((w, i) => `#${i + 1} ${w.name} — ${w.score}`).join("\n");
  await sendViaGmailSmtp(adminEmail, subject, text);
  return { ok: true, lockDate, winners: ranked.length, mailed: true, adminEmail };
});

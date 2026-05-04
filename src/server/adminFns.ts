import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "./db";

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
  } as PlatformSettings;
});

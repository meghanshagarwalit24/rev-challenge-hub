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
}

const settingsSchema = z.object({
  ga4: z.string(),
  metaPixel: z.string(),
  clarity: z.string(),
  recaptchaSite: z.string(),
  recaptchaSecret: z.string(),
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
    } as PlatformSettings;
  const { _id: _a, _key: _b, updatedAt: _c, ...rest } = doc;
  return rest as PlatformSettings;
});

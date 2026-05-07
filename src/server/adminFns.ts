import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { z } from "zod";
import { getDb } from "./db";
import type { UserRecord } from "@/lib/storage";
import tls from "node:tls";
import { createCanvas, loadImage, registerFont } from "canvas";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

const NAME_SLOTS = [
  { x: 321.5, y: 735.5 },
  { x: 779.5, y: 735.5 },
  { x: 321.5, y: 842.5 },
  { x: 779.5, y: 842.5 },
  { x: 321.5, y: 949.5 },
  { x: 779.5, y: 949.5 },
  { x: 321.5, y: 1056.5 },
  { x: 779.5, y: 1056.5 },
  { x: 321.5, y: 1163.5 },
  { x: 779.5, y: 1163.5 },
];

const TEMPLATE_WIDTH = 1080;
const TEMPLATE_HEIGHT = 1920;

async function getTemplatePath(): Promise<string> {
  const __dir = dirname(fileURLToPath(import.meta.url));
  // dist/server/assets/adminFns-*.js → ../../public
  const candidate = join(__dir, "../../public/winners-template.png");
  try {
    await readFile(candidate);
    return candidate;
  } catch {
    return join(process.cwd(), "public/winners-template.png");
  }
}

async function generateWinnersPng(
  winners: Array<{ name: string; score: number; contact?: string }>,
): Promise<Buffer> {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const fontCandidate = join(__dir, "../../public/fonts/Duplet-Semibold-BF642a34066f658.otf");
  const fontPath = await readFile(fontCandidate).then(() => fontCandidate).catch(() =>
    join(process.cwd(), "public/fonts/Duplet-Semibold-BF642a34066f658.otf")
  );
  registerFont(fontPath, { family: "Duplet", weight: "600" });

  const templatePath = await getTemplatePath();
  const templateData = await readFile(templatePath);
  const img = await loadImage(templateData);

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const scaleX = img.width / TEMPLATE_WIDTH;
  const scaleY = img.height / TEMPLATE_HEIGHT;

  winners.slice(0, 10).forEach((winner, index) => {
    const slot = NAME_SLOTS[index];
    if (!slot) return;

    const displayName = winner.name?.trim() || winner.contact || "";
    const maxTextWidth = 280 * scaleX;
    const nameX = slot.x * scaleX - maxTextWidth / 2;
    const nameY = slot.y * scaleY;
    const fontSize = Math.round(35 * Math.min(scaleX, scaleY));
    const ellipsis = "...";

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#461901";
    ctx.font = `600 ${fontSize}px Duplet, sans-serif`;

    let textToDraw = displayName;
    if (ctx.measureText(textToDraw).width > maxTextWidth) {
      while (textToDraw.length > 0 && ctx.measureText(`${textToDraw}${ellipsis}`).width > maxTextWidth) {
        textToDraw = textToDraw.slice(0, -1);
      }
      textToDraw = textToDraw ? `${textToDraw}${ellipsis}` : ellipsis;
    }

    ctx.fillText(textToDraw, nameX, nameY);
  });

  return canvas.toBuffer("image/png");
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
  attachment?: { filename: string; contentType: string; content: string | Buffer },
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
      const rawContent = attachment.content;
      const encoded = chunkBase64(
        (Buffer.isBuffer(rawContent) ? rawContent : Buffer.from(rawContent, "utf8")).toString("base64"),
      );
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
  const winnersPng = await generateWinnersPng(ranked);
  await Promise.all(
    adminEmails.map((email) =>
      sendViaGmailSmtp(email, enrichedSubject, text, {
        filename: `revital-winners-${lockDate}.png`,
        contentType: "image/png",
        content: winnersPng,
      }),
    ),
  );
  return { ok: true, lockDate, winners: ranked.length, mailed: true, adminEmails };
});

export const getPreviousDayWinnersFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const yesterday = formatUaeDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const users = await db
    .collection<UserRecord>("users")
    .find({ winnerLockDates: yesterday })
    .toArray();

  const ranked = users
    .map((u) => {
      const best = (u.playAttempts ?? [])
        .filter((a) => a.date === yesterday)
        .reduce<number>((m, a) => Math.max(m, a.total), 0);
      return { name: u.name || u.contact || "Player", score: best };
    })
    .sort((a, b) => b.score - a.score);

  return { date: yesterday, winners: ranked };
});

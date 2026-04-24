import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "./db";
import type { UserRecord } from "@/lib/storage";

const gameScoresSchema = z.object({
  reflex: z.number().nullable(),
  memory: z.number().nullable(),
  balance: z.number().nullable(),
});

const userRecordSchema = z.object({
  userId: z.string(),
  contact: z.string().min(1),
  name: z.string().optional(),
  address: z.string().optional(),
  scores: gameScoresSchema,
  total: z.number(),
  category: z.string(),
  consent: z.boolean(),
  createdAt: z.string(),
});

const contactSchema = z.object({ contact: z.string().min(1) });

// ── save / upsert ──────────────────────────────────────────────────────────────
export const saveUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => userRecordSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    const normalized = { ...data, contact: data.contact.toLowerCase() };
    await db.collection<UserRecord>("users").updateOne(
      { contact: normalized.contact },
      { $set: normalized },
      { upsert: true },
    );
    return { ok: true };
  });

// ── get by contact ─────────────────────────────────────────────────────────────
export const getUserByContactFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    const user = await db
      .collection<UserRecord & { _id: unknown }>("users")
      .findOne({ contact: data.contact.toLowerCase() });
    if (!user) return null;
    const { _id: _unused, ...rest } = user;
    return rest as UserRecord;
  });

// ── get all ────────────────────────────────────────────────────────────────────
export const getAllUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection<UserRecord & { _id: unknown }>("users")
    .find({})
    .sort({ total: -1 })
    .toArray();
  return docs.map(({ _id: _unused, ...rest }) => rest as UserRecord);
});

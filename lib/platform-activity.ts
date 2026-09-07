import type { Db, ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { getDb } from "./mongodb";

export type ActivityActorKind =
  | "user"
  | "staff"
  | "school_admin"
  | "anonymous"
  | "system";

export type ActivitySurface =
  | "user"
  | "admin"
  | "partner_school"
  | "public"
  | "system";

export type ActivitySeverity = "info" | "warning" | "security";

export type PlatformActivityDoc = {
  _id?: ObjectId;
  createdAt: Date;
  action: string;
  surface: ActivitySurface;
  severity: ActivitySeverity;
  actorKind: ActivityActorKind;
  actorId?: string | null;
  actorUsername?: string | null;
  actorEmail?: string | null;
  schoolId?: string | null;
  schoolSlug?: string | null;
  schoolName?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  success: boolean;
};

export type LogPlatformActivityInput = {
  action: string;
  summary: string;
  surface: ActivitySurface;
  severity?: ActivitySeverity;
  actorKind?: ActivityActorKind;
  actorId?: string | null;
  actorUsername?: string | null;
  actorEmail?: string | null;
  schoolId?: string | null;
  schoolSlug?: string | null;
  schoolName?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  success?: boolean;
  req?: NextRequest | Request | null;
  path?: string | null;
};

export function platformActivityCollection(db: Db) {
  return db.collection<PlatformActivityDoc>("platformActivityLogs");
}

export async function ensurePlatformActivityIndexes(db: Db): Promise<void> {
  const col = platformActivityCollection(db);
  const specs: Array<[Record<string, 1 | -1>, Record<string, unknown>?]> = [
    [{ createdAt: -1 }],
    [{ action: 1, createdAt: -1 }],
    [{ surface: 1, createdAt: -1 }],
    [{ severity: 1, createdAt: -1 }],
    [{ actorUsername: 1, createdAt: -1 }],
    [{ actorEmail: 1, createdAt: -1 }],
    [{ ip: 1, createdAt: -1 }],
    [{ schoolSlug: 1, createdAt: -1 }],
    [{ success: 1, createdAt: -1 }],
  ];
  for (const [keys, options] of specs) {
    try {
      await col.createIndex(keys, options);
    } catch (error) {
      console.error("[platformActivityLogs] createIndex", keys, error);
    }
  }
}

export function getRequestClientIp(
  req?: NextRequest | Request | null,
): string | null {
  if (!req) return null;
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp.slice(0, 128);
  return null;
}

export function getRequestUserAgent(
  req?: NextRequest | Request | null,
): string | null {
  if (!req) return null;
  const ua = req.headers.get("user-agent")?.trim();
  return ua ? ua.slice(0, 400) : null;
}

function sanitizeMeta(
  meta?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("otp") ||
      lower.includes("pin") ||
      lower.includes("hash")
    ) {
      continue;
    }
    if (value == null) {
      out[key] = value;
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = typeof value === "string" ? value.slice(0, 500) : value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 20).map((item) =>
        typeof item === "string" ? item.slice(0, 200) : item,
      );
      continue;
    }
    try {
      out[key] = JSON.parse(JSON.stringify(value));
    } catch {
      out[key] = String(value).slice(0, 200);
    }
  }
  return out;
}

/**
 * Persist a platform activity / security log.
 * Never throws to callers — logging failures are swallowed after console.error.
 */
export async function logPlatformActivity(
  input: LogPlatformActivityInput,
): Promise<void> {
  try {
    const db = await getDb();
    await ensurePlatformActivityIndexes(db);

    const path =
      input.path ||
      (input.req && "nextUrl" in input.req
        ? input.req.nextUrl.pathname
        : input.req && "url" in input.req
          ? (() => {
              try {
                return new URL(input.req.url).pathname;
              } catch {
                return null;
              }
            })()
          : null);

    const doc: PlatformActivityDoc = {
      createdAt: new Date(),
      action: input.action.slice(0, 120),
      surface: input.surface,
      severity: input.severity || "info",
      actorKind: input.actorKind || "anonymous",
      actorId: input.actorId ?? null,
      actorUsername: input.actorUsername
        ? input.actorUsername.slice(0, 120)
        : null,
      actorEmail: input.actorEmail
        ? input.actorEmail.trim().toLowerCase().slice(0, 180)
        : null,
      schoolId: input.schoolId ?? null,
      schoolSlug: input.schoolSlug ?? null,
      schoolName: input.schoolName ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      summary: input.summary.slice(0, 500),
      meta: sanitizeMeta(input.meta),
      ip: getRequestClientIp(input.req),
      userAgent: getRequestUserAgent(input.req),
      path: path ? String(path).slice(0, 300) : null,
      success: input.success !== false,
    };

    await platformActivityCollection(db).insertOne(doc);
  } catch (error) {
    console.error("[logPlatformActivity]", error);
  }
}

export function serializePlatformActivity(doc: PlatformActivityDoc) {
  return {
    id: String(doc._id),
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date().toISOString(),
    action: doc.action,
    surface: doc.surface,
    severity: doc.severity,
    actorKind: doc.actorKind,
    actorId: doc.actorId ?? null,
    actorUsername: doc.actorUsername ?? null,
    actorEmail: doc.actorEmail ?? null,
    schoolId: doc.schoolId ?? null,
    schoolSlug: doc.schoolSlug ?? null,
    schoolName: doc.schoolName ?? null,
    targetType: doc.targetType ?? null,
    targetId: doc.targetId ?? null,
    summary: doc.summary,
    meta: doc.meta ?? null,
    ip: doc.ip ?? null,
    userAgent: doc.userAgent ?? null,
    path: doc.path ?? null,
    success: doc.success !== false,
  };
}

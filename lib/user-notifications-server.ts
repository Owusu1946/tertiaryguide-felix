import { ObjectId, type Db } from "mongodb";
import type { AppNotification, AppNotificationKind } from "./notifications";

export type UserNotificationDoc = {
  _id: ObjectId;
  email: string;
  title: string;
  body: string;
  kind: AppNotificationKind;
  href?: string;
  read: boolean;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
};

export function userNotificationsCollection(db: Db) {
  return db.collection<UserNotificationDoc>("userNotifications");
}

export async function ensureUserNotificationIndexes(db: Db) {
  const col = userNotificationsCollection(db);
  await Promise.all([
    col.createIndex({ email: 1, createdAt: -1 }),
    col.createIndex(
      { email: 1, dedupeKey: 1 },
      {
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: "string" } },
      },
    ),
  ]);
}

export type CreateUserNotificationInput = {
  email: string;
  title: string;
  body: string;
  kind?: AppNotificationKind;
  href?: string;
  dedupeKey?: string;
  createdAt?: Date;
};

export function serializeUserNotification(
  doc: UserNotificationDoc,
): AppNotification {
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    read: Boolean(doc.read),
    createdAt: doc.createdAt.toISOString(),
    href: doc.href,
    kind: doc.kind,
  };
}

/**
 * Create an in-app notification for a student. Safe to call repeatedly
 * with the same dedupeKey — duplicates are ignored.
 */
export async function createUserNotification(
  db: Db,
  input: CreateUserNotificationInput,
): Promise<AppNotification | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  await ensureUserNotificationIndexes(db);
  const col = userNotificationsCollection(db);
  const now = input.createdAt ?? new Date();
  const dedupeKey = input.dedupeKey?.trim() || undefined;

  if (dedupeKey) {
    const existing = await col.findOne({ email, dedupeKey });
    if (existing) return serializeUserNotification(existing);
  }

  try {
    const doc: Omit<UserNotificationDoc, "_id"> = {
      email,
      title: input.title.trim(),
      body: input.body.trim(),
      kind: input.kind || "general",
      href: input.href,
      read: false,
      ...(dedupeKey ? { dedupeKey } : {}),
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(doc as UserNotificationDoc);
    return serializeUserNotification({
      ...doc,
      _id: result.insertedId,
    } as UserNotificationDoc);
  } catch (error) {
    // Race on unique dedupeKey
    if (dedupeKey) {
      const existing = await col.findOne({ email, dedupeKey });
      if (existing) return serializeUserNotification(existing);
    }
    console.error("[createUserNotification]", error);
    return null;
  }
}

export async function listUserNotifications(
  db: Db,
  emailRaw: string,
  limit = 80,
): Promise<AppNotification[]> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return [];

  await ensureUserNotificationIndexes(db);
  const docs = await userNotificationsCollection(db)
    .find({ email })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map(serializeUserNotification);
}

export async function updateUserNotificationRead(
  db: Db,
  emailRaw: string,
  opts: {
    id?: string;
    read?: boolean;
    readAll?: boolean;
    unreadAll?: boolean;
  },
): Promise<number> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return 0;

  const col = userNotificationsCollection(db);
  const now = new Date();

  if (opts.readAll) {
    const result = await col.updateMany(
      { email, read: { $ne: true } },
      { $set: { read: true, updatedAt: now } },
    );
    return result.modifiedCount;
  }

  if (opts.unreadAll) {
    const result = await col.updateMany(
      { email, read: true },
      { $set: { read: false, updatedAt: now } },
    );
    return result.modifiedCount;
  }

  if (opts.id && ObjectId.isValid(opts.id) && typeof opts.read === "boolean") {
    const result = await col.updateOne(
      { _id: new ObjectId(opts.id), email },
      { $set: { read: opts.read, updatedAt: now } },
    );
    return result.modifiedCount;
  }

  return 0;
}

export async function deleteUserNotifications(
  db: Db,
  emailRaw: string,
  opts: { id?: string; clearAll?: boolean },
): Promise<number> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return 0;

  const col = userNotificationsCollection(db);

  if (opts.clearAll) {
    const result = await col.deleteMany({ email });
    return result.deletedCount;
  }

  if (opts.id && ObjectId.isValid(opts.id)) {
    const result = await col.deleteOne({
      _id: new ObjectId(opts.id),
      email,
    });
    return result.deletedCount;
  }

  return 0;
}

async function listStudentEmails(db: Db): Promise<string[]> {
  const { nonStaffUserFilter } = await import("./admin-access");
  const users = await db
    .collection<{ email?: string }>("users")
    .find(nonStaffUserFilter(), { projection: { email: 1 } })
    .toArray();
  const emails = users
    .map((u) => (typeof u.email === "string" ? u.email.trim().toLowerCase() : ""))
    .filter((email) => email.includes("@"));
  return [...new Set(emails)];
}

async function listNewsOptInEmails(db: Db): Promise<string[]> {
  const prefs = await db
    .collection<{ email: string; newsUpdates?: boolean }>(
      "notification_preferences",
    )
    .find({ newsUpdates: true }, { projection: { email: 1 } })
    .toArray();
  return [
    ...new Set(
      prefs
        .map((p) =>
          typeof p.email === "string" ? p.email.trim().toLowerCase() : "",
        )
        .filter((email) => email.includes("@")),
    ),
  ];
}

/**
 * Fan-out in-app notifications to many users.
 * Uses insertMany; duplicate dedupeKeys are skipped.
 */
export async function notifyManyUsers(
  db: Db,
  emails: string[],
  input: Omit<CreateUserNotificationInput, "email">,
): Promise<{ attempted: number; created: number }> {
  const unique = [
    ...new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
  if (unique.length === 0) return { attempted: 0, created: 0 };

  await ensureUserNotificationIndexes(db);
  const col = userNotificationsCollection(db);
  const now = input.createdAt ?? new Date();
  const baseDedupe = input.dedupeKey?.trim() || undefined;

  const docs: Omit<UserNotificationDoc, "_id">[] = unique.map((email) => ({
    email,
    title: input.title.trim(),
    body: input.body.trim(),
    kind: input.kind || "general",
    href: input.href,
    read: false,
    ...(baseDedupe ? { dedupeKey: `${baseDedupe}:${email}` } : {}),
    createdAt: now,
    updatedAt: now,
  }));

  try {
    const result = await col.insertMany(docs as UserNotificationDoc[], {
      ordered: false,
    });
    return { attempted: unique.length, created: result.insertedCount };
  } catch (error: unknown) {
    // Partial success when some dedupeKeys already exist
    const inserted =
      error &&
      typeof error === "object" &&
      "insertedCount" in error &&
      typeof (error as { insertedCount?: number }).insertedCount === "number"
        ? (error as { insertedCount: number }).insertedCount
        : 0;
    if (inserted > 0) {
      return { attempted: unique.length, created: inserted };
    }
    console.error("[notifyManyUsers]", error);
    return { attempted: unique.length, created: 0 };
  }
}

/** Notify every student account (excludes staff / school admins). */
export async function notifyAllStudents(
  db: Db,
  input: Omit<CreateUserNotificationInput, "email">,
) {
  const emails = await listStudentEmails(db);
  return notifyManyUsers(db, emails, input);
}

/** Notify students who opted into news updates. */
export async function notifyNewsOptInUsers(
  db: Db,
  input: Omit<CreateUserNotificationInput, "email">,
) {
  const emails = await listNewsOptInEmails(db);
  // If nobody opted in yet, still reach all students so news stays visible.
  if (emails.length === 0) {
    return notifyAllStudents(db, input);
  }
  return notifyManyUsers(db, emails, input);
}

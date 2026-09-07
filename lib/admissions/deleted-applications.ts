import { ObjectId, type Db } from "mongodb";
import type { ApplicationDoc } from "./types";
import { applicationsCollection, serializeApplication } from "./applications";

export type DeletedApplicationDoc = ApplicationDoc & {
  /** Preserved original application id for restore. */
  originalApplicationId: ObjectId;
  deletedAt: Date;
  deletedBy: string;
  deletedByKind: "school_admin" | "platform";
  schoolSlug?: string | null;
  schoolName?: string | null;
};

export function deletedApplicationsCollection(db: Db) {
  return db.collection<DeletedApplicationDoc>("deletedApplications");
}

export async function ensureDeletedApplicationIndexes(db: Db): Promise<void> {
  const col = deletedApplicationsCollection(db);
  const specs: Array<[Record<string, 1 | -1>, Record<string, unknown>?]> = [
    [{ originalApplicationId: 1 }, { unique: true }],
    [{ schoolId: 1, deletedAt: -1 }],
    [{ deletedAt: -1 }],
    [{ applicationNumber: 1 }],
  ];
  for (const [keys, options] of specs) {
    try {
      await col.createIndex(keys, options as { unique?: boolean });
    } catch (error) {
      console.error("[deletedApplications] createIndex", keys, error);
    }
  }
}

export async function softDeleteApplications(opts: {
  db: Db;
  schoolId: ObjectId;
  applicationIds: ObjectId[];
  deletedBy: string;
  deletedByKind: "school_admin" | "platform";
  schoolSlug?: string | null;
  schoolName?: string | null;
}): Promise<{ deletedCount: number; deletedIds: string[] }> {
  const {
    db,
    schoolId,
    applicationIds,
    deletedBy,
    deletedByKind,
    schoolSlug,
    schoolName,
  } = opts;

  await ensureDeletedApplicationIndexes(db);
  const apps = applicationsCollection(db);
  const trash = deletedApplicationsCollection(db);

  const docs = await apps
    .find({
      _id: { $in: applicationIds },
      schoolId,
    })
    .toArray();

  if (docs.length === 0) {
    return { deletedCount: 0, deletedIds: [] };
  }

  const now = new Date();
  const backupDocs: DeletedApplicationDoc[] = docs.map((doc) => {
    const { _id, ...rest } = doc;
    return {
      ...rest,
      _id: new ObjectId(),
      originalApplicationId: _id as ObjectId,
      deletedAt: now,
      deletedBy,
      deletedByKind,
      schoolSlug: schoolSlug ?? null,
      schoolName: schoolName ?? null,
    };
  });

  await trash.insertMany(backupDocs);
  const ids = docs.map((d) => d._id as ObjectId);
  await apps.deleteMany({ _id: { $in: ids }, schoolId });

  return {
    deletedCount: docs.length,
    deletedIds: ids.map((id) => id.toHexString()),
  };
}

export async function restoreDeletedApplications(opts: {
  db: Db;
  deletedIds: ObjectId[];
}): Promise<{ restoredCount: number; restoredIds: string[]; errors: string[] }> {
  const { db, deletedIds } = opts;
  await ensureDeletedApplicationIndexes(db);
  const apps = applicationsCollection(db);
  const trash = deletedApplicationsCollection(db);

  const docs = await trash.find({ _id: { $in: deletedIds } }).toArray();
  const restoredIds: string[] = [];
  const errors: string[] = [];

  for (const doc of docs) {
    const {
      _id: trashId,
      originalApplicationId,
      deletedAt: _deletedAt,
      deletedBy: _deletedBy,
      deletedByKind: _deletedByKind,
      schoolSlug: _schoolSlug,
      schoolName: _schoolName,
      ...applicationFields
    } = doc;

    const restoreDoc: ApplicationDoc = {
      ...applicationFields,
      _id: originalApplicationId,
      updatedAt: new Date(),
    };

    try {
      // Prefer original id; if a conflicting doc exists, fall back to a new id
      const existing = await apps.findOne({ _id: originalApplicationId });
      if (existing) {
        restoreDoc._id = new ObjectId();
      }
      await apps.insertOne(restoreDoc);
      await trash.deleteOne({ _id: trashId });
      restoredIds.push(String(restoreDoc._id));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to restore application";
      errors.push(
        `${doc.applicationNumber || String(originalApplicationId)}: ${message}`,
      );
    }
  }

  return {
    restoredCount: restoredIds.length,
    restoredIds,
    errors,
  };
}

export function serializeDeletedApplication(doc: DeletedApplicationDoc) {
  const base = serializeApplication({
    ...doc,
    _id: doc.originalApplicationId,
  });
  return {
    ...base,
    deletedRecordId: String(doc._id),
    originalApplicationId: String(doc.originalApplicationId),
    deletedAt:
      doc.deletedAt instanceof Date
        ? doc.deletedAt.toISOString()
        : new Date().toISOString(),
    deletedBy: doc.deletedBy,
    deletedByKind: doc.deletedByKind,
    schoolSlug: doc.schoolSlug ?? null,
    schoolName: doc.schoolName ?? null,
  };
}

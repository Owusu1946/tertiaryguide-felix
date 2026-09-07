import { ObjectId, type Db } from "mongodb";
import type {
  ApplicationDoc,
  ApplicationStatus,
  EducationalBackground,
  ExamResult,
  GuardianInfo,
  PersonalInfo,
  ProgrammeChoices,
  ExaminationInfo,
  ExaminationSitting,
  UploadedDocuments,
} from "./types";
import { APPLICATION_STATUSES } from "./types";
import {
  legacyProgrammeFallback,
  listProgrammeChoices,
} from "./programme-choices";

export function applicationsCollection(db: Db) {
  return db.collection<ApplicationDoc>("applications");
}

export async function ensureApplicationIndexes(db: Db): Promise<void> {
  const apps = applicationsCollection(db);

  // Legacy applications stored `reference` instead of `applicationNumber`.
  // A unique index on applicationNumber cannot be built while several docs
  // share a missing/null value, which previously 500'd every submit.
  try {
    await apps.updateMany(
      {
        $or: [
          { applicationNumber: { $exists: false } },
          { applicationNumber: { $type: "null" } },
        ],
        reference: { $type: "string" },
      },
      [{ $set: { applicationNumber: "$reference" } }],
    );
  } catch (error) {
    console.error("[applications] backfill applicationNumber", error);
  }

  const specs: Array<[Record<string, 1 | -1>, Record<string, unknown>?]> = [
    [{ applicationNumber: 1 }, { unique: true, sparse: true }],
    [{ schoolId: 1, submittedAt: -1 }],
    [{ schoolId: 1, status: 1 }],
    [{ applicantEmail: 1, schoolId: 1 }],
  ];
  for (const [keys, options] of specs) {
    try {
      await apps.createIndex(keys, options as { unique?: boolean; sparse?: boolean });
    } catch (error) {
      console.error("[applications] createIndex", keys, error);
    }
  }
}

async function nextApplicationSequence(db: Db, schoolSlug: string): Promise<number> {
  const counters = db.collection<{ _id: string; seq: number }>("counters");
  const year = new Date().getFullYear();
  const key = `app_${schoolSlug}_${year}`;
  const result = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const doc =
    result && typeof result === "object" && "seq" in result
      ? result
      : (result as { value?: { seq: number } } | null)?.value;
  const seq = doc?.seq;
  return typeof seq === "number" && Number.isFinite(seq) ? seq : 1;
}

export async function generateApplicationNumber(
  db: Db,
  schoolSlug: string,
): Promise<string> {
  const slug = (schoolSlug || "TG").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "TG";
  const year = new Date().getFullYear();
  const seq = await nextApplicationSequence(db, slug.toLowerCase());
  return `${slug}-${year}-${String(seq).padStart(5, "0")}`;
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function serializeApplication(doc: ApplicationDoc) {
  const personal = doc.personalInfo;
  const fullName = [personal?.firstName, personal?.middleName, personal?.surname]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const programmes = listProgrammeChoices(
    doc.programmeChoices,
    legacyProgrammeFallback(doc as ApplicationDoc & { programmeChoice?: unknown }),
  );

  return {
    id: String(doc._id),
    applicationNumber: doc.applicationNumber,
    schoolId: String(doc.schoolId),
    applicantEmail: doc.applicantEmail,
    status: doc.status,
    fullName: fullName || personal?.surname || "Applicant",
    phone: personal?.phoneNumber ?? null,
    email: personal?.email ?? doc.applicantEmail,
    programme: programmes[0]?.display ?? doc.programmeChoices?.firstChoice ?? null,
    programmes,
    personalInfo: doc.personalInfo,
    guardianInfo: doc.guardianInfo ?? null,
    programmeChoices: doc.programmeChoices ?? null,
    educationalBackground: doc.educationalBackground ?? [],
    examinationInfo: doc.examinationInfo ?? null,
    additionalExaminations: doc.additionalExaminations ?? [],
    examinationSittings: doc.examinationSittings ?? [],
    results: doc.results ?? [],
    documents: doc.documents ?? null,
    admittedProgramme: doc.admittedProgramme ?? null,
    admittedProgrammeStream: doc.admittedProgrammeStream ?? null,
    offerResponse: doc.offerResponse ?? null,
    offerRespondedAt: doc.offerRespondedAt
      ? doc.offerRespondedAt.toISOString()
      : null,
    submittedAt:
      doc.submittedAt instanceof Date
        ? doc.submittedAt.toISOString()
        : new Date().toISOString(),
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : doc.submittedAt instanceof Date
          ? doc.submittedAt.toISOString()
          : new Date().toISOString(),
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    reviewedBy: doc.reviewedBy ?? null,
    reviewNotes: doc.reviewNotes ?? null,
  };
}

export function parsePersonalInfo(raw: unknown): PersonalInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const surname = typeof body.surname === "string" ? body.surname.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!surname || !firstName || !phoneNumber || !email) return null;

  return {
    title: typeof body.title === "string" ? body.title.trim() : undefined,
    surname,
    firstName,
    middleName: typeof body.middleName === "string" ? body.middleName.trim() : undefined,
    gender: typeof body.gender === "string" ? body.gender.trim() : undefined,
    dateOfBirth: typeof body.dateOfBirth === "string" ? body.dateOfBirth.trim() : undefined,
    maritalStatus: typeof body.maritalStatus === "string" ? body.maritalStatus.trim() : undefined,
    homeRegion: typeof body.homeRegion === "string" ? body.homeRegion.trim() : undefined,
    homeCountry: typeof body.homeCountry === "string" ? body.homeCountry.trim() : undefined,
    nationality: typeof body.nationality === "string" ? body.nationality.trim() : undefined,
    occupation: typeof body.occupation === "string" ? body.occupation.trim() : undefined,
    phoneNumber,
    email,
    postalAddress: typeof body.postalAddress === "string" ? body.postalAddress.trim() : undefined,
    residentialAddress:
      typeof body.residentialAddress === "string" ? body.residentialAddress.trim() : undefined,
    passportPhoto: typeof body.passportPhoto === "string" ? body.passportPhoto.trim() : undefined,
  };
}

export function parseGuardianInfo(raw: unknown): GuardianInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const body = raw as Record<string, unknown>;
  const residentialAddress =
    typeof body.residentialAddress === "string"
      ? body.residentialAddress.trim()
      : typeof body.address === "string"
        ? body.address.trim()
        : undefined;
  return {
    guardianName: typeof body.guardianName === "string" ? body.guardianName.trim() : undefined,
    guardianTitle: typeof body.guardianTitle === "string" ? body.guardianTitle.trim() : undefined,
    relationship: typeof body.relationship === "string" ? body.relationship.trim() : undefined,
    occupation: typeof body.occupation === "string" ? body.occupation.trim() : undefined,
    phoneNumber: typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : undefined,
    alternativePhone:
      typeof body.alternativePhone === "string" ? body.alternativePhone.trim() : undefined,
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined,
    address: residentialAddress,
    residentialAddress,
    postalAddress: typeof body.postalAddress === "string" ? body.postalAddress.trim() : undefined,
    nationality: typeof body.nationality === "string" ? body.nationality.trim() : undefined,
  };
}

function optionalTrimmed(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function parseProgrammeChoices(raw: unknown): ProgrammeChoices | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const body = raw as Record<string, unknown>;
  return {
    firstChoice: optionalTrimmed(body, "firstChoice"),
    secondChoice: optionalTrimmed(body, "secondChoice"),
    thirdChoice: optionalTrimmed(body, "thirdChoice"),
    fourthChoice: optionalTrimmed(body, "fourthChoice"),
    firstChoiceProgramme: optionalTrimmed(body, "firstChoiceProgramme"),
    firstChoiceStream: optionalTrimmed(body, "firstChoiceStream"),
    secondChoiceProgramme: optionalTrimmed(body, "secondChoiceProgramme"),
    secondChoiceStream: optionalTrimmed(body, "secondChoiceStream"),
    thirdChoiceProgramme: optionalTrimmed(body, "thirdChoiceProgramme"),
    thirdChoiceStream: optionalTrimmed(body, "thirdChoiceStream"),
    fourthChoiceProgramme: optionalTrimmed(body, "fourthChoiceProgramme"),
    fourthChoiceStream: optionalTrimmed(body, "fourthChoiceStream"),
  };
}

export function parseEducationalBackground(raw: unknown): EducationalBackground[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((body) => ({
      institutionName: optionalTrimmed(body, "institutionName"),
      institutionType: optionalTrimmed(body, "institutionType"),
      programmePursued: optionalTrimmed(body, "programmePursued"),
      startDate: optionalTrimmed(body, "startDate"),
      endDate: optionalTrimmed(body, "endDate"),
      country: optionalTrimmed(body, "country"),
      region: optionalTrimmed(body, "region"),
    }));
}

export function parseExaminationInfo(raw: unknown): ExaminationInfo | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const body = raw as Record<string, unknown>;
  return {
    examType: optionalTrimmed(body, "examType"),
    examBody: optionalTrimmed(body, "examBody"),
    sitting: optionalTrimmed(body, "sitting"),
    examYear: optionalTrimmed(body, "examYear"),
    indexNumber: optionalTrimmed(body, "indexNumber"),
    candidateNumber: optionalTrimmed(body, "candidateNumber"),
    examinationCentre: optionalTrimmed(body, "examinationCentre"),
    institutionName: optionalTrimmed(body, "institutionName"),
  };
}

export function parseAdditionalExaminations(raw: unknown): ExaminationInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => parseExaminationInfo(item))
    .filter((item): item is ExaminationInfo => Boolean(item))
    .filter(
      (item) =>
        item.examYear ||
        item.indexNumber ||
        item.candidateNumber ||
        item.examinationCentre,
    );
}

export function parseExaminationSittings(raw: unknown): ExaminationSitting[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((body) => ({
      ...(parseExaminationInfo(body) || {}),
      results: parseResults(body.results),
    }))
    .filter(
      (item) =>
        item.examYear ||
        item.indexNumber ||
        item.candidateNumber ||
        item.examinationCentre ||
        (item.results && item.results.length > 0),
    );
}

export function parseResults(raw: unknown): ExamResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((body) => ({
      subject: typeof body.subject === "string" ? body.subject.trim() : "",
      grade: typeof body.grade === "string" ? body.grade.trim() : "",
    }))
    .filter((r) => r.subject && r.grade);
}

export function parseDocuments(raw: unknown): UploadedDocuments | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const body = raw as Record<string, unknown>;
  return {
    passportPhoto: typeof body.passportPhoto === "string" ? body.passportPhoto.trim() : undefined,
    resultSlip: typeof body.resultSlip === "string" ? body.resultSlip.trim() : undefined,
    birthCertificate:
      typeof body.birthCertificate === "string" ? body.birthCertificate.trim() : undefined,
    nationalId: typeof body.nationalId === "string" ? body.nationalId.trim() : undefined,
    transcript: typeof body.transcript === "string" ? body.transcript.trim() : undefined,
  };
}

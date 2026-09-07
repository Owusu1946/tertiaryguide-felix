import type { RankedProgrammeChoice } from "@/lib/admissions/programme-choices";

export type ApplicationSummaryDetail = {
  applicationNumber?: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
  status?: string;
  submittedAt?: string | null;
  updatedAt?: string | null;
  reviewNotes?: string | null;
  admittedProgramme?: string | null;
  admittedProgrammeStream?: string | null;
  offerResponse?: "accepted" | "declined" | null;
  personalInfo?: Record<string, string | undefined> | null;
  guardianInfo?: Record<string, string | undefined> | null;
  programmeChoices?: Record<string, string | undefined> | null;
  programmes?: RankedProgrammeChoice[];
  educationalBackground?: Record<string, string | undefined>[];
  examinationInfo?: Record<string, string | undefined> | null;
  additionalExaminations?: Record<string, string | undefined>[] | null;
  examinationSittings?: Array<
    Record<string, string | undefined> & {
      results?: { subject: string; grade: string }[];
    }
  > | null;
  results?: { subject: string; grade: string }[];
  documents?: Record<string, string | undefined> | null;
};

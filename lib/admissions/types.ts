import type { ObjectId } from "mongodb";
import type { ProgrammeLevel } from "./programme-level";

/** Platform staff + school tenant roles. Existing admin/superadmin kept for compatibility. */
export const PLATFORM_ROLES = ["admin", "superadmin"] as const;
export const SCHOOL_ADMIN_ROLE = "school_admin" as const;
export const APPLICANT_ROLE = "applicant" as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type SchoolAdminRole = typeof SCHOOL_ADMIN_ROLE;
export type ApplicantRole = typeof APPLICANT_ROLE;

export type UserRole = PlatformRole | SchoolAdminRole | ApplicantRole | string;

export const APPLICATION_STATUSES = [
  "Pending",
  "Under Review",
  "Approved",
  "Rejected",
  "Admitted",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type PartnerSchoolFields = {
  slug: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  admissionFee?: number | null;
  voucherPrice?: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  requiresVoucher: boolean;
  isActive: boolean;
  /** When true, school appears on /apply and has a school admin portal. */
  isPartner: boolean;
};

export type SchoolDoc = {
  _id?: ObjectId;
  name: string;
  alias?: string | null;
  slug?: string | null;
  logoSrc?: string | null;
  logoAlt?: string | null;
  priceGhs?: number | null;
  deadline?: Date | null;
  createdAt: Date;
  updatedAt?: Date;
  about?: string | null;
  preRequisite?: string | null;
  durationYears?: number | null;
  isVerified?: boolean;
  category?: string | null;
  categories?: string[] | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  admissionFee?: number | null;
  voucherPrice?: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  requiresVoucher?: boolean;
  isActive?: boolean;
  isPartner?: boolean;
  /** School brand accent used across admin + applicant portals. */
  brandColor?: string | null;
  /** Up to 4 school brand colors blended into the portal theme. */
  brandColors?: string[] | null;
  /**
   * Platform admin / superadmin only. When true, this partner school's
   * published posts may appear on the TertiaryGuide homepage and main /blog.
   * School-scoped blog always shows the school's own posts.
   */
  showBlogOnMain?: boolean;
};

export type AdmissionVoucherDoc = {
  _id?: ObjectId;
  schoolId: ObjectId;
  voucherCode: string;
  serialNumber: string;
  amount: number;
  programmeLevel?: ProgrammeLevel;
  /** Email of the buyer at purchase time. */
  purchasedBy?: string | null;
  isUsed: boolean;
  usedBy?: string | null;
  usedAt?: Date | null;
  paymentReference?: string | null;
  /** active = can log in; used = application submitted (still reusable for login); revoked = blocked */
  status: "active" | "used" | "revoked";
  createdAt: Date;
};

export type AdmissionPaymentDoc = {
  _id?: ObjectId;
  schoolId: ObjectId;
  reference: string;
  email: string;
  fullName?: string | null;
  amount: number;
  currency: string;
  status: string;
  product: "partner_voucher" | "admission_fee";
  programmeLevel?: ProgrammeLevel;
  voucherId?: ObjectId | null;
  paidAt?: Date | null;
  emailSentAt?: Date | null;
  emailError?: string | null;
  createdAt: Date;
};

export type PersonalInfo = {
  title?: string;
  surname: string;
  firstName: string;
  middleName?: string;
  gender?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  homeRegion?: string;
  homeCountry?: string;
  nationality?: string;
  occupation?: string;
  phoneNumber: string;
  email: string;
  postalAddress?: string;
  residentialAddress?: string;
  passportPhoto?: string;
};

export type GuardianInfo = {
  guardianName?: string;
  guardianTitle?: string;
  relationship?: string;
  occupation?: string;
  phoneNumber?: string;
  alternativePhone?: string;
  email?: string;
  /** @deprecated Prefer residentialAddress */
  address?: string;
  residentialAddress?: string;
  postalAddress?: string;
  nationality?: string;
};

export type ProgrammeChoices = {
  firstChoice?: string;
  secondChoice?: string;
  thirdChoice?: string;
  fourthChoice?: string;
  firstChoiceProgramme?: string;
  firstChoiceStream?: string;
  secondChoiceProgramme?: string;
  secondChoiceStream?: string;
  thirdChoiceProgramme?: string;
  thirdChoiceStream?: string;
  fourthChoiceProgramme?: string;
  fourthChoiceStream?: string;
};

export type EducationalBackground = {
  institutionName?: string;
  institutionType?: string;
  programmePursued?: string;
  startDate?: string;
  endDate?: string;
  country?: string;
  region?: string;
};

export type ExamResult = {
  subject: string;
  grade: string;
};

export type ExaminationInfo = {
  examType?: string;
  examBody?: string;
  sitting?: string;
  examYear?: string;
  indexNumber?: string;
  candidateNumber?: string;
  examinationCentre?: string;
  institutionName?: string;
};

export type ExaminationSitting = ExaminationInfo & {
  results?: ExamResult[];
};

export type UploadedDocuments = {
  passportPhoto?: string;
  resultSlip?: string;
  birthCertificate?: string;
  nationalId?: string;
  transcript?: string;
};

export type ApplicationDoc = {
  _id?: ObjectId;
  applicationNumber: string;
  /** Legacy unique key; kept in sync with applicationNumber. */
  reference?: string;
  schoolId: ObjectId;
  applicantUserId?: ObjectId | null;
  applicantEmail: string;
  voucherId?: ObjectId | null;
  status: ApplicationStatus;
  personalInfo: PersonalInfo;
  guardianInfo?: GuardianInfo;
  programmeChoices?: ProgrammeChoices;
  educationalBackground?: EducationalBackground[];
  examinationInfo?: ExaminationInfo;
  additionalExaminations?: ExaminationInfo[];
  examinationSittings?: ExaminationSitting[];
  results?: ExamResult[];
  documents?: UploadedDocuments;
  /** Programme the school assigned when admitting the student. */
  admittedProgramme?: string | null;
  admittedProgrammeStream?: string | null;
  /** Student response to an admission offer. */
  offerResponse?: "accepted" | "declined" | null;
  offerRespondedAt?: Date | null;
  submittedAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
};

export type SchoolAdminUser = {
  _id: ObjectId;
  username: string;
  email?: string;
  role: SchoolAdminRole;
  schoolId: ObjectId;
  createdAt?: Date;
  lastLoginAt?: Date;
};

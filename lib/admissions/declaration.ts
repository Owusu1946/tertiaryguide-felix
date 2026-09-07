export const DECLARATION_IMPORTANT_HEADING = "IMPORTANT";
export const DECLARATION_IMPORTANT_BODY =
  "AN APPLICANT WHO MAKES A FALSE STATEMENT OR WITHHOLDS RELEVANT INFORMATION MAY BE REFUSED ADMISSION. IF HE HAS ALREADY COME INTO THE UNIVERSITY, HE WILL BE WITHDRAWN.";
export const DECLARATION_HEADING = "DECLARATION";
export const DECLARATION_NAME_HINT =
  "(Exact name and arrangement on my certificate/result slip)";

export const DECLARATION_CERTIFY =
  "I certify that the information provided by me is correct, accurate, and genuine, and I will bear any consequences for any invalid information provided.";

export const DECLARATION_FALSEHOOD =
  "I understand that any false or misleading information, document or submission in this application shall render it invalid; if the falsity is detected after admission, I shall be dismissed.";

export const DECLARATION_NAME_CLOSING =
  "certify that the information provided are valid and will be held personally responsible for its authenticity and will bear any consequences for any invalid information provided";

export const DECLARATION_PERMISSION_BEFORE =
  "I understand that by submitting this application, I give ";
export const DECLARATION_PERMISSION_AFTER =
  " permission to validate the authenticity of the information including academic records and other mandatory documents provided.";

export function certificateNameOrder(personal?: {
  title?: string | null;
  surname?: string | null;
  firstName?: string | null;
  middleName?: string | null;
} | null) {
  return [personal?.title, personal?.surname, personal?.firstName, personal?.middleName]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function declarationSchoolLabel(schoolName: string) {
  return schoolName.trim() || "the University";
}

export function declarationPermissionText(schoolName: string) {
  return `${DECLARATION_PERMISSION_BEFORE}${declarationSchoolLabel(schoolName)}${DECLARATION_PERMISSION_AFTER}`;
}

/** Final signed line, e.g. "I, MR. ANNOBIL BARACK JOJO (Exact name…) certify that…" */
export function declarationSignedSentence(certificateName: string) {
  const name =
    certificateName.trim().toUpperCase() ||
    "[YOUR FULL NAME AS ON CERTIFICATE]";
  return `I, ${name} ${DECLARATION_NAME_HINT} ${DECLARATION_NAME_CLOSING}`;
}

export function declarationSignedParts(certificateName: string) {
  const name =
    certificateName.trim().toUpperCase() ||
    "[YOUR FULL NAME AS ON CERTIFICATE]";
  return {
    before: "I, ",
    name,
    hint: DECLARATION_NAME_HINT,
    after: ` ${DECLARATION_NAME_CLOSING}`,
  };
}

export function declarationParagraphs(schoolName: string) {
  return [
    DECLARATION_CERTIFY,
    declarationPermissionText(schoolName),
    DECLARATION_FALSEHOOD,
  ] as const;
}

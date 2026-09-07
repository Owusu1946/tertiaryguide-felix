"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  APPLICATION_TABS,
  CORE_SUBJECTS,
  COUNTRIES,
  ELECTIVE_SUBJECTS,
  EXAM_BODIES,
  EXAM_TYPES,
  GENDERS,
  GHANA_REGIONS,
  GHANA_SHS_SCHOOLS,
  GUARDIAN_TITLES,
  INSTITUTION_TYPES,
  MARITAL_STATUSES,
  MONTHS,
  NATIONALITIES,
  OCCUPATIONS,
  RELATIONSHIPS,
  SHS_PROGRAMMES,
  SITTING_TYPES,
  TITLES,
  WASSCE_GRADES,
  daysInMonth,
  yearOptions,
  type ApplicationTabId,
} from "@/lib/admissions/form-options";
import {
  dobToIso,
  emptyApplicationForm,
  emptyEducation,
  emptyExamSitting,
  examSittingLabel,
  fieldErrorsFromZod,
  flattenExamResults,
  formStateFromApplication,
  MAX_EXAM_SITTINGS,
  MAX_INSTITUTIONS,
  normalizeApplicationForm,
  tabSchemas,
  validateExamResults,
  type ApplicationFormState,
  type EducationalBackgroundForm,
  type ExaminationInfoForm,
  type ExaminationSittingForm,
} from "@/lib/admissions/form-schema";
import {
  readApplySession,
  writeApplySession,
} from "@/lib/admissions/applicant-session";
import { Field, FormCard, FormNotice, FormSection, SearchableSelect, TextInput, TextSelect } from "./FormControls";
import { FileDropzone } from "./FileDropzone";
import {
  ApplicationPrintout,
  downloadApplicationPrintout,
  printoutFromForm,
} from "@/app/components/ApplicationPrintout";
import {
  DECLARATION_CERTIFY,
  DECLARATION_FALSEHOOD,
  DECLARATION_HEADING,
  DECLARATION_IMPORTANT_BODY,
  DECLARATION_IMPORTANT_HEADING,
  DECLARATION_PERMISSION_AFTER,
  DECLARATION_PERMISSION_BEFORE,
  certificateNameOrder,
  declarationSchoolLabel,
  declarationSignedParts,
} from "@/lib/admissions/declaration";

type ProgrammeOption = {
  id: string;
  name: string;
  streams: string[];
};

type Props = {
  schoolId: string;
  schoolName: string;
  schoolSlug?: string | null;
  schoolLogo?: string | null;
  brandColor?: string | null;
  brandColors?: string[] | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  schoolAddress?: string | null;
  voucherCode?: string;
  serialNumber?: string;
  loginEmail?: string;
  loginPassword?: string;
  initialEmail?: string;
  onSubmitted: (result: {
    applicationNumber: string;
    schoolName: string;
    updated?: boolean;
    printout: ReturnType<typeof printoutFromForm>;
  }) => void;
};

const LOCAL_DRAFT_PREFIX = "tg_application_draft_";

function localDraftKey(schoolId: string, voucherCode?: string, serialNumber?: string) {
  const id =
    voucherCode && serialNumber
      ? `${schoolId}:${voucherCode}:${serialNumber}`
      : schoolId;
  return `${LOCAL_DRAFT_PREFIX}${id}`;
}

function sittingLabel(sitting: string) {
  return sitting === "Nov/Dec" ? "Nov/Dec (NOVDEC)" : sitting;
}

function ExaminationSittingFields({
  exam,
  errorPrefix,
  errors,
  onChange,
}: {
  exam: ExaminationInfoForm;
  errorPrefix: string;
  errors: Record<string, string>;
  onChange: (
    key: keyof ExaminationInfoForm,
    value: ExaminationInfoForm[keyof ExaminationInfoForm],
  ) => void;
}) {
  const err = (key: string) => errors[`${errorPrefix}.${key}`];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Examination type" required error={err("examType")}>
        <TextSelect
          value={exam.examType}
          onChange={(e) =>
            onChange("examType", e.target.value as ExaminationInfoForm["examType"])
          }
        >
          {EXAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </TextSelect>
      </Field>
      <Field label="Examination body" required error={err("examBody")}>
        <TextSelect
          value={exam.examBody}
          onChange={(e) =>
            onChange("examBody", e.target.value as ExaminationInfoForm["examBody"])
          }
        >
          {EXAM_BODIES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </TextSelect>
      </Field>
      <Field label="Sitting type" required error={err("sitting")}>
        <TextSelect
          value={exam.sitting}
          onChange={(e) =>
            onChange("sitting", e.target.value as ExaminationInfoForm["sitting"])
          }
        >
          {SITTING_TYPES.map((s) => (
            <option key={s} value={s}>
              {sittingLabel(s)}
            </option>
          ))}
        </TextSelect>
      </Field>
      <Field label="Examination year" required error={err("examYear")}>
        <TextSelect
          value={exam.examYear}
          onChange={(e) => onChange("examYear", e.target.value)}
        >
          <option value="">Select year</option>
          {yearOptions(30, 0).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </TextSelect>
      </Field>
      <Field label="Index number" required error={err("indexNumber")}>
        <TextInput
          value={exam.indexNumber}
          onChange={(e) => onChange("indexNumber", e.target.value)}
        />
      </Field>
      <Field label="Candidate number" required error={err("candidateNumber")}>
        <TextInput
          value={exam.candidateNumber}
          onChange={(e) => onChange("candidateNumber", e.target.value)}
        />
      </Field>
      <Field
        label="Examination centre"
        required
        error={err("examinationCentre")}
        className="sm:col-span-2"
      >
        <TextInput
          value={exam.examinationCentre}
          onChange={(e) => onChange("examinationCentre", e.target.value)}
        />
      </Field>
    </div>
  );
}

function InstitutionFields({
  education,
  errorPrefix,
  errors,
  onChange,
}: {
  education: EducationalBackgroundForm;
  errorPrefix: string;
  errors: Record<string, string>;
  onChange: <K extends keyof EducationalBackgroundForm>(
    key: K,
    value: EducationalBackgroundForm[K],
  ) => void;
}) {
  const err = (key: string) =>
    errors[`${errorPrefix}.${key}`] || (errorPrefix === "0" ? errors[key] : undefined);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Institution name"
        required
        error={err("institutionName")}
        className="sm:col-span-2"
      >
        <SearchableSelect
          options={GHANA_SHS_SCHOOLS}
          value={education.institutionName}
          onChange={(v) => onChange("institutionName", v)}
          placeholder="Search SHS…"
          allowOther
          error={!!err("institutionName")}
        />
      </Field>
      <Field label="Institution type" required error={err("institutionType")}>
        <TextSelect
          value={education.institutionType}
          onChange={(e) =>
            onChange(
              "institutionType",
              e.target.value as EducationalBackgroundForm["institutionType"],
            )
          }
        >
          {INSTITUTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </TextSelect>
      </Field>
      <Field label="Programme pursued" required error={err("programmePursued")}>
        <TextSelect
          value={education.programmePursued}
          onChange={(e) =>
            onChange(
              "programmePursued",
              e.target.value as EducationalBackgroundForm["programmePursued"],
            )
          }
        >
          {SHS_PROGRAMMES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </TextSelect>
      </Field>
      <Field label="Start date" required error={err("startDate")}>
        <TextInput
          type="date"
          value={education.startDate}
          onChange={(e) => onChange("startDate", e.target.value)}
        />
      </Field>
      <Field label="End date" required error={err("endDate")}>
        <TextInput
          type="date"
          value={education.endDate}
          onChange={(e) => onChange("endDate", e.target.value)}
        />
      </Field>
      <Field label="Country of institution" required error={err("country")}>
        <TextSelect
          value={education.country}
          onChange={(e) =>
            onChange("country", e.target.value as EducationalBackgroundForm["country"])
          }
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </TextSelect>
      </Field>
      <Field label="Region of institution" required error={err("region")}>
        <TextSelect
          value={education.region}
          onChange={(e) =>
            onChange("region", e.target.value as EducationalBackgroundForm["region"])
          }
        >
          {GHANA_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </TextSelect>
      </Field>
    </div>
  );
}

export function MultiStepApplicationForm({
  schoolId,
  schoolName,
  schoolSlug,
  schoolLogo,
  brandColor,
  brandColors,
  schoolPhone,
  schoolEmail,
  schoolAddress,
  voucherCode: voucherCodeProp,
  serialNumber: serialNumberProp,
  loginEmail,
  loginPassword,
  initialEmail,
  onSubmitted,
}: Props) {
  const [credentials, setCredentials] = useState(() => {
    const saved = readApplySession(schoolId);
    return {
      voucherCode: (voucherCodeProp || saved?.voucherCode || "").trim().toUpperCase(),
      serialNumber: (serialNumberProp || saved?.serialNumber || "")
        .trim()
        .toUpperCase(),
    };
  });

  const [form, setForm] = useState<ApplicationFormState>(() => {
    const base = emptyApplicationForm();
    if (initialEmail) base.personal.email = initialEmail;
    return base;
  });
  const [tab, setTab] = useState<ApplicationTabId>("personal");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [existingApplicationNumber, setExistingApplicationNumber] = useState<
    string | null
  >(null);

  const formRef = React.useRef(form);
  const tabRef = React.useRef(tab);
  formRef.current = form;
  tabRef.current = tab;

  const tabIndex = APPLICATION_TABS.findIndex((t) => t.id === tab);
  const voucherCode = credentials.voucherCode;
  const serialNumber = credentials.serialNumber;

  useEffect(() => {
    const saved = readApplySession(schoolId);
    const nextCode = (voucherCodeProp || saved?.voucherCode || "")
      .trim()
      .toUpperCase();
    const nextSerial = (serialNumberProp || saved?.serialNumber || "")
      .trim()
      .toUpperCase();
    if (!nextCode || !nextSerial) return;
    setCredentials({ voucherCode: nextCode, serialNumber: nextSerial });
    writeApplySession({
      schoolId,
      schoolSlug,
      voucherCode: nextCode,
      serialNumber: nextSerial,
      email: initialEmail,
    });
  }, [schoolId, schoolSlug, voucherCodeProp, serialNumberProp, initialEmail]);

  useEffect(() => {
    void fetch(`/api/apply/programmes?schoolId=${encodeURIComponent(schoolId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.programmes) setProgrammes(data.programmes);
      })
      .catch(() => undefined);
  }, [schoolId]);

  const mergeDraft = useCallback(
    (draftForm: Parameters<typeof normalizeApplicationForm>[0], currentTab?: string) => {
      setForm((prev) =>
        normalizeApplicationForm({
          ...prev,
          ...draftForm,
          personal: { ...prev.personal, ...(draftForm?.personal || {}) },
          guardian: { ...prev.guardian, ...(draftForm?.guardian || {}) },
          programme: { ...prev.programme, ...(draftForm?.programme || {}) },
          documents: { ...prev.documents, ...(draftForm?.documents || {}) },
        }),
      );
      if (currentTab) setTab(currentTab as ApplicationTabId);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      let loadedApplication = false;
      if (voucherCode && serialNumber) {
        try {
          const res = await fetch("/api/apply/voucher/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ schoolId, voucherCode, serialNumber }),
          });
          const data = await res.json();
          if (!cancelled && res.ok && data.application) {
            mergeDraft(formStateFromApplication(data.application));
            setExistingApplicationNumber(
              data.application.applicationNumber || null,
            );
            setDraftMsg("Your application details were loaded");
            loadedApplication = true;
          }
        } catch {
          // ignore
        }
      }

      try {
        const localRaw = window.localStorage.getItem(
          localDraftKey(schoolId, voucherCode || undefined, serialNumber || undefined),
        );
        if (localRaw) {
          const parsed = JSON.parse(localRaw) as {
            formData?: ApplicationFormState;
            currentTab?: string;
          };
          if (parsed.formData && !cancelled) {
            mergeDraft(parsed.formData, parsed.currentTab);
            setDraftMsg("Progress restored");
          }
        }
      } catch {
        // ignore
      }

      if (!loadedApplication && voucherCode && serialNumber) {
        try {
          const res = await fetch(
            `/api/apply/draft?schoolId=${encodeURIComponent(schoolId)}&voucherCode=${encodeURIComponent(voucherCode)}&serialNumber=${encodeURIComponent(serialNumber)}`,
          );
          const data = await res.json();
          if (!cancelled && data.draft?.formData) {
            mergeDraft(data.draft.formData, data.draft.currentTab);
            setDraftMsg("Draft restored");
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) setDraftReady(true);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [schoolId, voucherCode, serialNumber, mergeDraft]);

  const saveDraft = useCallback(
    async (opts?: { silent?: boolean }) => {
      const currentForm = formRef.current;
      const currentTab = tabRef.current;

      try {
        window.localStorage.setItem(
          localDraftKey(schoolId, voucherCode || undefined, serialNumber || undefined),
          JSON.stringify({
            formData: currentForm,
            currentTab,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // ignore quota errors
      }

      if (!voucherCode || !serialNumber) {
        if (!opts?.silent) {
          setDraftMsg(`Saved locally ${new Date().toLocaleTimeString()}`);
        }
        return;
      }

      if (!opts?.silent) setSavingDraft(true);
      try {
        const res = await fetch("/api/apply/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            voucherCode,
            serialNumber,
            formData: currentForm,
            currentTab,
          }),
        });
        if (res.ok) {
          setDraftMsg(`Draft saved ${new Date().toLocaleTimeString()}`);
        }
      } finally {
        if (!opts?.silent) setSavingDraft(false);
      }
    },
    [schoolId, serialNumber, voucherCode],
  );

  useEffect(() => {
    if (!draftReady) return;
    void saveDraft({ silent: true });
  }, [draftReady, saveDraft]);

  useEffect(() => {
    if (!draftReady) return;
    const id = window.setTimeout(() => {
      void saveDraft({ silent: true });
    }, 2000);
    return () => window.clearTimeout(id);
  }, [form, tab, draftReady, saveDraft]);

  useEffect(() => {
    if (!draftReady) return;
    const id = window.setInterval(() => {
      void saveDraft({ silent: true });
    }, 30000);
    return () => window.clearInterval(id);
  }, [draftReady, saveDraft]);

  const years = useMemo(() => yearOptions(70, 14), []);
  const dayCount = daysInMonth(
    form.personal.dateOfBirthMonth,
    form.personal.dateOfBirthYear,
  );

  const streamsFor = (programmeName: string) => {
    const found = programmes.find((p) => p.name === programmeName);
    return found?.streams ?? [];
  };

  const validateTab = (id: ApplicationTabId): boolean => {
    const schema = tabSchemas[id];
    let payload: unknown = null;
    if (id === "personal") payload = form.personal;
    if (id === "guardian") payload = form.guardian;
    if (id === "programme") payload = form.programme;
    if (id === "education") payload = form.educations;
    if (id === "examination") {
      payload = {
        educations: form.educations,
        examSittings: form.examSittings,
      };
    }
    if (id === "results") {
      const resultErrors = validateExamResults(form.examSittings);
      if (Object.keys(resultErrors).length) {
        setErrors(resultErrors);
        return false;
      }
      setErrors({});
      return true;
    }
    if (id === "documents") payload = form.documents;
    if (id === "review") payload = { declarationAccepted: form.declarationAccepted };

    const result = schema.safeParse(payload);
    if (!result.success) {
      setErrors(fieldErrorsFromZod(result.error));
      return false;
    }
    setErrors({});
    return true;
  };

  const goNext = () => {
    if (!validateTab(tab)) return;
    const next = APPLICATION_TABS[tabIndex + 1];
    if (next) setTab(next.id);
    void saveDraft();
  };

  const goPrev = () => {
    const prev = APPLICATION_TABS[tabIndex - 1];
    if (prev) setTab(prev.id);
  };

  const submit = async () => {
    for (const t of APPLICATION_TABS) {
      if (!validateTab(t.id)) {
        setTab(t.id);
        return;
      }
    }

    const saved = readApplySession(schoolId);
    const finalCode = (
      voucherCode ||
      voucherCodeProp ||
      saved?.voucherCode ||
      ""
    )
      .trim()
      .toUpperCase();
    const finalSerial = (
      serialNumber ||
      serialNumberProp ||
      saved?.serialNumber ||
      ""
    )
      .trim()
      .toUpperCase();

    if (!finalCode || !finalSerial) {
      setSubmitError(
        "Your voucher session expired. Please log in again with your Serial Number and PIN.",
      );
      return;
    }

    setCredentials({ voucherCode: finalCode, serialNumber: finalSerial });
    writeApplySession({
      schoolId,
      schoolSlug,
      voucherCode: finalCode,
      serialNumber: finalSerial,
      email: form.personal.email || initialEmail,
    });

    setBusy(true);
    setSubmitError(null);
    try {
      const personal = form.personal;
      const examinationSittings = form.examSittings.map((sitting) => ({
        examType: sitting.examType,
        examBody: sitting.examBody,
        sitting: sitting.sitting,
        examYear: sitting.examYear,
        indexNumber: sitting.indexNumber,
        candidateNumber: sitting.candidateNumber,
        examinationCentre: sitting.examinationCentre,
        institutionName:
          form.educations[sitting.institutionIndex]?.institutionName || "",
        results: flattenExamResults(sitting),
      }));
      const resultsPayload = examinationSittings.flatMap(
        (sitting) => sitting.results,
      );
      const [firstSitting, ...otherSittings] = examinationSittings;

      const res = await fetch("/api/apply/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          voucherCode: finalCode,
          serialNumber: finalSerial,
          loginEmail,
          loginPassword,
          personalInfo: {
            title: personal.title,
            surname: personal.surname,
            firstName: personal.firstName,
            middleName: personal.middleName,
            gender: personal.gender,
            dateOfBirth: dobToIso(personal),
            maritalStatus: personal.maritalStatus,
            homeRegion: personal.homeRegion,
            homeCountry: personal.homeCountry,
            nationality: personal.nationality,
            occupation:
              personal.occupation === "Other"
                ? personal.occupationDescription || "Other"
                : personal.occupation,
            phoneNumber: personal.phoneNumber,
            email: personal.email,
            postalAddress: personal.postalAddress,
            residentialAddress: personal.residentialAddress,
            passportPhoto: form.documents.passportPhoto,
          },
          guardianInfo: form.guardian,
          programmeChoices: {
            firstChoice: `${form.programme.firstChoiceProgramme}${form.programme.firstChoiceStream ? ` — ${form.programme.firstChoiceStream}` : ""}`,
            secondChoice: form.programme.secondChoiceProgramme
              ? `${form.programme.secondChoiceProgramme}${form.programme.secondChoiceStream ? ` — ${form.programme.secondChoiceStream}` : ""}`
              : "",
            thirdChoice: form.programme.thirdChoiceProgramme
              ? `${form.programme.thirdChoiceProgramme}${form.programme.thirdChoiceStream ? ` — ${form.programme.thirdChoiceStream}` : ""}`
              : "",
            fourthChoice: form.programme.fourthChoiceProgramme
              ? `${form.programme.fourthChoiceProgramme}${form.programme.fourthChoiceStream ? ` — ${form.programme.fourthChoiceStream}` : ""}`
              : "",
            firstChoiceProgramme: form.programme.firstChoiceProgramme,
            firstChoiceStream: form.programme.firstChoiceStream,
            secondChoiceProgramme: form.programme.secondChoiceProgramme,
            secondChoiceStream: form.programme.secondChoiceStream,
            thirdChoiceProgramme: form.programme.thirdChoiceProgramme,
            thirdChoiceStream: form.programme.thirdChoiceStream,
            fourthChoiceProgramme: form.programme.fourthChoiceProgramme,
            fourthChoiceStream: form.programme.fourthChoiceStream,
          },
          educationalBackground: form.educations,
          examinationInfo: firstSitting,
          additionalExaminations: otherSittings,
          examinationSittings,
          results: resultsPayload,
          documents: {
            passportPhoto: form.documents.passportPhoto,
            resultSlip: form.documents.resultSlip,
            birthCertificate: form.documents.birthCertificate || undefined,
            nationalId: form.documents.nationalId,
            transcript: form.documents.sssceResultSlip || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      try {
        window.localStorage.removeItem(
          localDraftKey(schoolId, finalCode, finalSerial),
        );
      } catch {
        // ignore
      }

      onSubmitted({
        applicationNumber: data.application.applicationNumber,
        schoolName: data.application.schoolName || schoolName,
        updated: data.updated,
        printout: printoutFromForm(
          form,
          data.application.applicationNumber,
        ),
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  const setPersonal = <K extends keyof ApplicationFormState["personal"]>(
    key: K,
    value: ApplicationFormState["personal"][K],
  ) => setForm((f) => ({ ...f, personal: { ...f.personal, [key]: value } }));

  const setGuardian = <K extends keyof ApplicationFormState["guardian"]>(
    key: K,
    value: ApplicationFormState["guardian"][K],
  ) => setForm((f) => ({ ...f, guardian: { ...f.guardian, [key]: value } }));

  const setProgramme = <K extends keyof ApplicationFormState["programme"]>(
    key: K,
    value: ApplicationFormState["programme"][K],
  ) => setForm((f) => ({ ...f, programme: { ...f.programme, [key]: value } }));

  const setEducationAt = <K extends keyof EducationalBackgroundForm>(
    index: number,
    key: K,
    value: EducationalBackgroundForm[K],
  ) =>
    setForm((f) => ({
      ...f,
      educations: f.educations.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    }));

  const addInstitution = () => {
    setForm((f) => {
      if (f.educations.length >= MAX_INSTITUTIONS) return f;
      return { ...f, educations: [...f.educations, emptyEducation()] };
    });
  };

  const removeInstitution = (index: number) => {
    setForm((f) => {
      if (f.educations.length <= 1) return f;
      const educations = f.educations.filter((_, i) => i !== index);
      return {
        ...f,
        educations,
        examSittings: f.examSittings.map((sitting) => {
          if (sitting.institutionIndex === index) {
            return { ...sitting, institutionIndex: 0 };
          }
          if (sitting.institutionIndex > index) {
            return {
              ...sitting,
              institutionIndex: sitting.institutionIndex - 1,
            };
          }
          return sitting;
        }),
      };
    });
  };

  const setExamSitting = <K extends keyof ExaminationSittingForm>(
    index: number,
    key: K,
    value: ExaminationSittingForm[K],
  ) =>
    setForm((f) => ({
      ...f,
      examSittings: f.examSittings.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    }));

  const setExamSittingInfo = (
    index: number,
    key: keyof ExaminationInfoForm,
    value: ExaminationInfoForm[keyof ExaminationInfoForm],
  ) =>
    setForm((f) => ({
      ...f,
      examSittings: f.examSittings.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    }));

  const addExamSitting = () => {
    setForm((f) => {
      if (f.examSittings.length >= MAX_EXAM_SITTINGS) return f;
      const lastIndex =
        f.examSittings[f.examSittings.length - 1]?.institutionIndex ?? 0;
      return {
        ...f,
        examSittings: [
          ...f.examSittings,
          emptyExamSitting("Nov/Dec", lastIndex),
        ],
      };
    });
  };

  const removeExamSitting = (index: number) => {
    setForm((f) => {
      if (f.examSittings.length <= 1) return f;
      return {
        ...f,
        examSittings: f.examSittings.filter((_, i) => i !== index),
      };
    });
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-[#E8EEF5] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[#EEF2F7] bg-gradient-to-br from-[var(--school-brand-soft,#EFF6FF)] via-white to-white px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
                Application form
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0F172A] sm:text-xl">
                {APPLICATION_TABS[tabIndex]?.label}
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                Step {tabIndex + 1} of {APPLICATION_TABS.length} · {schoolName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={savingDraft}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-[var(--school-brand-border,#BFDBFE)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--school-brand,#007AFF)] shadow-sm transition hover:bg-[var(--school-brand-soft,#EFF6FF)] disabled:opacity-50"
            >
              {savingDraft ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save draft
            </button>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-[#E2E8F0]/70">
            <div
              className="h-full rounded-full bg-[var(--school-brand,#007AFF)] transition-all duration-300"
              style={{
                width: `${((tabIndex + 1) / APPLICATION_TABS.length) * 100}%`,
              }}
            />
          </div>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {APPLICATION_TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (i <= tabIndex || validateTab(tab)) setTab(t.id);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  t.id === tab
                    ? "bg-[var(--school-brand,#007AFF)] text-white shadow-sm"
                    : i < tabIndex
                      ? "bg-white text-[var(--school-brand,#1D4ED8)] ring-1 ring-[var(--school-brand-border,#BFDBFE)]"
                      : "bg-white/70 text-[#94A3B8] ring-1 ring-[#E2E8F0]"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                    t.id === tab
                      ? "bg-white/20 text-white"
                      : i < tabIndex
                        ? "bg-[var(--school-brand-soft,#DBEAFE)] text-[var(--school-brand,#1D4ED8)]"
                        : "bg-[#F1F5F9] text-[#94A3B8]"
                  }`}
                >
                  {i + 1}
                </span>
                {t.label}
              </button>
            ))}
          </div>
          {draftMsg && (
            <p className="mt-3 text-xs font-medium text-[#16A34A]">{draftMsg}</p>
          )}
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6">
        {tab === "personal" && (
          <FormSection
            title="Personal details"
            description="Enter your details exactly as they appear on your certificate or result slip."
          >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required error={errors.title}>
              <TextSelect
                value={form.personal.title}
                onChange={(e) =>
                  setPersonal("title", e.target.value as typeof form.personal.title)
                }
              >
                {TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Surname" required error={errors.surname}>
              <TextInput
                value={form.personal.surname}
                onChange={(e) => setPersonal("surname", e.target.value)}
              />
            </Field>
            <Field label="First name" required error={errors.firstName}>
              <TextInput
                value={form.personal.firstName}
                onChange={(e) => setPersonal("firstName", e.target.value)}
              />
            </Field>
            <Field label="Middle / other names">
              <TextInput
                value={form.personal.middleName || ""}
                onChange={(e) => setPersonal("middleName", e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <FormNotice tone="brand">
                Use the same name order as on your certificate / result slip:
                Title, Surname, First name, then other names.
              </FormNotice>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-[#334155]">
                Date of birth <span className="text-[11px] font-semibold text-[#EF4444]">*</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                <TextSelect
                  value={form.personal.dateOfBirthDay}
                  onChange={(e) => setPersonal("dateOfBirthDay", e.target.value)}
                >
                  <option value="">Day</option>
                  {Array.from({ length: dayCount }, (_, i) =>
                    String(i + 1).padStart(2, "0"),
                  ).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </TextSelect>
                <TextSelect
                  value={form.personal.dateOfBirthMonth}
                  onChange={(e) => setPersonal("dateOfBirthMonth", e.target.value)}
                >
                  <option value="">Month</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </TextSelect>
                <TextSelect
                  value={form.personal.dateOfBirthYear}
                  onChange={(e) => setPersonal("dateOfBirthYear", e.target.value)}
                >
                  <option value="">Year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </TextSelect>
              </div>
              {(errors.dateOfBirthDay ||
                errors.dateOfBirthMonth ||
                errors.dateOfBirthYear) && (
                <p className="mt-1 text-xs font-medium text-[#DC2626]">
                  {errors.dateOfBirthDay ||
                    errors.dateOfBirthMonth ||
                    errors.dateOfBirthYear}
                </p>
              )}
            </div>
            <Field label="Gender" required error={errors.gender}>
              <TextSelect
                value={form.personal.gender}
                onChange={(e) =>
                  setPersonal("gender", e.target.value as typeof form.personal.gender)
                }
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Marital status" required error={errors.maritalStatus}>
              <TextSelect
                value={form.personal.maritalStatus}
                onChange={(e) =>
                  setPersonal(
                    "maritalStatus",
                    e.target.value as typeof form.personal.maritalStatus,
                  )
                }
              >
                {MARITAL_STATUSES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Home region" required error={errors.homeRegion}>
              <TextSelect
                value={form.personal.homeRegion}
                onChange={(e) =>
                  setPersonal(
                    "homeRegion",
                    e.target.value as typeof form.personal.homeRegion,
                  )
                }
              >
                {GHANA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Home country" required error={errors.homeCountry}>
              <TextSelect
                value={form.personal.homeCountry}
                onChange={(e) =>
                  setPersonal(
                    "homeCountry",
                    e.target.value as typeof form.personal.homeCountry,
                  )
                }
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Nationality" required error={errors.nationality}>
              <TextSelect
                value={form.personal.nationality}
                onChange={(e) =>
                  setPersonal(
                    "nationality",
                    e.target.value as typeof form.personal.nationality,
                  )
                }
              >
                {NATIONALITIES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Present occupation" required error={errors.occupation}>
              <TextSelect
                value={form.personal.occupation}
                onChange={(e) =>
                  setPersonal(
                    "occupation",
                    e.target.value as typeof form.personal.occupation,
                  )
                }
              >
                {OCCUPATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </TextSelect>
            </Field>
            {form.personal.occupation === "Other" && (
              <Field
                label="Occupation description"
                required
                error={errors.occupationDescription}
                className="sm:col-span-2"
              >
                <TextInput
                  value={form.personal.occupationDescription || ""}
                  onChange={(e) =>
                    setPersonal("occupationDescription", e.target.value)
                  }
                />
              </Field>
            )}
            <Field label="Phone number" required error={errors.phoneNumber}>
              <TextInput
                value={form.personal.phoneNumber}
                onChange={(e) => setPersonal("phoneNumber", e.target.value)}
                placeholder="024XXXXXXX"
              />
            </Field>
            <Field label="Email address" required error={errors.email}>
              <TextInput
                type="email"
                value={form.personal.email}
                onChange={(e) => setPersonal("email", e.target.value)}
              />
            </Field>
            <Field
              label="Postal address"
              required
              error={errors.postalAddress}
              className="sm:col-span-2"
            >
              <TextInput
                value={form.personal.postalAddress}
                onChange={(e) => setPersonal("postalAddress", e.target.value)}
              />
            </Field>
            <Field
              label="Residential address"
              required
              error={errors.residentialAddress}
              className="sm:col-span-2"
            >
              <TextInput
                value={form.personal.residentialAddress}
                onChange={(e) =>
                  setPersonal("residentialAddress", e.target.value)
                }
              />
            </Field>
          </div>
          </FormSection>
        )}

        {tab === "guardian" && (
          <FormSection
            title="Guardian / next of kin"
            description="Provide a reachable guardian or next of kin we can contact about this application."
          >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guardian title" required error={errors.guardianTitle}>
              <TextSelect
                value={form.guardian.guardianTitle}
                onChange={(e) =>
                  setGuardian(
                    "guardianTitle",
                    e.target.value as typeof form.guardian.guardianTitle,
                  )
                }
              >
                {GUARDIAN_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Guardian name" required error={errors.guardianName}>
              <TextInput
                value={form.guardian.guardianName}
                onChange={(e) => setGuardian("guardianName", e.target.value)}
              />
            </Field>
            <Field label="Relationship" required error={errors.relationship}>
              <TextSelect
                value={form.guardian.relationship}
                onChange={(e) =>
                  setGuardian(
                    "relationship",
                    e.target.value as typeof form.guardian.relationship,
                  )
                }
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label="Occupation" required error={errors.occupation}>
              <TextInput
                value={form.guardian.occupation}
                onChange={(e) => setGuardian("occupation", e.target.value)}
              />
            </Field>
            <Field label="Phone number" required error={errors.phoneNumber}>
              <TextInput
                value={form.guardian.phoneNumber}
                onChange={(e) => setGuardian("phoneNumber", e.target.value)}
              />
            </Field>
            <Field label="Alternative phone" error={errors.alternativePhone}>
              <TextInput
                value={form.guardian.alternativePhone || ""}
                onChange={(e) => setGuardian("alternativePhone", e.target.value)}
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <TextInput
                type="email"
                value={form.guardian.email || ""}
                onChange={(e) => setGuardian("email", e.target.value)}
              />
            </Field>
            <Field label="Nationality" required error={errors.nationality}>
              <TextSelect
                value={form.guardian.nationality}
                onChange={(e) =>
                  setGuardian(
                    "nationality",
                    e.target.value as typeof form.guardian.nationality,
                  )
                }
              >
                {NATIONALITIES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field
              label="Residential address"
              required
              error={errors.residentialAddress}
              className="sm:col-span-2"
            >
              <TextInput
                value={form.guardian.residentialAddress}
                onChange={(e) =>
                  setGuardian("residentialAddress", e.target.value)
                }
              />
            </Field>
            <Field label="Postal address" className="sm:col-span-2">
              <TextInput
                value={form.guardian.postalAddress || ""}
                onChange={(e) => setGuardian("postalAddress", e.target.value)}
              />
            </Field>
          </div>
          </FormSection>
        )}

        {tab === "programme" && (
          <FormSection
            title="Programme choices"
            description="Rank up to four programme preferences. Your first choice is required."
          >
          <div className="space-y-4">
            {programmes.length === 0 && (
              <FormNotice tone="warning">
                This school has not published programmes yet. Ask the school
                admin to add programmes and streams in their portal.
              </FormNotice>
            )}
            {(
              [
                ["first", true],
                ["second", false],
                ["third", false],
                ["fourth", false],
              ] as const
            ).map(([ord, required]) => {
              const progKey =
                `${ord}ChoiceProgramme` as keyof ApplicationFormState["programme"];
              const streamKey =
                `${ord}ChoiceStream` as keyof ApplicationFormState["programme"];
              const progVal = form.programme[progKey] as string;
              return (
                <FormCard
                  key={ord}
                  title={`${ord[0]!.toUpperCase()}${ord.slice(1)} choice`}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Programme"
                    required={required}
                    error={errors[progKey]}
                  >
                    <TextSelect
                      value={progVal}
                      onChange={(e) => {
                        setProgramme(progKey, e.target.value);
                        setProgramme(streamKey, "");
                      }}
                    >
                      <option value="">Select programme</option>
                      {programmes.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </TextSelect>
                  </Field>
                  <Field
                    label="Stream"
                    required={required || !!progVal}
                    error={errors[streamKey]}
                  >
                    <TextSelect
                      value={form.programme[streamKey] as string}
                      onChange={(e) => setProgramme(streamKey, e.target.value)}
                      disabled={!progVal}
                    >
                      <option value="">Select stream</option>
                      {streamsFor(progVal).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </TextSelect>
                  </Field>
                  </div>
                </FormCard>
              );
            })}
          </div>
          </FormSection>
        )}

        {tab === "education" && (
          <div className="space-y-5">
            <p className="text-sm text-[#64748B]">
              Add every school you attended. You will attach exams and results
              to a specific school in the next steps.
            </p>
            {form.educations.map((education, index) => (
              <div
                key={`education-${index}`}
                className="rounded-2xl border border-[#E2E8F0] p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#0F172A]">
                    Institution {index + 1}
                    {education.institutionName ? ` — ${education.institutionName}` : ""}
                  </h3>
                  {form.educations.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeInstitution(index)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] px-3 py-1 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  ) : null}
                </div>
                <InstitutionFields
                  education={education}
                  errorPrefix={String(index)}
                  errors={errors}
                  onChange={(key, value) => setEducationAt(index, key, value)}
                />
              </div>
            ))}
            {form.educations.length < MAX_INSTITUTIONS ? (
              <button
                type="button"
                onClick={addInstitution}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--school-brand,#007AFF)] px-4 py-2.5 text-sm font-semibold text-[var(--school-brand,#007AFF)] hover:bg-[var(--school-brand-soft,#EFF6FF)]"
              >
                <Plus className="h-4 w-4" />
                Add another institution
              </button>
            ) : null}
          </div>
        )}

        {tab === "examination" && (
          <div className="space-y-5">
            <p className="text-sm text-[#64748B]">
              Link each exam sitting to the school where you wrote it. Use this
              for May/June, Nov/Dec (NOVDEC), or any other exam type.
            </p>
            {form.examSittings.map((sitting, index) => (
              <div
                key={`exam-${index}`}
                className="rounded-2xl border border-[#E2E8F0] p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#0F172A]">
                    {index === 0 ? "Primary sitting" : `Additional sitting ${index}`}
                    <span className="mt-0.5 block font-medium text-[#64748B]">
                      {examSittingLabel(sitting, form.educations, index)}
                    </span>
                  </h3>
                  {form.examSittings.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeExamSitting(index)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] px-3 py-1 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="mb-4">
                  <Field
                    label="School / institution for this exam"
                    required
                    error={errors[`examSittings.${index}.institutionIndex`]}
                  >
                    <TextSelect
                      value={String(sitting.institutionIndex)}
                      onChange={(e) =>
                        setExamSitting(
                          index,
                          "institutionIndex",
                          Number(e.target.value),
                        )
                      }
                    >
                      {form.educations.map((education, educationIndex) => (
                        <option key={educationIndex} value={educationIndex}>
                          {education.institutionName ||
                            `Institution ${educationIndex + 1}`}
                        </option>
                      ))}
                    </TextSelect>
                  </Field>
                </div>
                <ExaminationSittingFields
                  exam={sitting}
                  errorPrefix={`examSittings.${index}`}
                  errors={errors}
                  onChange={(key, value) =>
                    setExamSittingInfo(index, key, value)
                  }
                />
              </div>
            ))}
            {form.examSittings.length < MAX_EXAM_SITTINGS ? (
              <button
                type="button"
                onClick={addExamSitting}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--school-brand,#007AFF)] px-4 py-2.5 text-sm font-semibold text-[var(--school-brand,#007AFF)] hover:bg-[var(--school-brand-soft,#EFF6FF)]"
              >
                <Plus className="h-4 w-4" />
                Add another examination
              </button>
            ) : null}
            {errors.examSittings ? (
              <p className="text-xs text-red-600">{errors.examSittings}</p>
            ) : null}
          </div>
        )}

        {tab === "results" && (
          <div className="space-y-5">
            <p className="text-sm text-[#64748B]">
              Enter results for each exam sitting. The first sitting needs all
              core grades. Extra sittings, such as Nov/Dec, can include only the
              subjects you wrote.
            </p>
            {form.examSittings.map((sitting, sittingIndex) => (
              <div
                key={`results-${sittingIndex}`}
                className="rounded-2xl border border-[#E2E8F0] p-4"
              >
                <h3 className="mb-4 text-sm font-semibold text-[#0F172A]">
                  {examSittingLabel(sitting, form.educations, sittingIndex)}
                </h3>
                {errors[`examSittings.${sittingIndex}`] ? (
                  <p className="mb-3 text-xs text-red-600">
                    {errors[`examSittings.${sittingIndex}`]}
                  </p>
                ) : null}
                <div className="space-y-6">
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-[#334155]">
                      Core subjects
                      {sittingIndex === 0 ? " (required)" : " (if written)"}
                    </h4>
                    <div className="space-y-2">
                      {CORE_SUBJECTS.map((subject, index) => (
                        <div
                          key={subject}
                          className="grid grid-cols-[1fr_8rem] items-center gap-2"
                        >
                          <span className="text-sm text-[#334155]">{subject}</span>
                          <TextSelect
                            value={sitting.coreResults[index]?.grade || ""}
                            onChange={(e) => {
                              const next = [...sitting.coreResults];
                              next[index] = {
                                subject,
                                grade: e.target.value as (typeof WASSCE_GRADES)[number],
                              };
                              setExamSitting(sittingIndex, "coreResults", next);
                            }}
                          >
                            <option value="">Grade</option>
                            {WASSCE_GRADES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </TextSelect>
                        </div>
                      ))}
                    </div>
                    {errors[`examSittings.${sittingIndex}.coreResults`] ? (
                      <p className="mt-2 text-xs text-red-600">
                        {errors[`examSittings.${sittingIndex}.coreResults`]}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-[#334155]">
                      Elective subjects (up to 8)
                    </h4>
                    <div className="space-y-2">
                      {sitting.electiveResults.map((row, index) => (
                        <div key={index} className="grid grid-cols-2 gap-2">
                          <TextSelect
                            value={row.subject || ""}
                            onChange={(e) => {
                              const next = [...sitting.electiveResults];
                              next[index] = { ...row, subject: e.target.value };
                              setExamSitting(
                                sittingIndex,
                                "electiveResults",
                                next,
                              );
                            }}
                          >
                            <option value="">Subject</option>
                            {ELECTIVE_SUBJECTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </TextSelect>
                          <TextSelect
                            value={row.grade || ""}
                            onChange={(e) => {
                              const next = [...sitting.electiveResults];
                              next[index] = { ...row, grade: e.target.value };
                              setExamSitting(
                                sittingIndex,
                                "electiveResults",
                                next,
                              );
                            }}
                          >
                            <option value="">Grade</option>
                            {WASSCE_GRADES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </TextSelect>
                        </div>
                      ))}
                    </div>
                    {errors[`examSittings.${sittingIndex}.electiveResults`] ? (
                      <p className="mt-2 text-xs text-red-600">
                        {errors[`examSittings.${sittingIndex}.electiveResults`]}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-4">
            <p className="text-sm text-[#64748B]">
              A Ghana Card or other national ID is required. Birth certificate
              is optional.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
            <FileDropzone
              label="Passport photograph"
              required
              preview="photo"
              accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
              maxMb={5}
              value={form.documents.passportPhoto}
              error={errors.passportPhoto}
              onUploaded={(url) =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, passportPhoto: url },
                }))
              }
              onClear={() =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, passportPhoto: "" },
                }))
              }
            />
            <FileDropzone
              label="WASSCE result slip"
              required
              accept="image/jpeg,image/jpg,image/png,application/pdf,.pdf,.jpg,.jpeg,.png"
              maxMb={10}
              value={form.documents.resultSlip}
              error={errors.resultSlip}
              onUploaded={(url) =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, resultSlip: url },
                }))
              }
              onClear={() =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, resultSlip: "" },
                }))
              }
            />
            <FileDropzone
              label="Ghana Card / National ID"
              required
              accept="image/jpeg,image/jpg,image/png,application/pdf,.pdf,.jpg,.jpeg,.png"
              maxMb={10}
              value={form.documents.nationalId}
              error={errors.nationalId}
              onUploaded={(url) =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, nationalId: url },
                }))
              }
              onClear={() =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, nationalId: "" },
                }))
              }
            />
            <FileDropzone
              label="Birth certificate (optional)"
              accept="image/jpeg,image/jpg,image/png,application/pdf,.pdf,.jpg,.jpeg,.png"
              maxMb={10}
              value={form.documents.birthCertificate}
              error={errors.birthCertificate}
              onUploaded={(url) =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, birthCertificate: url },
                }))
              }
              onClear={() =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, birthCertificate: "" },
                }))
              }
            />
            <FileDropzone
              label="SSSCE result slip (optional)"
              accept="image/jpeg,image/jpg,image/png,application/pdf,.pdf,.jpg,.jpeg,.png"
              maxMb={10}
              value={form.documents.sssceResultSlip}
              onUploaded={(url) =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, sssceResultSlip: url },
                }))
              }
              onClear={() =>
                setForm((f) => ({
                  ...f,
                  documents: { ...f.documents, sssceResultSlip: "" },
                }))
              }
            />
            </div>
          </div>
        )}

        {tab === "review" && (
          <FormSection
            title="Review & submit"
            description="Check your summary carefully, then accept the declaration to submit."
          >
          <div className="space-y-4 text-sm">
            <div className="flex justify-end">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => {
                  setDownloadingPdf(true);
                  void downloadApplicationPrintout({
                    school: {
                      name: schoolName,
                      logoSrc: schoolLogo,
                      brandColor,
                      brandColors,
                      phone: schoolPhone,
                      email: schoolEmail,
                      address: schoolAddress,
                    },
                    data: printoutFromForm(
                      form,
                      existingApplicationNumber || undefined,
                    ),
                  }).finally(() => setDownloadingPdf(false));
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {downloadingPdf ? "Preparing PDF…" : "Download summary PDF"}
              </button>
            </div>
            <ApplicationPrintout
              school={{
                name: schoolName,
                logoSrc: schoolLogo,
                brandColor,
                brandColors,
                phone: schoolPhone,
                email: schoolEmail,
                address: schoolAddress,
              }}
              data={printoutFromForm(
                form,
                existingApplicationNumber || undefined,
              )}
            />

            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
              <div className="mb-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#B91C1C]">
                  {DECLARATION_IMPORTANT_HEADING}
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#B91C1C]">
                  {DECLARATION_IMPORTANT_BODY}
                </p>
              </div>
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#0F172A]">
                {DECLARATION_HEADING}
              </h3>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-[#334155]">
                <p>{DECLARATION_CERTIFY}</p>
                <p>
                  {DECLARATION_PERMISSION_BEFORE}
                  <strong className="font-bold text-[#0F172A]">
                    {declarationSchoolLabel(schoolName)}
                  </strong>
                  {DECLARATION_PERMISSION_AFTER}
                </p>
                <p>{DECLARATION_FALSEHOOD}</p>
                <p className="font-medium text-[#0F172A]">
                  {(() => {
                    const signed = declarationSignedParts(
                      certificateNameOrder(form.personal),
                    );
                    return (
                      <>
                        {signed.before}
                        {signed.name}{" "}
                        <span className="font-semibold text-[#B91C1C]">
                          {signed.hint}
                        </span>
                        {signed.after}
                      </>
                    );
                  })()}
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <input
                type="checkbox"
                checked={form.declarationAccepted}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    declarationAccepted: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[var(--school-brand,#007AFF)] focus:ring-[var(--school-brand,#007AFF)]"
              />
              <span className="leading-relaxed text-[#334155]">
                I have read and agree to the declaration above.
                {errors.declarationAccepted && (
                  <span className="mt-1 block text-xs font-medium text-[#DC2626]">
                    {errors.declarationAccepted}
                  </span>
                )}
              </span>
            </label>
            {submitError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {submitError}
              </p>
            )}
          </div>
          </FormSection>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF2F7] pt-5">
          <button
            type="button"
            onClick={goPrev}
            disabled={tabIndex === 0}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          {tab === "review" ? (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--school-brand,#007AFF)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--school-brand-hover,#0062CC)] disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {existingApplicationNumber
                ? "Save changes"
                : "Submit application"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[var(--school-brand,#007AFF)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--school-brand-hover,#0062CC)]"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

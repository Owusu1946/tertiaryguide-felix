"use client";

import React, { useEffect, useMemo, useState } from "react";
import { normalizeSchoolCategories, SCHOOL_CATEGORIES } from "@/lib/schoolCategories";
import {
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeLevel,
} from "@/lib/admissions/programme-level";

type AdminManageSchoolsSectionProps = {
  onBack?: () => void;
};

type AdminSchool = {
  id: string;
  name: string;
  alias: string | null;
  logoSrc: string | null;
  logoAlt: string | null;
  priceGhs: number | null;
  deadline: string | null;
  about: string | null;
  preRequisite?: string | null;
  durationYears?: number | null;
  isVerified?: boolean;
  category?: string;
  categories?: string[];
};

type AdminProgramme = {
  id: string;
  name: string;
  cutoff: string;
  preRequisite?: string | null;
  durationYears?: number | null;
};

type AdminVoucherStatus = "Unserved" | "Served";

type AdminVoucher = {
  id: string;
  serial: string;
  pin: string;
  status: AdminVoucherStatus;
  programmeLevel?: ProgrammeLevel;
  programmeLevelLabel?: string;
  createdAt: string;
};

export function AdminManageSchoolsSection({ onBack }: AdminManageSchoolsSectionProps) {
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const [programmes, setProgrammes] = useState<AdminProgramme[]>([]);
  const [programmesLoading, setProgrammesLoading] = useState(false);
  const [programmesError, setProgrammesError] = useState<string | null>(null);

  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [vouchersError, setVouchersError] = useState<string | null>(null);

  const [addSchoolOpen, setAddSchoolOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolAlias, setNewSchoolAlias] = useState("");
  const [newSchoolLogoFile, setNewSchoolLogoFile] = useState<File | null>(null);
  const [newSchoolLogoAlt, setNewSchoolLogoAlt] = useState("");
  const [newSchoolPriceGhs, setNewSchoolPriceGhs] = useState("");
  const [newSchoolDeadline, setNewSchoolDeadline] = useState("");
  const [newSchoolAbout, setNewSchoolAbout] = useState("");
  const [newSchoolIsVerified, setNewSchoolIsVerified] = useState(false);
  const [newSchoolCategories, setNewSchoolCategories] = useState<Set<string>>(
    () => new Set(["Public"]),
  );
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [savingSchool, setSavingSchool] = useState(false);
  const [saveSchoolError, setSaveSchoolError] = useState<string | null>(null);
  const [deletingSchool, setDeletingSchool] = useState(false);

  const [newProgrammeName, setNewProgrammeName] = useState("");
  const [newProgrammeCutoff, setNewProgrammeCutoff] = useState("");
  const [newProgrammePreRequisite, setNewProgrammePreRequisite] = useState("");
  const [newProgrammeDurationYears, setNewProgrammeDurationYears] = useState("");
  const [savingProgramme, setSavingProgramme] = useState(false);
  const [saveProgrammeError, setSaveProgrammeError] = useState<string | null>(null);
  const [editingProgrammeId, setEditingProgrammeId] = useState<string | null>(null);
  const [deletingProgrammeId, setDeletingProgrammeId] = useState<string | null>(null);

  const [newVoucherSerial, setNewVoucherSerial] = useState("");
  const [newVoucherPin, setNewVoucherPin] = useState("");
  const [newVoucherLevel, setNewVoucherLevel] = useState<ProgrammeLevel | "">(
    "",
  );
  const [savingVoucher, setSavingVoucher] = useState(false);
  const [saveVoucherError, setSaveVoucherError] = useState<string | null>(null);
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<
    "all" | "Unserved" | "Served"
  >("all");
  const [voucherLevelFilter, setVoucherLevelFilter] = useState<
    "all" | ProgrammeLevel
  >("all");

  function toggleSchoolCategory(cat: string) {
    setNewSchoolCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size <= 1) return next;
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSchools() {
      try {
        setSchoolsLoading(true);
        setSchoolsError(null);
        const res = await fetch("/api/admin/schools");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load schools");
        }
        if (!cancelled) {
          setSchools(Array.isArray(data.schools) ? data.schools : []);
          if (!selectedSchoolId && data.schools?.length) {
            setSelectedSchoolId(data.schools[0].id);
          }
        }
      } catch {
        if (!cancelled) {
          setSchoolsError("Could not load schools. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setSchoolsLoading(false);
        }
      }
    }

    loadSchools();

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setVouchers([]);
      return;
    }

    let cancelled = false;

    async function loadVouchers() {
      try {
        setVouchersLoading(true);
        setVouchersError(null);
        const res = await fetch(`/api/admin/schools/${selectedSchoolId}/vouchers`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load vouchers");
        }
        if (!cancelled) {
          setVouchers(Array.isArray(data.vouchers) ? data.vouchers : []);
        }
      } catch {
        if (!cancelled) {
          setVouchersError("Could not load vouchers. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setVouchersLoading(false);
        }
      }
    }

    loadVouchers();

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setProgrammes([]);
      setVouchers([]);
      return;
    }

    let cancelled = false;

    async function loadProgrammes() {
      try {
        setProgrammesLoading(true);
        setProgrammesError(null);
        const res = await fetch(`/api/admin/schools/${selectedSchoolId}/programmes`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load programmes");
        }
        if (!cancelled) {
          setProgrammes(Array.isArray(data.programmes) ? data.programmes : []);
        }
      } catch {
        if (!cancelled) {
          setProgrammesError("Could not load programmes. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setProgrammesLoading(false);
        }
      }
    }

    setEditingProgrammeId(null);
    setNewProgrammeName("");
    setNewProgrammeCutoff("");
    setNewProgrammePreRequisite("");
    setNewProgrammeDurationYears("");
    setSaveProgrammeError(null);

    loadProgrammes();

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId]);

  const selectedSchool = useMemo(
    () => schools.find((s) => s.id === selectedSchoolId) ?? null,
    [schools, selectedSchoolId],
  );

  const voucherStats = useMemo(() => {
    const unserved = vouchers.filter((v) => v.status === "Unserved").length;
    const undergraduate = vouchers.filter(
      (v) => (v.programmeLevel ?? "undergraduate") === "undergraduate",
    ).length;
    const postgraduate = vouchers.filter(
      (v) => v.programmeLevel === "postgraduate",
    ).length;
    return {
      total: vouchers.length,
      unserved,
      served: vouchers.length - unserved,
      undergraduate,
      postgraduate,
    };
  }, [vouchers]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (voucherStatusFilter !== "all" && v.status !== voucherStatusFilter) {
        return false;
      }
      if (voucherLevelFilter !== "all") {
        const level = v.programmeLevel ?? "undergraduate";
        if (level !== voucherLevelFilter) return false;
      }
      return true;
    });
  }, [vouchers, voucherStatusFilter, voucherLevelFilter]);

  useEffect(() => {
    setVoucherStatusFilter("all");
    setVoucherLevelFilter("all");
  }, [selectedSchoolId]);

  async function handleSaveSchool() {
    if (!newSchoolName.trim()) {
      setSaveSchoolError("School name is required.");
      return;
    }

    try {
      setSavingSchool(true);
      setSaveSchoolError(null);

      if (newSchoolCategories.size === 0) {
        setSaveSchoolError("Select at least one category.");
        setSavingSchool(false);
        return;
      }

      const categoriesPayload = Array.from(newSchoolCategories);

      console.log("[AdminManageSchools] Saving school", {
        mode: isEditingSchool ? "EDIT" : "CREATE",
        id: editingSchoolId,
        name: newSchoolName,
        alias: newSchoolAlias,
        hasLogoFile: !!newSchoolLogoFile,
      });

      let logoSrc: string | undefined;
      if (newSchoolLogoFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", newSchoolLogoFile);
        const uploadRes = await fetch("/api/admin/upload-logo", {
          method: "POST",
          body: uploadForm,
        });
        const uploadData = await uploadRes.json();
        console.log("[AdminManageSchools] Upload response", {
          status: uploadRes.status,
          ok: uploadRes.ok,
          uploadData,
        });
        if (!uploadRes.ok || !uploadData?.url) {
          setSaveSchoolError(
            uploadData?.error ||
            "Could not upload logo. Please try again or save without a logo.",
          );
          return;
        }
        logoSrc = uploadData.url as string;
      }

      let res;
      if (isEditingSchool && editingSchoolId) {
        res = await fetch(`/api/admin/schools/${editingSchoolId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newSchoolName.trim(),
            alias: newSchoolAlias.trim() || undefined,
            logoSrc,
            logoAlt: newSchoolLogoAlt.trim() || undefined,
            priceGhs: newSchoolPriceGhs.trim() || undefined,
            deadline: newSchoolDeadline.trim() || undefined,
            about: newSchoolAbout.trim() || undefined,
            isVerified: newSchoolIsVerified,
            categories: categoriesPayload,
          }),
        });
      } else {
        res = await fetch("/api/admin/schools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newSchoolName.trim(),
            alias: newSchoolAlias.trim() || undefined,
            logoSrc,
            logoAlt: newSchoolLogoAlt.trim() || undefined,
            priceGhs: newSchoolPriceGhs.trim() || undefined,
            deadline: newSchoolDeadline.trim() || undefined,
            about: newSchoolAbout.trim() || undefined,
            isVerified: newSchoolIsVerified,
            categories: categoriesPayload,
          }),
        });
      }

      const data = await res.json();
      console.log("[AdminManageSchools] Save response", {
        status: res.status,
        ok: res.ok,
        data,
      });

      if (!res.ok) {
        setSaveSchoolError(data.error || "Could not save school. Please try again.");
        return;
      }

      if (data.school) {
        setSchools((prev) => {
          if (isEditingSchool) {
            return prev.map(s => s.id === data.school.id ? data.school : s);
          }
          return [data.school, ...prev];
        });
        setSelectedSchoolId(data.school.id);
      }

      resetSchoolForm();
      setAddSchoolOpen(false);
    } catch {
      setSaveSchoolError("Something went wrong. Please try again.");
    } finally {
      setSavingSchool(false);
    }
  }

  async function handleAddVoucher() {
    if (!selectedSchoolId) {
      setSaveVoucherError("Select a school first.");
      return;
    }
    if (!newVoucherSerial.trim()) {
      setSaveVoucherError("Voucher serial is required.");
      return;
    }
    if (!newVoucherPin.trim()) {
      setSaveVoucherError("Voucher PIN is required.");
      return;
    }
    if (!newVoucherLevel) {
      setSaveVoucherError("Select Undergraduate or Postgraduate.");
      return;
    }

    try {
      setSavingVoucher(true);
      setSaveVoucherError(null);
      const res = await fetch(`/api/admin/schools/${selectedSchoolId}/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial: newVoucherSerial.trim(),
          pin: newVoucherPin.trim(),
          programmeLevel: newVoucherLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveVoucherError(data.error || "Could not save voucher. Please try again.");
        return;
      }
      if (data.voucher) {
        setVouchers((prev) => [data.voucher, ...prev]);
      }
      setNewVoucherSerial("");
      setNewVoucherPin("");
      setNewVoucherLevel("");
    } catch {
      setSaveVoucherError("Something went wrong. Please try again.");
    } finally {
      setSavingVoucher(false);
    }
  }

  function resetProgrammeForm() {
    setEditingProgrammeId(null);
    setNewProgrammeName("");
    setNewProgrammeCutoff("");
    setNewProgrammePreRequisite("");
    setNewProgrammeDurationYears("");
    setSaveProgrammeError(null);
  }

  function startEditProgramme(p: AdminProgramme) {
    setEditingProgrammeId(p.id);
    setNewProgrammeName(p.name);
    setNewProgrammeCutoff(p.cutoff);
    setNewProgrammePreRequisite(p.preRequisite ?? "");
    setNewProgrammeDurationYears(
      p.durationYears != null ? String(p.durationYears) : "",
    );
    setSaveProgrammeError(null);
  }

  async function handleSaveProgramme() {
    if (!selectedSchoolId) {
      setSaveProgrammeError("Select a school first.");
      return;
    }
    if (!newProgrammeName.trim()) {
      setSaveProgrammeError("Programme name is required.");
      return;
    }
    if (!newProgrammeCutoff.trim()) {
      setSaveProgrammeError("Cut-off point is required.");
      return;
    }

    const payload = {
      name: newProgrammeName.trim(),
      cutoff: newProgrammeCutoff.trim(),
      preRequisite: newProgrammePreRequisite.trim() || undefined,
      durationYears: newProgrammeDurationYears.trim() || undefined,
    };

    try {
      setSavingProgramme(true);
      setSaveProgrammeError(null);

      const isEdit = Boolean(editingProgrammeId);
      const url = isEdit
        ? `/api/admin/schools/${selectedSchoolId}/programmes/${editingProgrammeId}`
        : `/api/admin/schools/${selectedSchoolId}/programmes`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveProgrammeError(
          data.error || "Could not save programme. Please try again.",
        );
        return;
      }
      if (data.programme) {
        setProgrammes((prev) => {
          if (isEdit) {
            return prev.map((x) =>
              x.id === data.programme.id ? data.programme : x,
            );
          }
          return [data.programme, ...prev];
        });
      }
      resetProgrammeForm();
    } catch {
      setSaveProgrammeError("Something went wrong. Please try again.");
    } finally {
      setSavingProgramme(false);
    }
  }

  async function handleDeleteProgramme(id: string) {
    if (!selectedSchoolId) return;
    if (!window.confirm("Delete this programme? This cannot be undone.")) {
      return;
    }
    try {
      setDeletingProgrammeId(id);
      setSaveProgrammeError(null);
      const res = await fetch(
        `/api/admin/schools/${selectedSchoolId}/programmes/${id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        setSaveProgrammeError(
          data.error || "Could not delete programme. Please try again.",
        );
        return;
      }
      setProgrammes((prev) => prev.filter((p) => p.id !== id));
      if (editingProgrammeId === id) {
        resetProgrammeForm();
      }
    } catch {
      setSaveProgrammeError("Something went wrong. Please try again.");
    } finally {
      setDeletingProgrammeId(null);
    }
  }

  function resetSchoolForm() {
    setNewSchoolName("");
    setNewSchoolAlias("");
    setNewSchoolLogoFile(null);
    setNewSchoolLogoAlt("");
    setNewSchoolPriceGhs("");
    setNewSchoolDeadline("");
    setNewSchoolAbout("");
    setNewSchoolIsVerified(false);
    setNewSchoolCategories(new Set(["Public"]));
    setIsEditingSchool(false);
    setEditingSchoolId(null);
    setSaveSchoolError(null);
  }

  function handleAddSchoolClick() {
    resetSchoolForm();
    setIsEditingSchool(false);
    setAddSchoolOpen((open) => {
      if (open && isEditingSchool) return true; // Switch context if already open
      return !open;
    });
    // Ensure accurate state if switching from edit
    if (isEditingSchool) {
      setAddSchoolOpen(true);
    }
  }

  async function handleDeleteSchool() {
    if (!selectedSchool) return;
    const schoolName = selectedSchool.name;
    if (
      !window.confirm(
        `Delete “${schoolName}”?\n\nThis removes the school, all its programmes, and the voucher pool for this school. Past form payments stay in your records, but the school will disappear from the public list. Blog posts linked to this school are unlinked.\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }
    const deletedId = selectedSchool.id;
    try {
      setDeletingSchool(true);
      setSchoolsError(null);
      const res = await fetch(`/api/admin/schools/${deletedId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setSchoolsError(data.error || "Could not delete school.");
        return;
      }
      setSchools((prev) => {
        const next = prev.filter((s) => s.id !== deletedId);
        setSelectedSchoolId((sel) =>
          sel === deletedId ? next[0]?.id ?? null : sel,
        );
        return next;
      });
      setAddSchoolOpen(false);
      resetSchoolForm();
    } catch {
      setSchoolsError("Could not delete school. Please try again.");
    } finally {
      setDeletingSchool(false);
    }
  }

  function handleEditSchoolClick() {
    if (!selectedSchool) return;

    setNewSchoolName(selectedSchool.name);
    setNewSchoolAlias(selectedSchool.alias || "");
    setNewSchoolLogoFile(null); // Keep null to not re-upload unless changed
    setNewSchoolLogoAlt(selectedSchool.logoAlt || "");
    setNewSchoolPriceGhs(selectedSchool.priceGhs?.toString() || "");

    // Format date for date input (YYYY-MM-DD)
    let dateStr = "";
    if (selectedSchool.deadline) {
      try {
        const d = new Date(selectedSchool.deadline);
        dateStr = d.toISOString().slice(0, 10);
      } catch { }
    }
    setNewSchoolDeadline(dateStr);

    setNewSchoolAbout(selectedSchool.about || "");
    setNewSchoolIsVerified(!!selectedSchool.isVerified);
    setNewSchoolCategories(
      new Set(
        normalizeSchoolCategories(
          selectedSchool.categories,
          selectedSchool.category,
        ),
      ),
    );

    setIsEditingSchool(true);
    setEditingSchoolId(selectedSchool.id);
    setAddSchoolOpen(true);
    setSaveSchoolError(null);
  }

  return (
    <div className="min-w-0 space-y-4 text-sm text-[#111827]">
      <section className="space-y-2 rounded-3xl border border-[#BFDBFE] bg-gradient-to-r from-[#EAF4FF] via-white to-[#F2F8FF] px-5 py-5 shadow-sm">
        <p className="text-xs font-medium text-[#9CA3AF]">
          Dashboard / <span className="text-[#111827]">Manage schools</span>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#007AFF] md:text-3xl">
          Manage schools
        </h1>
        <p className="text-sm text-[#6B7280]">
          Configure the schools and forms you offer to students and the programmes
          they offer.
        </p>
      </section>

      <section className="min-w-0 rounded-3xl bg-[#F9FAFB] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#111827]">
            School catalogue
          </h2>
          <p className="text-xs text-[#6B7280]">
            Add schools, stock vouchers, and manage programmes.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {selectedSchool && !addSchoolOpen && (
            <>
              <button
                type="button"
                onClick={handleEditSchoolClick}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-xs font-medium text-[#111827] hover:bg-[#F3F4F6]"
              >
                Edit school
              </button>
              <button
                type="button"
                disabled={deletingSchool}
                onClick={() => void handleDeleteSchool()}
                className="rounded-full border border-[#FECACA] bg-white px-4 py-2 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingSchool ? "Deleting…" : "Delete school"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleAddSchoolClick}
            className="inline-flex items-center justify-center rounded-full bg-[#007AFF] px-4 py-2 text-xs font-medium text-white hover:bg-[#0062CC]"
          >
            {addSchoolOpen ? "Close" : "Add school"}
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-[#E5E7EB] px-4 py-2 text-xs font-medium text-[#111827] hover:bg-[#F3F4F6]"
            >
              Back to forms
            </button>
          )}
        </div>
      </div>

      {addSchoolOpen && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-xs text-[#111827]">
          <h3 className="mb-4 text-sm font-bold text-[#111827]">
            {isEditingSchool ? "Edit School" : "Add New School"}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                School name
              </p>
              <input
                type="text"
                value={newSchoolName}
                onChange={(event) => setNewSchoolName(event.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                placeholder="e.g. Kwame Nkrumah University of Science and Technology"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Alias
              </p>
              <input
                type="text"
                value={newSchoolAlias}
                onChange={(event) => setNewSchoolAlias(event.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                placeholder="e.g. KNUST"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Logo
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setNewSchoolLogoFile(file);
                }}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] file:mr-3 file:rounded-full file:border-0 file:bg-[#F3F4F6] file:px-3 file:py-1 file:text-[11px] file:font-medium file:text-[#111827]"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Logo alt text
              </p>
              <input
                type="text"
                value={newSchoolLogoAlt}
                onChange={(event) => setNewSchoolLogoAlt(event.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                placeholder="e.g. Kwame Nkrumah University of Science and Technology logo"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Price (GHS)
              </p>
              <input
                type="number"
                min={0}
                step={1}
                value={newSchoolPriceGhs}
                onChange={(event) => setNewSchoolPriceGhs(event.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                placeholder="e.g. 270"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Deadline
              </p>
              <input
                type="date"
                value={newSchoolDeadline}
                onChange={(event) => setNewSchoolDeadline(event.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                About university
              </p>
              <textarea
                value={newSchoolAbout}
                onChange={(event) => setNewSchoolAbout(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                placeholder="Short description or overview shown on the form details page."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                Categories
              </p>
              <div className="flex flex-wrap gap-3">
                {SCHOOL_CATEGORIES.map((c) => (
                  <label
                    key={c}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] has-[:checked]:border-[#007AFF] has-[:checked]:bg-[#EFF6FF] has-[:checked]:text-[#007AFF]"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#007AFF] focus:ring-[#007AFF]"
                      checked={newSchoolCategories.has(c)}
                      onChange={() => toggleSchoolCategory(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-[#6B7280]">
                A school can appear under more than one filter (e.g. Public and
                Private). At least one category is required.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVerified"
                checked={newSchoolIsVerified}
                onChange={(e) => setNewSchoolIsVerified(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#007AFF] focus:ring-[#007AFF]"
              />
              <label htmlFor="isVerified" className="text-xs font-medium text-[#111827]">
                Verified School
              </label>
            </div>
          </div>
          {saveSchoolError && (
            <p className="mt-2 text-[11px] text-[#DC2626]">{saveSchoolError}</p>
          )}
          <button
            type="button"
            disabled={savingSchool}
            onClick={handleSaveSchool}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0062CC] disabled:cursor-not-allowed disabled:bg-[#9EC8FF]"
          >
            {savingSchool ? "Saving..." : isEditingSchool ? "Update school" : "Save school"}
          </button>
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-3 rounded-2xl bg-white p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Schools</span>
            {schoolsLoading && <span className="text-[11px]">Loading...</span>}
          </div>
          {schoolsError ? (
            <p className="text-[11px] text-[#DC2626]">{schoolsError}</p>
          ) : schools.length === 0 ? (
            <p className="text-[11px] text-[#6B7280]">
              No schools added yet. Use "Add school" to create one.
            </p>
          ) : (
            <div className="space-y-1 text-xs">
              {schools.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => setSelectedSchoolId(school.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${selectedSchoolId === school.id
                    ? "bg-[#EFF6FF] text-[#111827]"
                    : "bg-[#F9FAFB] text-[#4B5563] hover:bg-[#F3F4F6]"
                    }`}
                >
                  <span className="text-[13px] font-medium">{school.name}</span>
                  {school.alias && (
                    <span className="text-[11px] text-[#6B7280]">{school.alias}</span>
                  )}
                  {school.isVerified && (
                    <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] text-[#007AFF]">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3 rounded-2xl bg-white p-3 sm:p-4">
          {!selectedSchool ? (
            <p className="text-xs text-[#6B7280]">
              Select a school to manage its programmes.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
                    Programmes &amp; Vouchers
                  </p>
                  <p className="text-sm font-semibold text-[#111827]">
                    {selectedSchool.name}
                  </p>
                </div>
              </div>

              <p className="text-[11px] font-medium text-[#6B7280]">
                {editingProgrammeId ? "Edit programme" : "Add programme"}
              </p>
              <div className="mt-1 grid gap-3 md:grid-cols-2">
                <div className="space-y-1 text-xs">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                    Programme name
                  </p>
                  <input
                    type="text"
                    value={newProgrammeName}
                    onChange={(event) => setNewProgrammeName(event.target.value)}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    placeholder="e.g. BSc. Computer Science"
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                    Cut-off point
                  </p>
                  <input
                    type="text"
                    value={newProgrammeCutoff}
                    onChange={(event) => setNewProgrammeCutoff(event.target.value)}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="space-y-1 text-xs md:col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                    Pre-requisite (this programme)
                  </p>
                  <textarea
                    value={newProgrammePreRequisite}
                    onChange={(event) => setNewProgrammePreRequisite(event.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    placeholder="e.g. WASSCE with credit passes in core Mathematics and English."
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                    Duration (years)
                  </p>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={newProgrammeDurationYears}
                    onChange={(event) => setNewProgrammeDurationYears(event.target.value)}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    placeholder="e.g. 4"
                  />
                </div>
              </div>
              {saveProgrammeError && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{saveProgrammeError}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingProgramme}
                  onClick={handleSaveProgramme}
                  className="inline-flex items-center justify-center rounded-full bg-[#007AFF] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#0062CC] disabled:cursor-not-allowed disabled:bg-[#9EC8FF]"
                >
                  {savingProgramme
                    ? "Saving..."
                    : editingProgrammeId
                      ? "Update programme"
                      : "Add programme"}
                </button>
                {editingProgrammeId && (
                  <button
                    type="button"
                    disabled={savingProgramme}
                    onClick={resetProgrammeForm}
                    className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-4 py-2 text-[11px] font-medium text-[#111827] hover:bg-[#F3F4F6] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2 text-xs">
                {programmesLoading ? (
                  <p className="text-[11px] text-[#6B7280]">Loading programmes...</p>
                ) : programmesError ? (
                  <p className="text-[11px] text-[#DC2626]">{programmesError}</p>
                ) : programmes.length === 0 ? (
                  <p className="text-[11px] text-[#6B7280]">
                    No programmes added yet for this school.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {programmes.map((programme) => (
                      <li
                        key={programme.id}
                        className="flex flex-col gap-2 rounded-xl bg-[#F9FAFB] px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-medium">
                            {programme.name}
                          </span>
                          {(programme.preRequisite || programme.durationYears != null) && (
                            <p className="mt-0.5 max-w-md text-[11px] text-[#6B7280]">
                              {programme.preRequisite && (
                                <span className="line-clamp-2">{programme.preRequisite}</span>
                              )}
                              {programme.preRequisite && programme.durationYears != null && " · "}
                              {programme.durationYears != null && (
                                <span>{programme.durationYears} yr</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:items-end">
                          <span className="text-[11px] text-[#6B7280]">
                            Cut-off: {programme.cutoff}
                          </span>
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEditProgramme(programme)}
                              className="rounded-lg border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-medium text-[#111827] hover:bg-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={deletingProgrammeId === programme.id}
                              onClick={() => void handleDeleteProgramme(programme.id)}
                              className="rounded-lg border border-[#FECACA] bg-white px-2 py-0.5 text-[11px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-50"
                            >
                              {deletingProgrammeId === programme.id ? "…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
                <div className="space-y-1 text-xs">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                    Voucher serial
                  </p>
                  <input
                    type="text"
                    value={newVoucherSerial}
                    onChange={(event) => setNewVoucherSerial(event.target.value)}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    placeholder="e.g. TG-VCHR-001"
                  />
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF] mt-3">
                    Voucher PIN
                  </p>
                  <input
                    type="text"
                    value={newVoucherPin}
                    onChange={(event) => setNewVoucherPin(event.target.value)}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    placeholder="Enter PIN"
                  />
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF] mt-3">
                    Programme level
                  </p>
                  <select
                    value={newVoucherLevel}
                    onChange={(event) =>
                      setNewVoucherLevel(
                        event.target.value as ProgrammeLevel | "",
                      )
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                  >
                    <option value="">Select level</option>
                    <option value="undergraduate">Undergraduate</option>
                    <option value="postgraduate">Postgraduate</option>
                  </select>
                  {saveVoucherError && (
                    <p className="mt-1 text-[11px] text-[#DC2626]">{saveVoucherError}</p>
                  )}
                  <button
                    type="button"
                    disabled={savingVoucher}
                    onClick={handleAddVoucher}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-[#111827] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#0B1120] disabled:cursor-not-allowed disabled:bg-[#6B7280]"
                  >
                    {savingVoucher ? "Saving..." : "Add voucher"}
                  </button>
                </div>

                <div className="flex min-w-0 flex-1 flex-col space-y-2 text-xs">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                        Voucher pool
                      </p>
                      {vouchers.length > 0 && (
                        <p className="text-[11px] text-[#6B7280]">
                          {voucherStats.total} total · {voucherStats.unserved} unserved ·{" "}
                          {voucherStats.served} served
                        </p>
                      )}
                    </div>
                    {vouchersLoading && (
                      <span className="text-[11px] text-[#6B7280]">Loading…</span>
                    )}
                  </div>
                  {vouchersError ? (
                    <p className="text-[11px] text-[#DC2626]">{vouchersError}</p>
                  ) : vouchers.length === 0 ? (
                    <p className="text-[11px] text-[#6B7280]">
                      No vouchers added yet for this school.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { key: "all" as const, label: "All", count: voucherStats.total },
                            {
                              key: "Unserved" as const,
                              label: "Unserved",
                              count: voucherStats.unserved,
                            },
                            {
                              key: "Served" as const,
                              label: "Served",
                              count: voucherStats.served,
                            },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setVoucherStatusFilter(opt.key)}
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                              voucherStatusFilter === opt.key
                                ? "border-[#111827] bg-[#111827] text-white"
                                : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
                            }`}
                          >
                            {opt.label}
                            <span
                              className={
                                voucherStatusFilter === opt.key
                                  ? " text-white/80"
                                  : " text-[#9CA3AF]"
                              }
                            >
                              {" "}
                              ({opt.count})
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            {
                              key: "all" as const,
                              label: "All levels",
                              count: voucherStats.total,
                            },
                            {
                              key: "undergraduate" as const,
                              label: "Undergrad",
                              count: voucherStats.undergraduate,
                            },
                            {
                              key: "postgraduate" as const,
                              label: "Postgrad",
                              count: voucherStats.postgraduate,
                            },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setVoucherLevelFilter(opt.key)}
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                              voucherLevelFilter === opt.key
                                ? "border-[#007AFF] bg-[#007AFF] text-white"
                                : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
                            }`}
                          >
                            {opt.label}
                            <span
                              className={
                                voucherLevelFilter === opt.key
                                  ? " text-white/80"
                                  : " text-[#9CA3AF]"
                              }
                            >
                              {" "}
                              ({opt.count})
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-xl border border-[#E5E7EB] bg-white">
                        {filteredVouchers.length === 0 ? (
                          <p className="p-3 text-[11px] text-[#6B7280]">
                            {voucherStatusFilter === "all" &&
                            voucherLevelFilter === "all"
                              ? "No vouchers."
                              : "No vouchers match these filters."}
                          </p>
                        ) : (
                          <table className="w-full min-w-[280px] border-collapse text-left text-[11px]">
                            <thead>
                              <tr className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                                <th className="px-2 py-2 pl-3">Serial</th>
                                <th className="px-2 py-2">PIN</th>
                                <th className="px-2 py-2">Level</th>
                                <th className="px-2 py-2">Status</th>
                                <th className="px-2 py-2 pr-3">Added</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F0F0] text-[#111827]">
                              {filteredVouchers.map((voucher) => (
                                <tr key={voucher.id} className="hover:bg-[#FAFAFA]">
                                  <td className="max-w-0 py-1.5 pl-3 font-mono text-[10px] font-medium">
                                    <span className="block truncate" title={voucher.serial}>
                                      {voucher.serial}
                                    </span>
                                  </td>
                                  <td className="max-w-0 py-1.5 font-mono text-[10px]">
                                    <span className="block truncate" title={voucher.pin}>
                                      {voucher.pin}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap py-1.5 text-[10px] text-[#4B5563]">
                                    {voucher.programmeLevelLabel ||
                                      PROGRAMME_LEVEL_LABELS[
                                        voucher.programmeLevel ?? "undergraduate"
                                      ]}
                                  </td>
                                  <td className="whitespace-nowrap py-1.5">
                                    <span
                                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                                        voucher.status === "Unserved"
                                          ? "bg-[#F3F4F6] text-[#4B5563]"
                                          : "bg-[#DBEAFE] text-[#1D4ED8]"
                                      }`}
                                    >
                                      {voucher.status}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap py-1.5 pr-3 text-[10px] text-[#6B7280]">
                                    {new Date(voucher.createdAt).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </section>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { adminFetch } from "../../lib/admin-client";

type FormStatus = "Issued" | "Unissued";
type FormType = "Voucher";

type FormRow = {
  id: string;
  name: string;
  email: string;
  reference: string;
  type: FormType;
  school: string;
  status: FormStatus;
  price: string;
  date: string; // ISO or formatted
};

function statusPill(status: FormStatus) {
  if (status === "Issued") {
    return (
      <span className="inline-flex rounded-md bg-[#DCFCE7] px-3 py-[5px] text-xs font-medium text-[#166534]">
        Issued
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-md bg-[#E5E7EB] px-3 py-[5px] text-xs font-medium text-[#374151]">
      Unissued
    </span>
  );
}

export default function AdminFormsSection() {
  const [activeTab, setActiveTab] = useState<"vouchers" | "payments">(
    "vouchers",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [rows, setRows] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active filters applied to the table
  const [activeStatus, setActiveStatus] = useState<FormStatus | "all">("all");
  const [activeType, setActiveType] = useState<FormType | "all">("all");
  const [activeFrom, setActiveFrom] = useState<string>("");
  const [activeTo, setActiveTo] = useState<string>("");

  // Draft values edited inside the drawer before Apply is pressed
  const [draftStatus, setDraftStatus] = useState<FormStatus | "all">("all");
  const [draftType, setDraftType] = useState<FormType | "all">("all");
  const [draftFrom, setDraftFrom] = useState<string>("");
  const [draftTo, setDraftTo] = useState<string>("");

  type VoucherPayment = {
    id: string;
    reference: string;
    email: string;
    fullName: string | null;
    amount: number;
    currency: string;
    status: string;
    school: string;
    paidAt: string;
    voucherPending?: boolean;
  };

  const [payments, setPayments] = useState<VoucherPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentsFulfilmentFilter, setPaymentsFulfilmentFilter] = useState<
    "all" | "pending" | "fulfilled"
  >("all");
  const [fulfilmentQueue, setFulfilmentQueue] = useState<{
    pendingCount: number;
    readyToFulfill: number;
    unservedStockTotal: number;
  } | null>(null);
  const [processInProgress, setProcessInProgress] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const paymentsPageSize = 10;
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (activeStatus !== "all" && row.status !== activeStatus) {
        return false;
      }

      if (activeType !== "all" && row.type !== activeType) {
        return false;
      }

      return true;
    });
  }, [rows, activeStatus, activeType]);

  const pendingPaymentCount = useMemo(
    () =>
      payments.filter(
        (payment) =>
          payment.status === "success" && payment.voucherPending === true,
      ).length,
    [payments],
  );

  const displayPendingCount = Math.max(
    pendingPaymentCount,
    fulfilmentQueue?.pendingCount ?? 0,
  );

  const filteredPayments = useMemo(() => {
    let list = payments;

    if (paymentsFulfilmentFilter === "pending") {
      list = list.filter(
        (payment) =>
          payment.status === "success" && payment.voucherPending === true,
      );
    } else if (paymentsFulfilmentFilter === "fulfilled") {
      list = list.filter(
        (payment) =>
          payment.status === "success" && payment.voucherPending !== true,
      );
    }

    const query = paymentsSearch.trim().toLowerCase();
    if (!query) return list;

    return list.filter((payment) => {
      const name = (payment.fullName || "").toLowerCase();
      const email = payment.email.toLowerCase();
      const reference = payment.reference.toLowerCase();
      const school = payment.school.toLowerCase();
      return (
        name.includes(query) ||
        email.includes(query) ||
        reference.includes(query) ||
        school.includes(query)
      );
    });
  }, [payments, paymentsSearch, paymentsFulfilmentFilter]);

  const paymentsTotalPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / paymentsPageSize),
  );

  const paginatedPayments = useMemo(() => {
    const start = (paymentsPage - 1) * paymentsPageSize;
    return filteredPayments.slice(start, start + paymentsPageSize);
  }, [filteredPayments, paymentsPage]);

  const allFilteredVouchersSelected = useMemo(
    () =>
      filteredRows.length > 0 &&
      filteredRows.every((r) => selectedFormIds.includes(r.id)),
    [filteredRows, selectedFormIds],
  );

  const allPaymentsPageSelected = useMemo(() => {
    if (paginatedPayments.length === 0) return false;
    return paginatedPayments.every((p) => selectedFormIds.includes(p.id));
  }, [paginatedPayments, selectedFormIds]);

  useEffect(() => {
    setPaymentsPage(1);
  }, [paymentsSearch, filteredPayments.length, paymentsFulfilmentFilter]);

  const loadFulfilmentQueue = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/fulfilment/queue");
      const data = await res.json();
      if (res.ok) {
        setFulfilmentQueue({
          pendingCount: data.pendingCount ?? 0,
          readyToFulfill: data.readyToFulfill ?? 0,
          unservedStockTotal: data.unservedStockTotal ?? 0,
        });
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    setSelectedFormIds([]);
  }, [activeTab, activeStatus]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/admin/forms");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load forms");
        }

        if (!cancelled) {
          const nextRows: FormRow[] = Array.isArray(data.forms)
            ? data.forms
            : [];
          setRows(nextRows);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load forms. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadFulfilmentQueue();
  }, [loadFulfilmentQueue]);

  useEffect(() => {
    if (activeTab !== "payments" || paymentsLoaded) return;

    let cancelled = false;

    async function loadPayments() {
      try {
        setPaymentsLoading(true);
        setPaymentsError(null);

        const res = await fetch("/api/admin/forms/payments");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load payments");
        }

        if (!cancelled) {
          setPayments(Array.isArray(data.payments) ? data.payments : []);
          setPaymentsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setPaymentsError("Could not load payments. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setPaymentsLoading(false);
        }
      }
    }

    void loadPayments();
    void loadFulfilmentQueue();

    return () => {
      cancelled = true;
    };
  }, [activeTab, paymentsLoaded, loadFulfilmentQueue]);

  const openFilters = () => {
    setDraftStatus(activeStatus);
    setDraftType(activeType);
    setDraftFrom(activeFrom);
    setDraftTo(activeTo);
    setFiltersOpen(true);
  };

  const handleClearFilters = () => {
    setActiveStatus("all");
    setActiveType("all");
    setActiveFrom("");
    setActiveTo("");

    setDraftStatus("all");
    setDraftType("all");
    setDraftFrom("");
    setDraftTo("");

    setFiltersOpen(false);
  };

  const handleApplyFilters = () => {
    setActiveStatus(draftStatus);
    setActiveType(draftType);
    setActiveFrom(draftFrom);
    setActiveTo(draftTo);
    setFiltersOpen(false);
  };

  async function handleRefreshForms() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/forms");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load forms");
      }

      const nextRows: FormRow[] = Array.isArray(data.forms) ? data.forms : [];
      setRows(nextRows);

      // force payments tab to reload next time it is opened
      setPaymentsLoaded(false);
      setSelectedFormIds([]);
    } catch {
      setError("Could not load forms. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleFormSelect(id: string) {
    setSelectedFormIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAllVouchers() {
    if (allFilteredVouchersSelected) {
      setSelectedFormIds((prev) =>
        prev.filter((id) => !filteredRows.some((r) => r.id === id)),
      );
    } else {
      setSelectedFormIds((prev) => [
        ...new Set([...prev, ...filteredRows.map((r) => r.id)]),
      ]);
    }
  }

  function toggleSelectAllPaymentsPage() {
    const pageIds = paginatedPayments.map((p) => p.id);
    if (allPaymentsPageSelected) {
      setSelectedFormIds((prev) =>
        prev.filter((id) => !pageIds.includes(id)),
      );
    } else {
      setSelectedFormIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  }

  async function handleDeleteForm(id: string) {
    if (!window.confirm("Delete this form record? This cannot be undone.")) {
      return;
    }
    try {
      setDeleteInProgress(true);
      const res = await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error || "Could not delete.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setPayments((prev) => prev.filter((p) => p.id !== id));
      setSelectedFormIds((prev) => prev.filter((x) => x !== id));
    } catch {
      window.alert("Could not delete. Please try again.");
    } finally {
      setDeleteInProgress(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedFormIds.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedFormIds.length} form record(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    const ids = [...selectedFormIds];
    try {
      setDeleteInProgress(true);
      const res = await fetch("/api/admin/forms/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error || "Could not delete.");
        return;
      }
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setPayments((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelectedFormIds([]);
    } catch {
      window.alert("Could not delete. Please try again.");
    } finally {
      setDeleteInProgress(false);
    }
  }

  async function handleRefreshPayments() {
    setPaymentsLoaded(false);
    setPaymentsLoading(true);
    setPaymentsError(null);

    try {
      const res = await fetch("/api/admin/forms/payments");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load payments");
      }
      setPayments(Array.isArray(data.payments) ? data.payments : []);
      setPaymentsLoaded(true);
      await loadFulfilmentQueue();
    } catch {
      setPaymentsError("Could not load payments. Please try again.");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function handleProcessPending() {
    if (processInProgress) return;

    const ready = fulfilmentQueue?.readyToFulfill ?? 0;
    if (ready === 0) {
      window.alert(
        "No pending orders can be fulfilled right now. Add unissued vouchers under the Manage schools tab first.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Issue vouchers for up to ${ready} paid order${ready === 1 ? "" : "s"} using available stock?`,
    );
    if (!confirmed) return;

    try {
      setProcessInProgress(true);
      const res = await adminFetch("/api/admin/fulfilment/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error || "Could not process pending orders.");
        return;
      }

      window.alert(
        `Fulfilled ${data.fulfilled ?? 0} order${data.fulfilled === 1 ? "" : "s"}.` +
          (data.stillPending > 0
            ? ` ${data.stillPending} still waiting for stock.`
            : ""),
      );

      await handleRefreshForms();
      await handleRefreshPayments();
    } catch {
      window.alert("Could not process pending orders. Please try again.");
    } finally {
      setProcessInProgress(false);
    }
  }

  function selectVoucherStatusFilter(status: FormStatus | "all") {
    setActiveStatus(status);
    setActiveTab("vouchers");
  }

  return (
    <>
      {/* Forms page */}
      <section className="space-y-2 rounded-3xl border border-[#BFDBFE] bg-gradient-to-r from-[#EAF4FF] via-white to-[#F2F8FF] px-5 py-5 shadow-sm">
        <p className="text-xs font-medium text-[#9CA3AF]">
          Dashboard /
          {" "}
          <span className="text-[#111827]">Voucher Orders</span>
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#007AFF] md:text-3xl">
          Voucher Orders
        </h1>
        <p className="text-sm text-[#6B7280]">
          Review voucher orders, track payment records, and keep university stock well arranged.
        </p>
      </section>

      {displayPendingCount > 0 &&
        !paymentsLoading &&
        activeTab === "vouchers" && (
          <div className="mt-4 rounded-3xl border border-amber-200/80 bg-gradient-to-r from-[#FFF7D6] to-[#FFFBEB] px-4 py-4 text-sm text-[#92400E] shadow-sm">
            <p className="font-medium">
              {displayPendingCount} paid order
              {displayPendingCount === 1 ? "" : "s"} waiting for voucher
              {displayPendingCount === 1 ? "" : "s"}.
            </p>
            <p className="mt-1 text-xs text-[#B45309]">
              {fulfilmentQueue?.readyToFulfill ?? 0} can be issued now from
              {" "}
              {fulfilmentQueue?.unservedStockTotal ?? 0} unissued voucher
              {(fulfilmentQueue?.unservedStockTotal ?? 0) === 1 ? "" : "s"} in
              stock.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(fulfilmentQueue?.readyToFulfill ?? 0) > 0 && (
                <button
                  type="button"
                  disabled={processInProgress}
                  onClick={() => void handleProcessPending()}
                  className="inline-flex items-center justify-center rounded-full bg-[#B45309] px-4 py-2 text-xs font-medium text-white hover:bg-[#92400E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processInProgress ? "Processing…" : "Process pending orders"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPaymentsFulfilmentFilter("pending");
                  setActiveTab("payments");
                }}
                className="inline-flex items-center justify-center rounded-full border border-[#FDE68A] bg-white px-4 py-2 text-xs font-medium text-[#B45309] hover:bg-[#FFFBEB]"
              >
                View pending payments
              </button>
            </div>
          </div>
        )}

      <section className="mt-6 flex min-w-0 flex-col gap-4 rounded-3xl border border-[#DBEAFE] bg-white/95 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 text-xs font-medium [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 sm:text-sm [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => selectVoucherStatusFilter("all")}
            className={`shrink-0 whitespace-nowrap pb-1 ${
              activeStatus === "all"
                ? "border-b-2 border-[#2563EB] text-[#2563EB]"
                : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            All vouchers
          </button>
          <button
            type="button"
            onClick={() => selectVoucherStatusFilter("Issued")}
            className={`shrink-0 whitespace-nowrap pb-1 ${
              activeStatus === "Issued"
                ? "border-b-2 border-[#2563EB] text-[#2563EB]"
                : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            Issued vouchers
          </button>
          <button
            type="button"
            onClick={() => selectVoucherStatusFilter("Unissued")}
            className={`shrink-0 whitespace-nowrap pb-1 ${
              activeStatus === "Unissued"
                ? "border-b-2 border-[#2563EB] text-[#2563EB]"
                : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            Unissued vouchers
          </button>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          {selectedFormIds.length > 0 && (
            <button
              type="button"
              disabled={deleteInProgress}
              onClick={() => void handleBulkDelete()}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#FECACA] bg-white px-3 py-2 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selectedFormIds.length} selected
            </button>
          )}
          <button
            type="button"
            onClick={handleRefreshForms}
            className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-xs font-medium text-[#111827] hover:bg-[#F3F4F6]"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openFilters}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"
            aria-label="Filter forms"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </section>

      <>
          <section className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-[#DBEAFE] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#EEF4FF] bg-gradient-to-r from-[#F8FBFF] to-white px-3 pt-3 pb-3 text-xs text-[#6B7280] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-4">
              <div className="inline-flex w-fit max-w-full items-center overflow-x-auto rounded-full bg-[#EEF4FF] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab("vouchers")}
                  className={`shrink-0 rounded-full px-3 py-1 font-medium ${
                    activeTab === "vouchers"
                      ? "bg-white text-[#111827] shadow-sm"
                      : "text-[#6B7280]"
                  }`}
                >
                  Voucher list
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("payments")}
                  className={`shrink-0 rounded-full px-3 py-1 font-medium ${
                    activeTab === "payments"
                      ? "bg-white text-[#111827] shadow-sm"
                      : "text-[#6B7280]"
                  }`}
                >
                  Payment records
                </button>
              </div>

              {activeTab === "payments" && (
                <input
                  type="text"
                  value={paymentsSearch}
                  onChange={(event) => setPaymentsSearch(event.target.value)}
                  placeholder="Search by name, email, reference, or school"
                  className="hidden w-full max-w-xs rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[11px] text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] md:block"
                />
              )}
            </div>

            {activeTab === "vouchers" && (
              <>
                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div className="grid grid-cols-[2.25rem_1.1fr_1.3fr_0.9fr_1.1fr_0.8fr_0.7fr_0.75fr_2.5rem] items-center border-b border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5 pl-2 text-xs font-medium text-[#31557D] sm:px-6">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-[#9CA3AF] text-[#2563EB] focus:ring-[#2563EB]"
                        checked={allFilteredVouchersSelected}
                        disabled={deleteInProgress || filteredRows.length === 0}
                        onChange={toggleSelectAllVouchers}
                        title="Select all in list"
                        aria-label="Select all in list"
                      />
                      <span>Name</span>
                      <span>Email</span>
                      <span title="Paystack reference">Ref</span>
                      <span>School</span>
                      <span>Status</span>
                      <span>Price</span>
                      <span className="text-right">Date</span>
                      <span className="sr-only">Action</span>
                    </div>

                    <div className="divide-y divide-[#E5E7EB] text-sm text-[#111827]">
              {loading ? (
                <div className="px-6 py-4 text-xs text-[#6B7280]">
                  Loading voucher orders...
                </div>
              ) : error ? (
                <div className="px-6 py-4 text-xs text-[#DC2626]">{error}</div>
              ) : filteredRows.length === 0 ? (
                <div className="px-6 py-4 text-xs text-[#6B7280]">
                  No voucher orders found for this filter.
                </div>
              ) : (
                filteredRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[2.25rem_1.1fr_1.3fr_0.9fr_1.1fr_0.8fr_0.7fr_0.75fr_2.5rem] items-center px-3 py-2.5 pl-2 sm:px-6"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-[#9CA3AF] text-[#2563EB] focus:ring-[#2563EB]"
                      checked={selectedFormIds.includes(row.id)}
                      disabled={deleteInProgress}
                      onChange={() => toggleFormSelect(row.id)}
                      aria-label={`Select form ${row.name}`}
                    />
                    <span className="min-w-0 truncate" title={row.name}>
                      {row.name}
                    </span>
                    <span
                      className="min-w-0 truncate text-[#4B5563]"
                      title={row.email}
                    >
                      {row.email}
                    </span>
                    <span
                      className="min-w-0 truncate font-mono text-[11px] text-[#4B5563]"
                      title={row.reference}
                    >
                      {row.reference}
                    </span>
                    <span
                      className="min-w-0 truncate text-[#4B5563]"
                      title={row.school}
                    >
                      {row.school}
                    </span>
                    <span className="min-w-0">{statusPill(row.status)}</span>
                    <span className="min-w-0 text-[#4B5563]">
                      {row.price}
                    </span>
                    <span className="min-w-0 text-right text-[#6B7280]">
                      {new Date(row.date).toLocaleDateString()}
                    </span>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        disabled={deleteInProgress}
                        onClick={() => void handleDeleteForm(row.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#B91C1C] disabled:opacity-50"
                        aria-label="Delete form"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "payments" && (
              <div className="mt-4 overflow-x-auto px-4 pb-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5EFFD] bg-[#F8FBFF] px-3 py-3 text-[11px]">
                    <span className="font-medium text-[#6B7280]">Show:</span>
                    <button
                      type="button"
                      onClick={() => setPaymentsFulfilmentFilter("all")}
                      className={`rounded-full px-3 py-1 font-medium ${
                        paymentsFulfilmentFilter === "all"
                          ? "bg-[#111827] text-white"
                          : "bg-[#EFF6FF] text-[#31557D] ring-1 ring-[#DBEAFE] hover:bg-[#DBEAFE]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentsFulfilmentFilter("pending")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
                        paymentsFulfilmentFilter === "pending"
                          ? "bg-[#B45309] text-white"
                          : "bg-white text-[#4B5563] ring-1 ring-[#E5E7EB] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      Pending
                      {pendingPaymentCount > 0 &&
                        paymentsFulfilmentFilter !== "pending" && (
                          <span className="rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400E]">
                            {pendingPaymentCount}
                          </span>
                        )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentsFulfilmentFilter("fulfilled")}
                      className={`rounded-full px-3 py-1 font-medium ${
                        paymentsFulfilmentFilter === "fulfilled"
                          ? "bg-[#166534] text-white"
                          : "bg-[#ECFDF3] text-[#166534] ring-1 ring-[#BBF7D0] hover:bg-[#DCFCE7]"
                      }`}
                    >
                      Fulfilled
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(fulfilmentQueue?.readyToFulfill ?? 0) > 0 && (
                      <button
                        type="button"
                        disabled={processInProgress}
                        onClick={() => void handleProcessPending()}
                        className="inline-flex items-center justify-center rounded-full bg-[#B45309] px-4 py-2 text-xs font-medium text-white hover:bg-[#92400E] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {processInProgress ? "Processing…" : "Process pending"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRefreshPayments()}
                      className="inline-flex items-center justify-center rounded-full border border-[#DBEAFE] bg-white px-3 py-2 text-[11px] font-medium text-[#111827] hover:bg-[#F8FBFF]"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="mb-3 block md:hidden">
                  <input
                    type="text"
                    value={paymentsSearch}
                    onChange={(event) => setPaymentsSearch(event.target.value)}
                    placeholder="Search payments"
                    className="w-full rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[11px] text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                  />
                </div>
                <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-[11px]">
                  <thead className="bg-[#F9FAFB] text-[#6B7280]">
                    <tr>
                      <th className="w-8 px-1 py-2 sm:px-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-[#9CA3AF] text-[#2563EB] focus:ring-[#2563EB]"
                          checked={allPaymentsPageSelected}
                          disabled={deleteInProgress || paginatedPayments.length === 0}
                          onChange={toggleSelectAllPaymentsPage}
                          title="Select all on this page"
                          aria-label="Select all on this page"
                        />
                      </th>
                      <th className="px-2 py-2 font-medium sm:px-3">Payer</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Reference</th>
                      <th className="px-2 py-2 font-medium sm:px-3">School</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Amount</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Status</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Paid at</th>
                      <th className="w-8 px-1 py-2 sm:px-2">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {paymentsLoading ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-4 text-center text-[11px] text-[#6B7280]"
                        >
                          Loading payments...
                        </td>
                      </tr>
                    ) : paymentsError ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-4 text-center text-[11px] text-[#DC2626]"
                        >
                          {paymentsError}
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-4 text-center text-[11px] text-[#6B7280]"
                        >
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-[#F9FAFB]">
                          <td className="px-1 py-2 align-middle sm:px-2">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-[#9CA3AF] text-[#2563EB] focus:ring-[#2563EB]"
                              checked={selectedFormIds.includes(payment.id)}
                              disabled={deleteInProgress}
                              onChange={() => toggleFormSelect(payment.id)}
                              aria-label="Select row"
                            />
                          </td>
                          <td className="px-2 py-2 align-middle sm:px-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-[#111827]">
                                {payment.fullName || payment.email}
                              </span>
                              <span className="text-[11px] text-[#6B7280]">
                                {payment.email}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 align-middle font-mono text-[11px] text-[#111827] sm:px-3">
                            {payment.reference}
                          </td>
                          <td className="px-2 py-2 align-middle text-[11px] text-[#6B7280] sm:px-3">
                            {payment.school}
                          </td>
                          <td className="px-2 py-2 align-middle sm:px-3">
                            <span className="font-medium text-[#111827]">
                              {payment.currency}
                              {" "}
                              {(payment.amount / 100).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-middle sm:px-3">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex w-fit rounded-full px-2 py-1 text-[11px] font-medium ${
                                  payment.status === "success"
                                    ? "bg-[#ECFDF3] text-[#166534]"
                                    : "bg-[#FEF2F2] text-[#B91C1C]"
                                }`}
                              >
                                {payment.status}
                              </span>
                              {payment.status === "success" &&
                                payment.voucherPending && (
                                  <span className="inline-flex w-fit rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#92400E]">
                                    Voucher pending
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-2 py-2 align-middle text-[11px] text-[#6B7280] sm:px-3">
                            {new Date(payment.paidAt).toLocaleString()}
                          </td>
                          <td className="px-1 py-2 text-center align-middle sm:px-2">
                            <button
                              type="button"
                              disabled={deleteInProgress}
                              onClick={() => void handleDeleteForm(payment.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#B91C1C] disabled:opacity-50"
                              aria-label="Delete record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {!paymentsLoading && !paymentsError &&
                  filteredPayments.length > 0 && (
                    <div className="mt-3 flex flex-col gap-3 text-[11px] text-[#6B7280] sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0">
                        Showing{" "}
                        <span className="font-medium text-[#111827]">
                          {Math.min(
                            filteredPayments.length,
                            (paymentsPage - 1) * paymentsPageSize + 1,
                          )}
                        </span>{" "}
                        to{" "}
                        <span className="font-medium text-[#111827]">
                          {Math.min(
                            filteredPayments.length,
                            paymentsPage * paymentsPageSize,
                          )}
                        </span>{" "}
                        of{" "}
                        <span className="font-medium text-[#111827]">
                          {filteredPayments.length}
                        </span>{" "}
                        payments
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentsPage((page) => Math.max(1, page - 1))
                          }
                          disabled={paymentsPage === 1}
                          className="shrink-0 rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-medium text-[#111827] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
                        >
                          Previous
                        </button>
                        <span>
                          Page{" "}
                          <span className="font-medium text-[#111827]">
                            {paymentsPage}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium text-[#111827]">
                            {paymentsTotalPages}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentsPage((page) =>
                              Math.min(paymentsTotalPages, page + 1),
                            )
                          }
                          disabled={paymentsPage === paymentsTotalPages}
                          className="shrink-0 rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-medium text-[#111827] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </section>

          <section className="mt-6 flex items-center justify-center overflow-x-auto px-1">
            <div className="inline-flex min-w-0 max-w-full items-center justify-center gap-4 overflow-x-auto rounded-md bg-[#F3F4F6] px-4 py-2 text-xs font-medium text-[#111827] sm:min-w-[220px] sm:gap-6 sm:px-8">
              <span>Page 1 of 2</span>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-black shadow-sm"
                aria-label="Previous page"
              >
                <span className="-mt-px text-sm">&#8249;</span>
              </button>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-black shadow-sm"
                aria-label="Next page"
              >
                <span className="-mt-px text-sm">&#8250;</span>
              </button>
            </div>
          </section>
        </>

      {filtersOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl [padding-bottom:env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
              <div>
                <h2 className="text-base font-semibold text-[#1E1E1E]">
                  Filter forms
                </h2>
                <p className="text-xs text-[#9E9E9E]">
                  Refine the table by status, type, or date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E0E0E0] text-[#1E1E1E] hover:bg-[#F5F5F5]"
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Voucher status
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setDraftStatus(draftStatus === "Issued" ? "all" : "Issued")
                    }
                    className={`rounded-full border px-3 py-1 text-[#4B5563] hover:bg-[#F3F4F6] ${
                      draftStatus === "Issued" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E5E7EB]"
                    }`}
                  >
                    Issued
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftStatus(
                        draftStatus === "Unissued" ? "all" : "Unissued",
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-[#4B5563] hover:bg-[#F3F4F6] ${
                      draftStatus === "Unissued" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E5E7EB]"
                    }`}
                  >
                    Unissued
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
                  Date range
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#6B7280]">From</p>
                    <input
                      type="date"
                      value={draftFrom}
                      onChange={(event) => setDraftFrom(event.target.value)}
                      className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#6B7280]">To</p>
                    <input
                      type="date"
                      value={draftTo}
                      onChange={(event) => setDraftTo(event.target.value)}
                      className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#E5E5E5] px-5 py-3 text-xs">
              <button
                type="button"
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-[#111827] hover:bg-[#F3F4F6]"
                onClick={handleClearFilters}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-full bg-[#007AFF] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0062CC]"
                onClick={handleApplyFilters}
              >
                Apply filters
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

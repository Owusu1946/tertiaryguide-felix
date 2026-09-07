"use client";

import React, { useMemo } from "react";
import {
  Activity,
  CalendarDays,
  CircleDollarSign,
  GraduationCap,
  PieChart as PieIcon,
  Ticket,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brandChartColors, normalizeBrandColor } from "@/lib/brand-theme";

type AnalyticsData = {
  applicationsPerDay: { date: string; count: number }[];
  applicationsPerMonth: { month: string; count: number }[];
  applicationsByStatus: { status: string; count: number }[];
  revenuePerMonth: { month: string; total: number; count: number }[];
  vouchersByLevel?: {
    undergraduate: { count: number; revenue: number };
    postgraduate: { count: number; revenue: number };
  };
  vouchersPerMonthByLevel?: {
    month: string;
    undergraduate: number;
    postgraduate: number;
    undergradRevenue: number;
    postgradRevenue: number;
  }[];
};

type Props = {
  analytics: AnalyticsData;
  brandColor: string;
};

const STATUS_FALLBACK: Record<string, string> = {
  Pending: "#F59E0B",
  "Under Review": "#0369A1",
  Approved: "#10B981",
  Rejected: "#EF4444",
  Admitted: "#7C3AED",
};

export function AnalyticsSection({ analytics, brandColor }: Props) {
  const brand = normalizeBrandColor(brandColor);
  const palette = brandChartColors(brand);
  const undergradColor = "#0369A1";
  const postgradColor = "#0F766E";

  const statusData = useMemo(
    () =>
      analytics.applicationsByStatus.map((s, i) => ({
        name: s.status || "Unknown",
        value: s.count,
        fill: STATUS_FALLBACK[s.status] || palette[i % palette.length],
      })),
    [analytics.applicationsByStatus, palette],
  );

  const dayData = useMemo(
    () =>
      analytics.applicationsPerDay.slice(-21).map((d) => ({
        date: d.date?.slice(5) || d.date,
        applications: d.count,
      })),
    [analytics.applicationsPerDay],
  );

  const monthData = useMemo(
    () =>
      analytics.applicationsPerMonth.slice(-12).map((m) => ({
        month: m.month,
        applications: m.count,
      })),
    [analytics.applicationsPerMonth],
  );

  const revenueData = useMemo(
    () =>
      analytics.revenuePerMonth.slice(-12).map((r) => ({
        month: r.month,
        revenue: r.total,
        sales: r.count,
      })),
    [analytics.revenuePerMonth],
  );

  const levelTotals = analytics.vouchersByLevel || {
    undergraduate: { count: 0, revenue: 0 },
    postgraduate: { count: 0, revenue: 0 },
  };

  const levelPie = useMemo(
    () =>
      [
        {
          name: "Undergraduate",
          value: levelTotals.undergraduate.count,
          fill: undergradColor,
        },
        {
          name: "Postgraduate",
          value: levelTotals.postgraduate.count,
          fill: postgradColor,
        },
      ].filter((row) => row.value > 0),
    [levelTotals.undergraduate.count, levelTotals.postgraduate.count],
  );

  const levelMonthData = useMemo(
    () =>
      (analytics.vouchersPerMonthByLevel || []).slice(-12).map((row) => ({
        month: row.month,
        Undergraduate: row.undergraduate,
        Postgraduate: row.postgraduate,
      })),
    [analytics.vouchersPerMonthByLevel],
  );

  const empty =
    statusData.length === 0 &&
    dayData.length === 0 &&
    revenueData.length === 0 &&
    levelPie.length === 0;

  if (empty) {
    return (
      <section className="rounded-3xl border border-[#E5E7EB] bg-white px-6 py-14 text-center shadow-sm">
        <Activity className="mx-auto h-8 w-8 text-[var(--school-brand)]" />
        <p className="mt-3 text-sm font-medium text-[#111827]">No analytics yet</p>
        <p className="mt-1 text-xs text-[#6B7280]">
          Charts will appear once applications and voucher sales start coming in.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                Undergraduate purchases
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">
                {levelTotals.undergraduate.count}
              </p>
              <p className="mt-1 text-sm text-[#64748B]">
                GHS{" "}
                {levelTotals.undergraduate.revenue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                revenue
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0369A1]">
              <GraduationCap className="h-5 w-5" />
            </span>
          </div>
        </article>
        <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                Postgraduate purchases
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#0F172A]">
                {levelTotals.postgraduate.count}
              </p>
              <p className="mt-1 text-sm text-[#64748B]">
                GHS{" "}
                {levelTotals.postgraduate.revenue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                revenue
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CCFBF1] text-[#0F766E]">
              <Ticket className="h-5 w-5" />
            </span>
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--school-brand-soft)] text-[var(--school-brand)]">
              <Ticket className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#111827]">
                Voucher purchases by level
              </h3>
              <p className="text-xs text-[#6B7280]">
                Undergraduate vs postgraduate sales
              </p>
            </div>
          </div>
          {levelPie.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6B7280]">
              No voucher purchases yet.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={levelPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {levelPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--school-brand-soft)] text-[var(--school-brand)]">
              <PieIcon className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#111827]">Applications by status</h3>
              <p className="text-xs text-[#6B7280]">Distribution of current pipeline</p>
            </div>
          </div>
          {statusData.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6B7280]">No status data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--school-brand-soft)] text-[var(--school-brand)]">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#111827]">
                Purchases by level over time
              </h3>
              <p className="text-xs text-[#6B7280]">
                Monthly undergraduate and postgraduate voucher sales
              </p>
            </div>
          </div>
          {levelMonthData.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6B7280]">
              No monthly purchase data yet.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={levelMonthData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="Undergraduate"
                    fill={undergradColor}
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="Postgraduate"
                    fill={postgradColor}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--school-brand-soft)] text-[var(--school-brand)]">
              <CircleDollarSign className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#111827]">Revenue by month</h3>
              <p className="text-xs text-[#6B7280]">Successful voucher payments</p>
            </div>
          </div>
          {revenueData.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6B7280]">No revenue yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`GHS ${value}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill={brand} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--school-brand-soft)] text-[var(--school-brand)]">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#111827]">
                Applications per day
              </h3>
              <p className="text-xs text-[#6B7280]">Last 21 days with activity</p>
            </div>
          </div>
          {dayData.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6B7280]">
              No daily application data yet.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dayData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke={brand}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: brand }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        {monthData.length > 0 && (
          <article className="rounded-3xl border border-[var(--school-brand-border)] bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--school-brand-soft)] text-[var(--school-brand)]">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-semibold text-[#111827]">
                  Applications per month
                </h3>
                <p className="text-xs text-[#6B7280]">Monthly submission volume</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="applications"
                    fill={palette[1] || brand}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

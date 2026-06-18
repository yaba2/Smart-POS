import { Suspense } from "react";
import { requireWaiter } from "@/lib/auth";
import { getSettings } from "@/actions/settings";
import { getMyShifts, getShiftReport, getDailyReport } from "@/actions/shifts";
import { ReportClient } from "@/components/pos/report-client";
import { redirect } from "next/navigation";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: { shiftId?: string; mode?: string; date?: string; tz?: string };
}) {
  const session = await requireWaiter();

  if (!session.permissions?.includes("VIEW_REPORTS") && session.role !== "ADMIN") {
    redirect("/pos/tables");
  }

  // Default to daily mode so today's sales are always visible
  const mode = searchParams.mode === "shift" ? "shift" : "daily";
  const [myShifts, settings] = await Promise.all([getMyShifts(), getSettings()]);

  // Shift report — include open shift too so cashier can see live data
  const shiftId = searchParams.shiftId ?? myShifts[0]?.id ?? null;
  const shiftReport = mode === "shift" && shiftId ? await getShiftReport(shiftId) : null;

  // Daily report — use client-supplied UTC offset so "today" is correct in local time
  const utcOffset = parseInt(searchParams.tz ?? "0", 10); // minutes, e.g. +180 for UTC+3
  const localNow = new Date(Date.now() + utcOffset * 60 * 1000);
  const todayStr = localNow.toISOString().slice(0, 10);
  const dateStr = searchParams.date ?? todayStr;
  const dailyReport = await getDailyReport(dateStr, utcOffset);

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <ReportClient
        mode={mode}
        shifts={myShifts}
        selectedShiftId={shiftId}
        shiftReport={shiftReport}
        dailyReport={dailyReport}
        selectedDate={dateStr}
        currencySymbol={settings.currencySymbol}
        restaurantName={settings.restaurantName}
        receiptFooter={settings.receiptFooter ?? ""}
      />
    </Suspense>
  );
}

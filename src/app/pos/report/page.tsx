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

  const mode = searchParams.mode === "shift" ? "shift" : "daily";
  const utcOffset = parseInt(searchParams.tz ?? "0", 10);
  const localNow = new Date(Date.now() + utcOffset * 60 * 1000);
  const todayStr = localNow.toISOString().slice(0, 10);
  const dateStr = searchParams.date ?? todayStr;

  let myShifts: Awaited<ReturnType<typeof getMyShifts>> = [];
  let shiftReport: Awaited<ReturnType<typeof getShiftReport>> | null = null;
  let dailyReport: Awaited<ReturnType<typeof getDailyReport>> | null = null;
  let currencySymbol = "$";
  let restaurantName = "";
  let receiptFooter = "";

  try {
    const [ms, settings] = await Promise.all([getMyShifts(), getSettings()]);
    myShifts = ms;
    currencySymbol = settings.currencySymbol;
    restaurantName = settings.restaurantName;
    receiptFooter = settings.receiptFooter ?? "";
    const shiftId = searchParams.shiftId ?? myShifts[0]?.id ?? null;
    if (mode === "shift" && shiftId) shiftReport = await getShiftReport(shiftId);
    dailyReport = await getDailyReport(dateStr, utcOffset);
  } catch {
    // DB unreachable (offline)
  }

  const shiftId = searchParams.shiftId ?? myShifts[0]?.id ?? null;

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <ReportClient
        mode={mode}
        shifts={myShifts}
        selectedShiftId={shiftId}
        shiftReport={shiftReport}
        dailyReport={dailyReport}
        selectedDate={dateStr}
        currencySymbol={currencySymbol}
        restaurantName={restaurantName}
        receiptFooter={receiptFooter}
      />
    </Suspense>
  );
}

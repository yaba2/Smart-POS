import { requireWaiter } from "@/lib/auth";
import { getSettings } from "@/actions/settings";
import { getCurrentShift, getMyShifts, getTodayShiftStatus } from "@/actions/shifts";
import { ShiftClient } from "@/components/pos/shift-client";
import { redirect } from "next/navigation";

export default async function ShiftPage() {
  const session = await requireWaiter();

  if (!session.permissions?.includes("CLOSE_SHIFT") && session.role !== "ADMIN") {
    redirect("/pos/tables");
  }

  const [currentShift, myShifts, settings, todayStatus] = await Promise.all([
    getCurrentShift(),
    getMyShifts(),
    getSettings(),
    getTodayShiftStatus(),
  ]);

  return (
    <ShiftClient
      currentShift={currentShift}
      shifts={myShifts}
      currencySymbol={settings.currencySymbol}
      userName={session.name || ""}
      morningDone={todayStatus.morning}
      eveningDone={todayStatus.evening}
    />
  );
}

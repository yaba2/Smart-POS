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

  let currentShift: Awaited<ReturnType<typeof getCurrentShift>> = null;
  let myShifts: Awaited<ReturnType<typeof getMyShifts>> = [];
  let currencySymbol = "$";
  let morningDone = false;
  let eveningDone = false;

  try {
    const [cs, ms, settings, todayStatus] = await Promise.all([
      getCurrentShift(),
      getMyShifts(),
      getSettings(),
      getTodayShiftStatus(),
    ]);
    currentShift = cs;
    myShifts = ms;
    currencySymbol = settings.currencySymbol;
    morningDone = todayStatus.morning;
    eveningDone = todayStatus.evening;
  } catch {
    // DB unreachable (offline)
  }

  return (
    <ShiftClient
      currentShift={currentShift}
      shifts={myShifts}
      currencySymbol={currencySymbol}
      userName={session.name || ""}
      morningDone={morningDone}
      eveningDone={eveningDone}
    />
  );
}

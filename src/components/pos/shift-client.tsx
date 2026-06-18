"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { openShift, closeShift } from "@/actions/shifts";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, CheckCircle2, XCircle, ArrowLeft, Sun, Moon, BarChart3, AlertCircle } from "lucide-react";

interface Shift {
  id: string;
  shiftType: string;
  openedAt: Date;
  closedAt: Date | null;
  openingCash: number;
  closingCash: number | null;
  notes: string | null;
}

interface ShiftClientProps {
  currentShift: Shift | null;
  shifts: Shift[];
  currencySymbol: string;
  userName: string;
  morningDone: boolean;
  eveningDone: boolean;
}

function fmt(d: Date) {
  const dt = new Date(d);
  const date = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

function duration(open: Date, close: Date | null) {
  const ms = (close ? new Date(close) : new Date()).getTime() - new Date(open).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function ShiftClient({ currentShift, shifts, currencySymbol, userName, morningDone, eveningDone }: ShiftClientProps) {
  const router = useRouter();
  const sym = currencySymbol || "$";
  const tz = -new Date().getTimezoneOffset(); // e.g. +180 for UTC+3
  const [loading, setLoading] = useState(false);
  const [shiftType, setShiftType] = useState<"MORNING" | "EVENING">("MORNING");
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenShift = async () => {
    const cash = parseFloat(openingCash) || 0;
    setLoading(true);
    try {
      const result = await openShift(cash, shiftType);
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        toast({ title: result.alreadyOpen ? `Shift already open — ${result.shift.shiftType}` : `Shift open — ${shiftType}` });
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!confirm("Close this shift?")) return;
    const cash = parseFloat(closingCash) || 0;
    setLoading(true);
    try {
      const result = await closeShift(cash, notes || undefined);
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        toast({ title: "Shift closed successfully" });
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const bothDone = morningDone && eveningDone;

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/pos/tables")}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Tables</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Shift</h1>
            <p className="text-xs text-gray-400">{userName}</p>
          </div>
        </div>
        <Link href={`/pos/report?tz=${tz}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
            <BarChart3 className="w-3.5 h-3.5" />
            Reports
          </Button>
        </Link>
      </div>

      {/* Today's shift status badges */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
          morningDone ? "bg-green-50 border-green-200" :
          (currentShift?.shiftType === "MORNING" ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200")
        }`}>
          <Sun className={`w-4 h-4 ${
            morningDone ? "text-green-500" :
            (currentShift?.shiftType === "MORNING" ? "text-orange-500" : "text-gray-400")
          }`} />
          <div>
            <p className="text-xs font-semibold text-gray-700">Morning</p>
            <p className={`text-[10px] ${
              morningDone ? "text-green-600" :
              (currentShift?.shiftType === "MORNING" ? "text-orange-500" : "text-gray-400")
            }`}>
              {morningDone ? (bothDone ? "Done" : "Completed") : currentShift?.shiftType === "MORNING" ? "Open" : "Not started"}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
          eveningDone ? "bg-green-50 border-green-200" :
          (currentShift?.shiftType === "EVENING" ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200")
        }`}>
          <Moon className={`w-4 h-4 ${
            eveningDone ? "text-green-500" :
            (currentShift?.shiftType === "EVENING" ? "text-purple-500" : "text-gray-400")
          }`} />
          <div>
            <p className="text-xs font-semibold text-gray-700">Evening</p>
            <p className={`text-[10px] ${
              eveningDone ? "text-green-600" :
              (currentShift?.shiftType === "EVENING" ? "text-purple-500" : "text-gray-400")
            }`}>
              {eveningDone ? (bothDone ? "Done" : "Completed") : currentShift?.shiftType === "EVENING" ? "Open" : "Not started"}
            </p>
          </div>
        </div>
      </div>

      {/* Current shift — OPEN */}
      {currentShift ? (
        <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              {currentShift.shiftType === "MORNING" ? "Morning" : "Evening"} Shift — Open
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Opened At</p>
                <p className="font-medium">{fmt(currentShift.openedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Duration</p>
                <p className="font-medium">{duration(currentShift.openedAt, null)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Opening Cash</p>
                <p className="font-medium">{sym}{currentShift.openingCash.toFixed(2)}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Closing Cash ({sym})</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes for this shift..."
                />
              </div>
              <Button
                onClick={handleCloseShift}
                disabled={loading || !closingCash}
                className="w-full bg-red-500 hover:bg-red-600 gap-2"
              >
                <XCircle className="w-4 h-4" />
                {loading ? "Closing..." : "Close Shift"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm border-l-4 border-l-gray-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" /> Open New Shift
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* New cycle notice when both shifts were already completed */}
            {bothDone && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700">Both shifts completed — starting a new cycle.</p>
              </div>
            )}
            {/* Shift type selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShiftType("MORNING")}
                disabled={morningDone && !bothDone}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  morningDone && !bothDone
                    ? "opacity-40 cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400"
                    : shiftType === "MORNING"
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-orange-200"
                }`}
              >
                <Sun className="w-4 h-4" />
                Morning
              </button>
              <button
                onClick={() => setShiftType("EVENING")}
                disabled={eveningDone && !bothDone}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  eveningDone && !bothDone
                    ? "opacity-40 cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400"
                    : shiftType === "EVENING"
                    ? "border-purple-400 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-purple-200"
                }`}
              >
                <Moon className="w-4 h-4" />
                Evening
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Opening Cash ({sym})</Label>
              <Input
                type="number" min="0" step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button
              onClick={handleOpenShift}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? "Opening..." : `Open ${shiftType.charAt(0) + shiftType.slice(1).toLowerCase()} Shift`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Shift history */}
      {shifts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Shift History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={s.shiftType === "MORNING" ? "text-orange-400" : "text-purple-400"}>
                    {s.shiftType === "MORNING" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.shiftType.charAt(0) + s.shiftType.slice(1).toLowerCase()} · {fmt(s.openedAt)}</p>
                    <p className="text-xs text-gray-400">
                      {s.closedAt ? `Closed · ${duration(s.openedAt, s.closedAt)}` : "Open"}
                      {" · "}Opening: {sym}{s.openingCash.toFixed(2)}
                      {s.closingCash != null && ` · Closing: ${sym}${s.closingCash.toFixed(2)}`}
                    </p>
                  </div>
                  {s.closedAt && (
                    <Link href={`/pos/report?mode=shift&shiftId=${s.id}&tz=${tz}`} className="text-xs text-blue-500 hover:text-blue-700">
                      Report
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

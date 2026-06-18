"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { getShiftReport, getDailyReport } from "@/actions/shifts";
import {
  ArrowLeft, Printer, Download, Sun, Moon,
  Banknote, CreditCard, Smartphone,
  ShoppingBag, Users, Tag, Calendar, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ShiftReport = Awaited<ReturnType<typeof getShiftReport>>;
type DailyReport = Awaited<ReturnType<typeof getDailyReport>>;

interface Shift {
  id: string;
  shiftType: string;
  openedAt: Date;
  closedAt: Date | null;
  openingCash: number;
  closingCash: number | null;
}

interface ReportClientProps {
  mode: "shift" | "daily";
  shifts: Shift[];
  selectedShiftId: string | null;
  shiftReport: ShiftReport | null;
  dailyReport: DailyReport | null;
  selectedDate: string;
  currencySymbol: string;
  restaurantName: string;
  receiptFooter: string;
}

function fmt(d: Date) {
  const dt = new Date(d);
  const date = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dur(a: Date, b: Date | null) {
  const ms = (b ? new Date(b) : new Date()).getTime() - new Date(a).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function fmtDateLabel(dateStr: string) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* ── Real PDF download via Blob anchor ── */
function downloadPdfBlob(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;";
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow!.document.title = filename;
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 2000);
  };
  iframe.src = url;
}

export function ReportClient({
  mode, shifts, selectedShiftId, shiftReport, dailyReport, selectedDate,
  currencySymbol, restaurantName, receiptFooter,
}: ReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sym = currencySymbol || "$";

  const allShifts = shifts; // include open shifts so live data is visible

  // On first load, inject the browser's UTC offset so the server computes correct local date
  useEffect(() => {
    const tz = -new Date().getTimezoneOffset(); // e.g. +180 for UTC+3
    if (!searchParams.get("tz")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tz", String(tz));
      router.replace(`/pos/report?${params.toString()}`);
    }
  }, []);

  const tz = searchParams.get("tz") ?? "0";

  const handleTabSwitch = (newMode: "shift" | "daily") => {
    if (newMode === "shift") {
      const q = selectedShiftId ? `?mode=shift&shiftId=${selectedShiftId}&tz=${tz}` : `?mode=shift&tz=${tz}`;
      router.push(`/pos/report${q}`);
    } else {
      router.push(`/pos/report?mode=daily&date=${selectedDate}&tz=${tz}`);
    }
  };

  const handleShiftChange = (id: string) => {
    router.push(`/pos/report?mode=shift&shiftId=${id}&tz=${tz}`);
  };

  const handleDateChange = (date: string) => {
    router.push(`/pos/report?mode=daily&date=${date}&tz=${tz}`);
  };

  /* ── Thermal Print ── */
  const handlePrint = () => {
    const report = mode === "shift" ? shiftReport : null;
    if (!report && mode === "shift") return;
    const html = mode === "shift" && shiftReport
      ? buildThermalHtml(shiftReport, sym, restaurantName, receiptFooter)
      : buildDailyThermalHtml(dailyReport!, sym, restaurantName, receiptFooter);
    const win = window.open("", "_blank", "width=420,height=700");
    if (!win) { alert("Please allow pop-ups to print."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  /* ── PDF Download ── */
  const handlePdf = () => {
    const html = mode === "shift" && shiftReport
      ? buildA4Html(shiftReport, sym, restaurantName, receiptFooter)
      : dailyReport
        ? buildDailyA4Html(dailyReport, sym, restaurantName, receiptFooter)
        : null;
    if (!html) return;
    const label = mode === "shift" && shiftReport
      ? `${shiftReport.shift.shiftType}-shift-report`
      : `daily-report-${selectedDate}`;
    downloadPdfBlob(html, label);
  };

  const hasReport = mode === "shift" ? !!shiftReport : !!dailyReport;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/pos/shift")}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Shift</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reports</h1>
            <p className="text-xs text-gray-400">Sales summary</p>
          </div>
        </div>
        {hasReport && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button size="sm" onClick={handlePdf} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => handleTabSwitch("shift")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            mode === "shift" ? "bg-white shadow text-orange-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-4 h-4" /> Shift Report
        </button>
        <button
          onClick={() => handleTabSwitch("daily")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            mode === "daily" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Calendar className="w-4 h-4" /> Daily Report
        </button>
      </div>

      {/* ── SHIFT REPORT TAB ── */}
      {mode === "shift" && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">Select Shift</label>
              {allShifts.length === 0 ? (
                <p className="text-sm text-gray-400">No shifts yet</p>
              ) : (
                <select
                  value={selectedShiftId ?? ""}
                  onChange={(e) => handleShiftChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white"
                >
                  {allShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shiftType === "MORNING" ? "☀️ Morning" : "🌙 Evening"} — {fmt(s.openedAt)}{s.closedAt ? ` → ${fmtTime(s.closedAt)}` : " (open)"}
                    </option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          {!shiftReport && (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Select a shift to view its report</p>
            </div>
          )}

          {shiftReport && <ReportTables report={shiftReport} sym={sym} taxRate={0} mode="shift" />}
        </>
      )}

      {/* ── DAILY REPORT TAB ── */}
      {mode === "daily" && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
              />
              {dailyReport && (
                <p className="text-xs text-gray-500">{fmtDateLabel(selectedDate)}</p>
              )}
            </CardContent>
          </Card>

          {dailyReport && (
            <>
              {/* Shifts summary for the day */}
              {dailyReport.shifts.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-1 pt-4">
                    <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Shifts on This Day
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Shift</th>
                          <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Cashier</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Opened</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Closed</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyReport.shifts.map((s, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-4 py-2 font-medium flex items-center gap-1">
                              {s.shiftType === "MORNING" ? <Sun className="w-3.5 h-3.5 text-orange-400" /> : <Moon className="w-3.5 h-3.5 text-purple-400" />}
                              {s.shiftType === "MORNING" ? "Morning" : "Evening"}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{(s as { user?: { name?: string } }).user?.name ?? "—"}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{fmtTime(s.openedAt)}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{s.closedAt ? fmtTime(s.closedAt) : <span className="text-yellow-500">Open</span>}</td>
                            <td className="px-4 py-2 text-right text-gray-400">{dur(s.openedAt, s.closedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
              <ReportTables report={dailyReport} sym={sym} taxRate={0} mode="daily" />
            </>
          )}

          {dailyReport && dailyReport.orderCount === 0 && (
            <div className="text-center py-10 text-gray-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No sales recorded on {fmtDateLabel(selectedDate)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Shared report tables component ── */
function ReportTables({ report, sym, mode }: {
  report: {
    totalSales: number;
    orderCount: number;
    byMethod: Record<string, { count: number; total: number }>;
    byWaiter: { name: string; count: number; total: number }[];
    byCategory: { name: string; qty: number; total: number }[];
    byItem: { name: string; category: string; qty: number; total: number }[];
    byShift?: { shiftType: string; cashier: string; count: number; total: number }[];
    cancelledOrders?: { id: string; table: { name: string }; waiter: { name: string }; total: number; updatedAt: Date; orderItems: { quantity: number; price: number; menuItem: { name: string } }[] }[];
    cancelledTotal?: number;
    cancelledCount?: number;
    shift?: { shiftType: string; openedAt: Date; closedAt: Date | null; openingCash: number; closingCash: number | null };
  };
  sym: string;
  taxRate: number;
  mode: "shift" | "daily";
}) {
  return (
    <div className="space-y-4">
      {/* Summary boxes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-orange-600">{sym}{report.totalSales.toFixed(2)}</div>
          <div className="text-xs text-orange-700 mt-0.5">Total Sales</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-blue-600">{report.orderCount}</div>
          <div className="text-xs text-blue-700 mt-0.5">Orders</div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-green-600">{report.orderCount > 0 ? `${sym}${(report.totalSales / report.orderCount).toFixed(2)}` : `${sym}0`}</div>
          <div className="text-xs text-green-700 mt-0.5">Avg Order</div>
        </div>
      </div>

      {/* Shift info (only for shift mode) */}
      {report.shift && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              {report.shift.shiftType === "MORNING" ? <Sun className="w-4 h-4 text-orange-500" /> : <Moon className="w-4 h-4 text-purple-500" />}
              {report.shift.shiftType === "MORNING" ? "Morning" : "Evening"} Shift Details
              <span className="ml-auto text-xs font-normal text-gray-400">{dur(report.shift.openedAt, report.shift.closedAt)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-50"><td className="px-4 py-2 text-gray-500 w-1/2">Opened</td><td className="px-4 py-2 font-medium">{fmt(report.shift.openedAt)}</td></tr>
                <tr className="border-b border-gray-50"><td className="px-4 py-2 text-gray-500">Closed</td><td className="px-4 py-2 font-medium">{report.shift.closedAt ? fmt(report.shift.closedAt) : "—"}</td></tr>
                <tr className="border-b border-gray-50"><td className="px-4 py-2 text-gray-500">Opening Cash</td><td className="px-4 py-2 font-medium">{sym}{report.shift.openingCash.toFixed(2)}</td></tr>
                <tr className="border-b border-gray-50"><td className="px-4 py-2 text-gray-500">Closing Cash</td><td className="px-4 py-2 font-medium">{report.shift.closingCash != null ? `${sym}${report.shift.closingCash.toFixed(2)}` : "—"}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Sales by Shift - Only for Daily Reports */}
      {mode === "daily" && report.byShift && report.byShift.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2"><Sun className="w-4 h-4" /> Sales by Shift</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Shift</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Cashier</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Orders</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Amount</th>
              </tr></thead>
              <tbody>
                {report.byShift.map((shift, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{shift.shiftType}</td>
                    <td className="px-4 py-2 text-gray-600">{shift.cashier}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{shift.count}</td>
                    <td className="px-4 py-2 text-right font-bold">{sym}{shift.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-blue-50 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-800">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-blue-600">{sym}{report.byShift.reduce((s, x) => s + x.total, 0).toFixed(2)}</td>
              </tr></tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-sm text-gray-600 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Sales by Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Method</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Orders</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">%</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Amount</th>
            </tr></thead>
            <tbody>
              {Object.keys(report.byMethod).length === 0
                ? <tr><td colSpan={4} className="px-4 py-3 text-gray-400 text-center">No data</td></tr>
                : Object.entries(report.byMethod).map(([method, data]) => {
                  const pct = report.totalSales > 0 ? (data.total / report.totalSales) * 100 : 0;
                  return (
                    <tr key={method} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{method}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{data.count}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right font-bold">{sym}{data.total.toFixed(2)}</td>
                    </tr>
                  );
                })
              }
            </tbody>
            <tfoot><tr className="bg-orange-50 border-t border-gray-200">
              <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-800">Total</td>
              <td className="px-4 py-2.5 text-right font-bold text-orange-600">{sym}{report.totalSales.toFixed(2)}</td>
            </tr></tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Waiter Sales */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-sm text-gray-600 flex items-center gap-2"><Users className="w-4 h-4" /> Sales by Waiter</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Waiter</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Orders</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Amount</th>
            </tr></thead>
            <tbody>
              {report.byWaiter.length === 0
                ? <tr><td colSpan={3} className="px-4 py-3 text-gray-400 text-center">No data</td></tr>
                : report.byWaiter.map((w, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{w.name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{w.count}</td>
                    <td className="px-4 py-2 text-right font-bold">{sym}{w.total.toFixed(2)}</td>
                  </tr>
                ))
              }
            </tbody>
            <tfoot><tr className="bg-orange-50 border-t border-gray-200">
              <td colSpan={2} className="px-4 py-2.5 font-bold text-gray-800">Total</td>
              <td className="px-4 py-2.5 text-right font-bold text-orange-600">{sym}{report.totalSales.toFixed(2)}</td>
            </tr></tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Category Sales */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-sm text-gray-600 flex items-center gap-2"><Tag className="w-4 h-4" /> Sales by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Category</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Qty Sold</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Amount</th>
            </tr></thead>
            <tbody>
              {report.byCategory.length === 0
                ? <tr><td colSpan={3} className="px-4 py-3 text-gray-400 text-center">No data</td></tr>
                : report.byCategory.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{c.qty}</td>
                    <td className="px-4 py-2 text-right font-bold">{sym}{c.total.toFixed(2)}</td>
                  </tr>
                ))
              }
            </tbody>
            <tfoot><tr className="bg-orange-50 border-t border-gray-200">
              <td colSpan={2} className="px-4 py-2.5 font-bold text-gray-800">Total</td>
              <td className="px-4 py-2.5 text-right font-bold text-orange-600">{sym}{report.totalSales.toFixed(2)}</td>
            </tr></tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Item Sales */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="text-sm text-gray-600 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Item Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Item</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Category</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Qty</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 font-semibold">Amount</th>
            </tr></thead>
            <tbody>
              {report.byItem.length === 0
                ? <tr><td colSpan={4} className="px-4 py-3 text-gray-400 text-center">No data</td></tr>
                : report.byItem.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{item.name}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{item.category}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.qty}</td>
                    <td className="px-4 py-2 text-right font-bold">{sym}{item.total.toFixed(2)}</td>
                  </tr>
                ))
              }
            </tbody>
            <tfoot><tr className="bg-orange-50 border-t border-gray-200">
              <td colSpan={2} className="px-4 py-2.5 font-bold text-gray-800">Total</td>
              <td className="px-4 py-2.5 text-right font-bold text-gray-800">{report.byItem.reduce((s, i) => s + i.qty, 0)}</td>
              <td className="px-4 py-2.5 text-right font-bold text-orange-600">{sym}{report.totalSales.toFixed(2)}</td>
            </tr></tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Cancelled/Void Orders - Only show if there are cancelled orders */}
      {(report.cancelledCount ?? 0) > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
              <span className="text-red-500">✕</span> Cancelled/Void Orders ({report.cancelledCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="bg-red-50 border-b border-red-100">
                <th className="text-left px-4 py-2 text-xs text-red-600 font-semibold">Order #</th>
                <th className="text-left px-4 py-2 text-xs text-red-600 font-semibold">Table</th>
                <th className="text-left px-4 py-2 text-xs text-red-600 font-semibold">Waiter</th>
                <th className="text-right px-4 py-2 text-xs text-red-600 font-semibold">Items</th>
                <th className="text-right px-4 py-2 text-xs text-red-600 font-semibold">Cancelled At</th>
                <th className="text-right px-4 py-2 text-xs text-red-600 font-semibold">Amount</th>
              </tr></thead>
              <tbody>
                {report.cancelledOrders?.map((order, i) => (
                  <tr key={i} className="border-b border-red-50 hover:bg-red-50/50">
                    <td className="px-4 py-2 font-medium text-gray-800">#{order.id.slice(-6)}</td>
                    <td className="px-4 py-2 text-gray-600">{order.table.name}</td>
                    <td className="px-4 py-2 text-gray-600">{order.waiter.name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{order.orderItems.length}</td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs">{fmtTime(order.updatedAt)}</td>
                    <td className="px-4 py-2 text-right font-bold text-red-600">{sym}{order.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-red-100 border-t border-red-200">
                <td colSpan={5} className="px-4 py-2.5 font-bold text-red-800">Total Cancelled</td>
                <td className="px-4 py-2.5 text-right font-bold text-red-600">{sym}{(report.cancelledTotal ?? 0).toFixed(2)}</td>
              </tr></tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* shared CSS for A4 PDF */
const A4_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 30px 40px; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f97316; padding-bottom: 16px; }
  .header h1 { font-size: 22px; color: #f97316; }
  .header p { color: #666; font-size: 13px; }
  .meta-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
  .meta-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .meta-box .label { font-size: 10px; color: #999; }
  .meta-box .value { font-size: 14px; font-weight: bold; color: #1a1a1a; }
  .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 24px; }
  .summary-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-box .big { font-size: 20px; font-weight: bold; color: #ea580c; }
  .summary-box .lbl { font-size: 10px; color: #9a3412; margin-top: 2px; }
  section { margin-bottom: 20px; }
  section h2 { font-size: 13px; font-weight: bold; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f9fafb; text-align: left; font-size: 10px; color: #6b7280; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
  .num { text-align: right; }
  tfoot td { font-weight: bold; font-size: 12px; border-top: 2px solid #374151; background: #f9fafb; }
  .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  @media print { @page { size: A4; margin: 18mm 15mm; } }
`;

function buildReportSections(report: { totalSales: number; orderCount: number; byMethod: Record<string, { count: number; total: number }>; byWaiter: { name: string; count: number; total: number }[]; byCategory: { name: string; qty: number; total: number }[]; byItem: { name: string; category: string; qty: number; total: number }[] }, sym: string): string {
  const payRows = Object.entries(report.byMethod).map(([m, d]) => `<tr><td>${m}</td><td class="num">${d.count}</td><td class="num">${sym}${d.total.toFixed(2)}</td></tr>`).join("");
  const waiterRows = report.byWaiter.map((w) => `<tr><td>${w.name}</td><td class="num">${w.count}</td><td class="num">${sym}${w.total.toFixed(2)}</td></tr>`).join("");
  const catRows = report.byCategory.map((c) => `<tr><td>${c.name}</td><td class="num">${c.qty}</td><td class="num">${sym}${c.total.toFixed(2)}</td></tr>`).join("");
  const itemRows = report.byItem.map((i) => `<tr><td>${i.name}</td><td>${i.category}</td><td class="num">${i.qty}</td><td class="num">${sym}${i.total.toFixed(2)}</td></tr>`).join("");
  const avg = report.orderCount > 0 ? `${sym}${(report.totalSales / report.orderCount).toFixed(2)}` : `${sym}0`;
  return `
  <div class="summary-grid">
    <div class="summary-box"><div class="big">${sym}${report.totalSales.toFixed(2)}</div><div class="lbl">Total Sales</div></div>
    <div class="summary-box"><div class="big">${report.orderCount}</div><div class="lbl">Orders</div></div>
    <div class="summary-box"><div class="big">${avg}</div><div class="lbl">Avg Order</div></div>
  </div>
  <section><h2>Sales by Payment Method</h2>
    <table><thead><tr><th>Method</th><th class="num">Orders</th><th class="num">Amount</th></tr></thead>
    <tbody>${payRows || '<tr><td colspan="3" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${sym}${report.totalSales.toFixed(2)}</td></tr></tfoot></table></section>
  <section><h2>Sales by Waiter</h2>
    <table><thead><tr><th>Waiter</th><th class="num">Orders</th><th class="num">Amount</th></tr></thead>
    <tbody>${waiterRows || '<tr><td colspan="3" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${sym}${report.totalSales.toFixed(2)}</td></tr></tfoot></table></section>
  <section><h2>Sales by Category</h2>
    <table><thead><tr><th>Category</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="3" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${sym}${report.totalSales.toFixed(2)}</td></tr></tfoot></table></section>
  <section><h2>Item Sales</h2>
    <table><thead><tr><th>Item</th><th>Category</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;color:#999">No data</td></tr>'}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${report.byItem.reduce((s, i) => s + i.qty, 0)}</td><td class="num">${sym}${report.totalSales.toFixed(2)}</td></tr></tfoot></table></section>`;
}

function buildThermalHtml(report: NonNullable<ShiftReport>, sym: string, restaurantName: string, footer: string): string {
  const shift = report.shift;
  const shiftLabel = shift.shiftType === "MORNING" ? "Morning Shift" : "Evening Shift";
  const payRows = Object.entries(report.byMethod).map(([m, d]) => `<tr><td>${m}</td><td>${d.count}</td><td align="right">${sym}${d.total.toFixed(2)}</td></tr>`).join("");
  const waiterRows = report.byWaiter.map((w) => `<tr><td>${w.name}</td><td>${w.count}</td><td align="right">${sym}${w.total.toFixed(2)}</td></tr>`).join("");
  const catRows = report.byCategory.map((c) => `<tr><td>${c.name}</td><td>${c.qty}</td><td align="right">${sym}${c.total.toFixed(2)}</td></tr>`).join("");
  const itemRows = report.byItem.map((i) => `<tr><td>${i.name}</td><td>${i.qty}</td><td align="right">${sym}${i.total.toFixed(2)}</td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; padding: 6px; }
  h1 { font-size: 14px; text-align: center; } h2 { font-size: 11px; margin: 8px 0 4px; border-bottom: 1px dashed #000; }
  .center { text-align: center; } .line { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; } td { padding: 1px 2px; vertical-align: top; }
  td:last-child { text-align: right; white-space: nowrap; } .total-row td { border-top: 1px solid #000; font-weight: bold; }
  @media print { @page { size: 80mm auto; margin: 0; } body { padding: 4px; } }
  </style></head><body>
  <h1>${restaurantName}</h1><p class="center">${shiftLabel}</p>
  <p class="center">${new Date(shift.openedAt).toLocaleDateString()} ${new Date(shift.openedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })} — ${shift.closedAt ? new Date(shift.closedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : ""}</p>
  <div class="line"></div>
  <table>
    <tr><td>Opening Cash</td><td>${sym}${shift.openingCash.toFixed(2)}</td></tr>
    ${shift.closingCash != null ? `<tr><td>Closing Cash</td><td>${sym}${shift.closingCash.toFixed(2)}</td></tr>` : ""}
    <tr><td>Total Orders</td><td>${report.orderCount}</td></tr>
    <tr class="total-row"><td>TOTAL SALES</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr>
  </table>
  <h2>PAYMENT METHODS</h2><table>${payRows}<tr class="total-row"><td colspan="2">TOTAL</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <h2>WAITER SALES</h2><table>${waiterRows}<tr class="total-row"><td colspan="2">TOTAL</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <h2>BY CATEGORY</h2><table>${catRows}<tr class="total-row"><td colspan="2">TOTAL</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <h2>ITEM SALES</h2><table>${itemRows}<tr class="total-row"><td colspan="2">TOTAL</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <div class="line"></div><p class="center">${footer || "Thank you!"}</p><p class="center">${new Date().toLocaleString()}</p>
</body></html>`;
}

function buildA4Html(report: NonNullable<ShiftReport>, sym: string, restaurantName: string, footer: string): string {
  const shift = report.shift;
  const shiftLabel = shift.shiftType === "MORNING" ? "Morning Shift" : "Evening Shift";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${A4_CSS}</style></head><body>
  <div class="header"><h1>${restaurantName}</h1>
    <p>${shiftLabel} Report &nbsp;|&nbsp; ${new Date(shift.openedAt).toLocaleDateString("en-GB", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
  </div>
  <div class="meta-grid">
    <div class="meta-box"><div class="label">Shift</div><div class="value">${shiftLabel}</div></div>
    <div class="meta-box"><div class="label">Opened</div><div class="value">${new Date(shift.openedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</div></div>
    <div class="meta-box"><div class="label">Closed</div><div class="value">${shift.closedAt ? new Date(shift.closedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "—"}</div></div>
    <div class="meta-box"><div class="label">Opening Cash</div><div class="value">${sym}${shift.openingCash.toFixed(2)}</div></div>
  </div>
  ${buildReportSections(report, sym)}
  <div class="footer"><p>${footer || "Thank you!"}</p><p>Printed: ${new Date().toLocaleString()}</p></div>
</body></html>`;
}

function buildDailyThermalHtml(report: NonNullable<DailyReport>, sym: string, restaurantName: string, footer: string): string {
  const payRows = Object.entries(report.byMethod).map(([m, d]) => `<tr><td>${m}</td><td>${d.count}</td><td align="right">${sym}${d.total.toFixed(2)}</td></tr>`).join("");
  const waiterRows = report.byWaiter.map((w) => `<tr><td>${w.name}</td><td>${w.count}</td><td align="right">${sym}${w.total.toFixed(2)}</td></tr>`).join("");
  const itemRows = report.byItem.map((i) => `<tr><td>${i.name}</td><td>${i.qty}</td><td align="right">${sym}${i.total.toFixed(2)}</td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; font-size:11px; width:72mm; padding:6px; }
  h1 { font-size:14px; text-align:center; } h2 { font-size:11px; margin:8px 0 4px; border-bottom:1px dashed #000; }
  .center { text-align:center; } .line { border-top:1px dashed #000; margin:6px 0; }
  table { width:100%; border-collapse:collapse; } td { padding:1px 2px; vertical-align:top; }
  td:last-child { text-align:right; white-space:nowrap; } .total-row td { border-top:1px solid #000; font-weight:bold; }
  @media print { @page { size:80mm auto; margin:0; } }
  </style></head><body>
  <h1>${restaurantName}</h1><p class="center">Daily Sales Report</p>
  <p class="center">${report.date}</p><div class="line"></div>
  <table><tr><td>Total Orders</td><td>${report.orderCount}</td></tr>
  <tr class="total-row"><td>TOTAL SALES</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <h2>PAYMENT METHODS</h2><table>${payRows}<tr class="total-row"><td colspan="2">TOTAL</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <h2>WAITER SALES</h2><table>${waiterRows}<tr class="total-row"><td colspan="2">TOTAL</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <h2>ITEM SALES</h2><table>${itemRows}<tr class="total-row"><td colspan="2">TOTAL</td><td>${sym}${report.totalSales.toFixed(2)}</td></tr></table>
  <div class="line"></div><p class="center">${footer || "Thank you!"}</p><p class="center">${new Date().toLocaleString()}</p>
</body></html>`;
}

function buildDailyA4Html(report: NonNullable<DailyReport>, sym: string, restaurantName: string, footer: string): string {
  const shiftsTable = report.shifts.length > 0 ? `
  <section><h2>Shifts</h2>
    <table><thead><tr><th>Shift</th><th>Cashier</th><th class="num">Opened</th><th class="num">Closed</th></tr></thead>
    <tbody>${report.shifts.map((s) => `<tr>
      <td>${s.shiftType === "MORNING" ? "☀ Morning" : "🌙 Evening"}</td>
      <td>${(s as { user?: { name?: string } }).user?.name ?? "—"}</td>
      <td class="num">${new Date(s.openedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</td>
      <td class="num">${s.closedAt ? new Date(s.closedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "Open"}</td>
    </tr>`).join("")}</tbody></table></section>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${A4_CSS}</style></head><body>
  <div class="header"><h1>${restaurantName}</h1>
    <p>Daily Sales Report &nbsp;|&nbsp; ${new Date(report.date + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
  </div>
  ${shiftsTable}
  ${buildReportSections(report, sym)}
  <div class="footer"><p>${footer || "Thank you!"}</p><p>Printed: ${new Date().toLocaleString()}</p></div>
</body></html>`;
}

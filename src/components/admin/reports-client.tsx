"use client";

import { useState, useEffect } from "react";
import { getDailyReport, getShiftReport, getMyShifts } from "@/actions/shifts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, ShoppingBag, Banknote, BarChart3,
  Users, RefreshCw, Calendar, Clock, XCircle, ChevronDown,
} from "lucide-react";

interface ReportsClientProps {
  currencySymbol: string;
}

type DailyReport = Awaited<ReturnType<typeof getDailyReport>>;
type ShiftReport = Awaited<ReturnType<typeof getShiftReport>>;
type ShiftList = Awaited<ReturnType<typeof getMyShifts>>;

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() { return toDateStr(new Date()); }

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  return { from: toDateStr(mon), to: toDateStr(now) };
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateStr(from), to: toDateStr(now) };
}

type QuickFilter = "today" | "yesterday" | "week" | "month" | "custom";

function fmtTime(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
      {method}
    </span>
  );
}

function SummaryCards({ sym, totalSales, orderCount, staffCount }: {
  sym: string; totalSales: number; orderCount: number; staffCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{sym}{totalSales.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">Orders</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{orderCount}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500">Staff Active</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{staffCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ByMethodCard({ sym, byMethod, totalSales }: {
  sym: string;
  byMethod: Record<string, { count: number; total: number }>;
  totalSales: number;
}) {
  const entries = Object.entries(byMethod);
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600">By Payment Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
        {entries.map(([method, data]) => {
          const pct = totalSales > 0 ? (data.total / totalSales) * 100 : 0;
          return (
            <div key={method} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                <Banknote className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="font-medium">{method}</span>
                  <span className="font-bold">{sym}{data.total.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{data.count} payments · {pct.toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ByStaffCard({ sym, byWaiter }: { sym: string; byWaiter: { name: string; count: number; total: number }[] }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600">By Staff</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {byWaiter.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
        {byWaiter.map((w) => (
          <div key={w.name} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs">
              {w.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{w.name}</span>
                <span className="font-bold">{sym}{w.total.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400">{w.count} orders</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TopItemsCard({ sym, items }: { sym: string; items: { name: string; qty: number; total: number }[] }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600">Top Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
        {items.slice(0, 10).map((item, i) => (
          <div key={item.name} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
            <span className="w-5 text-xs font-bold text-gray-400">{i + 1}.</span>
            <span className="flex-1 text-sm text-gray-700">{item.name}</span>
            <Badge variant="outline" className="text-xs">{item.qty}x</Badge>
            <span className="text-sm font-bold text-gray-900">{sym}{item.total.toFixed(2)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OrdersTable({ sym, orders }: { sym: string; orders: DailyReport["orders"] }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-600">Orders ({orders.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Order</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Table</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Staff</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Payment</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Total</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 100).map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">#{order.id.slice(-6)}</td>
                  <td className="px-4 py-2.5 font-medium">{order.table.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{order.waiter.name}</td>
                  <td className="px-4 py-2.5">
                    {order.paymentMethod && <MethodBadge method={order.paymentMethod} />}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold">{sym}{order.total.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-400">{fmtTime(order.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">No completed orders</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Daily Report View ──────────────────────────────────────────────────────────
function DailyView({ sym, report }: { sym: string; report: DailyReport }) {
  return (
    <div className="space-y-4">
      <SummaryCards
        sym={sym}
        totalSales={report.totalSales}
        orderCount={report.orderCount}
        staffCount={report.byWaiter.length}
      />

      {/* Shift breakdown */}
      {report.byShift && report.byShift.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">By Shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.byShift.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${s.shiftType === "MORNING" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {s.shiftType}
                  </span>
                  <span className="text-sm text-gray-600">{s.cashier}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{sym}{s.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{s.count} payments</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <ByMethodCard sym={sym} byMethod={report.byMethod} totalSales={report.totalSales} />
        <ByStaffCard sym={sym} byWaiter={report.byWaiter} />
        <TopItemsCard sym={sym} items={report.byItem} />
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">By Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {report.byCategory.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
            {report.byCategory.map((c) => (
              <div key={c.name} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{c.name}</span>
                <div className="text-right">
                  <p className="text-sm font-bold">{sym}{c.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{c.qty} items</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Cancelled orders */}
      {report.cancelledOrders && report.cancelledOrders.length > 0 && (
        <Card className="border-0 shadow-sm border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Cancelled Orders ({report.cancelledCount}) · {sym}{report.cancelledTotal?.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Table</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Staff</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cancelledOrders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-red-50">
                      <td className="px-4 py-2 font-medium">{o.table.name}</td>
                      <td className="px-4 py-2 text-gray-500">{o.waiter.name}</td>
                      <td className="px-4 py-2 text-right font-bold text-red-600">{sym}{o.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <OrdersTable sym={sym} orders={report.orders} />
    </div>
  );
}

// ── Shift Report View ──────────────────────────────────────────────────────────
function ShiftView({ sym, report }: { sym: string; report: ShiftReport }) {
  if (!report) return null;
  const { shift } = report;
  return (
    <div className="space-y-4">
      {/* Shift header */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-orange-50 to-amber-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${shift.shiftType === "MORNING" ? "bg-amber-200 text-amber-800" : "bg-blue-200 text-blue-800"}`}>
                  {shift.shiftType}
                </span>
                <span className="font-semibold text-gray-800">{shift.user.name}</span>
                {!shift.closedAt && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">OPEN</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {fmtDate(shift.openedAt)} · {fmtTime(shift.openedAt)} — {shift.closedAt ? fmtTime(shift.closedAt) : "ongoing"}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-gray-500">Opening Cash</p>
                <p className="font-bold">{sym}{shift.openingCash.toFixed(2)}</p>
              </div>
              {shift.closingCash != null && (
                <div>
                  <p className="text-xs text-gray-500">Closing Cash</p>
                  <p className="font-bold">{sym}{shift.closingCash.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SummaryCards
        sym={sym}
        totalSales={report.totalSales}
        orderCount={report.orderCount}
        staffCount={report.byWaiter.length}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <ByMethodCard sym={sym} byMethod={report.byMethod} totalSales={report.totalSales} />
        <ByStaffCard sym={sym} byWaiter={report.byWaiter} />
        <TopItemsCard sym={sym} items={report.byItem} />
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">By Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {report.byCategory.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
            {report.byCategory.map((c) => (
              <div key={c.name} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{c.name}</span>
                <div className="text-right">
                  <p className="text-sm font-bold">{sym}{c.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{c.qty} items</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {report.cancelledOrders && report.cancelledOrders.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Cancelled Orders ({report.cancelledCount}) · {sym}{report.cancelledTotal?.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Table</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Staff</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Value</th>
              </tr></thead>
              <tbody>
                {report.cancelledOrders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-red-50">
                    <td className="px-4 py-2 font-medium">{o.table.name}</td>
                    <td className="px-4 py-2 text-gray-500">{o.waiter.name}</td>
                    <td className="px-4 py-2 text-right font-bold text-red-600">{sym}{o.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <OrdersTable sym={sym} orders={report.orders} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ReportsClient({ currencySymbol }: ReportsClientProps) {
  const sym = currencySymbol || "$";
  const [tab, setTab] = useState<"daily" | "shift">("daily");
  const [loading, setLoading] = useState(false);

  // Daily state
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("today");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [reportLabel, setReportLabel] = useState("");

  // Shift state
  const [shifts, setShifts] = useState<ShiftList | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [shiftReport, setShiftReport] = useState<ShiftReport | null>(null);

  const utcOffset = -new Date().getTimezoneOffset(); // e.g. +180 for UTC+3

  const loadDailyForDate = async (from: string, label: string, to?: string) => {
    setLoading(true);
    setReportLabel(label);
    try {
      const data = await getDailyReport(from, utcOffset, to);
      setDailyReport(data);
    } finally {
      setLoading(false);
    }
  };

  const loadShifts = async () => {
    setLoading(true);
    try {
      const data = await getMyShifts();
      setShifts(data);
      if (data.length > 0 && !selectedShiftId) {
        setSelectedShiftId(data[0].id);
        const report = await getShiftReport(data[0].id);
        setShiftReport(report);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadShiftReport = async (shiftId: string) => {
    if (!shiftId) return;
    setLoading(true);
    setSelectedShiftId(shiftId);
    try {
      const data = await getShiftReport(shiftId);
      setShiftReport(data);
    } finally {
      setLoading(false);
    }
  };

  const applyQuickFilter = (filter: QuickFilter) => {
    setQuickFilter(filter);
    if (filter === "today") loadDailyForDate(todayStr(), "Today");
    if (filter === "yesterday") loadDailyForDate(yesterdayStr(), "Yesterday");
    if (filter === "week") {
      const { from, to } = weekRange();
      loadDailyForDate(from, "This Week", to);
    }
    if (filter === "month") {
      const { from, to } = monthRange();
      loadDailyForDate(from, "This Month", to);
    }
  };

  // Auto-load today on mount
  useEffect(() => { loadDailyForDate(todayStr(), "Today"); }, []);

  const handleTabChange = (t: "daily" | "shift") => {
    setTab(t);
    if (t === "shift" && !shifts) loadShifts();
  };

  const QUICK_TABS: { key: QuickFilter; label: string }[] = [
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week",      label: "This Week" },
    { key: "month",     label: "This Month" },
    { key: "custom",    label: "Custom" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Daily sales and shift-by-shift breakdown</p>
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => handleTabChange("daily")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "daily" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Daily Report
        </button>
        <button
          onClick={() => handleTabChange("shift")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "shift" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Shift Reports
        </button>
      </div>

      {/* ── DAILY TAB ── */}
      {tab === "daily" && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4 space-y-3">
              {/* Quick filter pills */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => applyQuickFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                      quickFilter === key
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Custom date range — shown only when Custom is selected */}
              {quickFilter === "custom" && (
                <div className="flex gap-2 items-end flex-wrap pt-1">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">From</label>
                    <input
                      type="date"
                      value={customFrom}
                      max={todayStr()}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">To</label>
                    <input
                      type="date"
                      value={customTo}
                      max={todayStr()}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600"
                    onClick={() => loadDailyForDate(customFrom, `${customFrom} → ${customTo}`, customTo)}
                    disabled={loading || !customFrom || !customTo}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                    Load
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {loading && (
            <div className="text-center py-16 text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
              <p>Loading...</p>
            </div>
          )}

          {!loading && dailyReport && (
            <>
              <p className="text-xs text-gray-400 font-medium">
                Showing: <span className="text-gray-700 font-semibold">{reportLabel}</span>
              </p>
              <DailyView sym={sym} report={dailyReport} />
            </>
          )}
        </div>
      )}

      {/* ── SHIFT TAB ── */}
      {tab === "shift" && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-[220px] space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Shift</label>
                  {loading && !shifts ? (
                    <p className="text-sm text-gray-400">Loading shifts...</p>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedShiftId ?? ""}
                        onChange={(e) => loadShiftReport(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-orange-400 bg-white pr-8"
                      >
                        <option value="" disabled>— choose a shift —</option>
                        {(shifts ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.shiftType === "MORNING" ? "☀️ Morning" : "🌙 Evening"}
                            {" — "}{fmtDate(s.openedAt)}
                            {" "}{fmtTime(s.openedAt)}
                            {s.closedAt ? ` → ${fmtTime(s.closedAt)}` : " (open)"}
                            {" · "}{s.user.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadShifts}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading && selectedShiftId && (
            <div className="text-center py-16 text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
              <p>Loading shift report...</p>
            </div>
          )}

          {!loading && !shiftReport && (
            <div className="text-center py-16 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a shift from the dropdown above</p>
            </div>
          )}

          {!loading && shiftReport && <ShiftView sym={sym} report={shiftReport} />}
        </div>
      )}
    </div>
  );
}

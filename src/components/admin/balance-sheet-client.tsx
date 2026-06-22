"use client";

import { useState, useEffect } from "react";
import { getBalanceSheet } from "@/actions/balance-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet, TrendingUp, AlertCircle, RefreshCw,
  DollarSign, ShoppingCart, Receipt, Truck,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface BalanceSheetClientProps {
  currencySymbol: string;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() { return toDateStr(new Date()); }
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function BalanceSheetClient({ currencySymbol }: BalanceSheetClientProps) {
  const sym = currencySymbol || "$";
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getBalanceSheet(from, to);
    if ("error" in res && res.error) {
      toast({ title: "Error", description: String(res.error), variant: "destructive" });
    } else {
      setData(res);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [from, to]);

  const kpis = data?.kpis;
  const detail = data?.detail;

  return (
    <div className="space-y-5">
      {/* Date Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={from} max={todayStr()}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 block" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={to} max={todayStr()}
                onChange={(e) => setTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 block" />
            </div>
            <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Cash on Hand */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Wallet className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Estimated Cash-on-Hand</span>
            </div>
            {loading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse w-3/4" />
            ) : (
              <p className={`text-3xl font-bold ${(kpis?.cashOnHand ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                {sym}{(kpis?.cashOnHand ?? 0).toFixed(2)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Cash sales − cash expenses − cash supplier payments</p>
          </CardContent>
        </Card>

        {/* Accounts Payable */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-white">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Accounts Payable</span>
            </div>
            {loading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse w-3/4" />
            ) : (
              <p className="text-3xl font-bold text-red-600">
                {sym}{(kpis?.accountsPayable ?? 0).toFixed(2)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Total unpaid/partial supplier invoice balances</p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Net Profit</span>
            </div>
            {loading ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse w-3/4" />
            ) : (
              <p className={`text-3xl font-bold ${(kpis?.netProfit ?? 0) >= 0 ? "text-blue-700" : "text-red-600"}`}>
                {sym}{(kpis?.netProfit ?? 0).toFixed(2)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Total sales − all expenses − supplier payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Breakdown */}
      {detail && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" /> Revenue Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Total Sales</span>
                <span className="font-bold text-green-600">{sym}{detail.totalSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-1">↳ Cash Sales</span>
                <span className="font-medium text-green-500">{sym}{detail.cashSales.toFixed(2)}</span>
              </div>
              {detail.salesByMethod?.map((m: any) => (
                <div key={m.paymentMethod} className="flex justify-between text-xs py-1 pl-4 text-gray-500">
                  <span>{m.paymentMethod || "Unknown"} ({m._count} orders)</span>
                  <span>{sym}{(m._sum.total ?? 0).toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-red-500" /> Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Total Expenses</span>
                <span className="font-bold text-red-600">{sym}{detail.totalExpenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-1">↳ Cash Expenses</span>
                <span className="font-medium text-red-500">{sym}{detail.cashExpenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Supplier Payments</span>
                <span className="font-bold text-orange-600">{sym}{detail.totalInvoicePayments.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-gray-500 flex items-center gap-1">↳ Cash to Suppliers</span>
                <span className="font-medium text-orange-500">{sym}{detail.cashInvoicePayments.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Expenses by Category */}
          {detail.expensesByCategory?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-500" /> Expenses by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-2">
                  {detail.expensesByCategory.map((c: any) => (
                    <div key={c.category} className="flex justify-between items-center text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-600">{c.category}</span>
                      <span className="font-medium text-red-600">{sym}{(c._sum.amount ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Suppliers Owed */}
          {detail.topOwed?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" /> Top Suppliers Owed
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-2">
                  {detail.topOwed.map((s: any) => (
                    <div key={s.supplierId} className="flex justify-between items-center text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-600">{s.name}</span>
                      <span className="font-bold text-red-600">{sym}{s.balanceOwed.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Net Summary Row */}
      {kpis && !loading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total Revenue</p>
                <p className="font-bold text-green-600">{sym}{(detail?.totalSales ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total Expenses</p>
                <p className="font-bold text-red-600">{sym}{(detail?.totalExpenses ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Supplier Payments</p>
                <p className="font-bold text-orange-600">{sym}{(detail?.totalInvoicePayments ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Net Profit</p>
                <p className={`font-bold text-lg ${kpis.netProfit >= 0 ? "text-blue-700" : "text-red-600"}`}>
                  {sym}{kpis.netProfit.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} from "@/actions/expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpenseCategory } from "@prisma/client";
import {
  Plus, Wallet, Trash2, Pencil, DollarSign, Tag,
  RefreshCw, Search, X,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface ExpensesClientProps {
  currencySymbol: string;
  canManage: boolean;
}

const CATEGORIES: { key: ExpenseCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Categories" },
  { key: "FOOD", label: "Food" },
  { key: "DRINKS", label: "Drinks" },
  { key: "SUPPLIES", label: "Supplies" },
  { key: "SALARIES", label: "Salaries" },
  { key: "RENT", label: "Rent" },
  { key: "UTILITIES", label: "Utilities" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "MARKETING", label: "Marketing" },
  { key: "TRANSPORT", label: "Transport" },
  { key: "OTHER", label: "Other" },
];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() { return toDateStr(new Date()); }

export function ExpensesClient({ currencySymbol, canManage }: ExpensesClientProps) {
  const sym = currencySymbol || "$";
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, count: 0, byCategory: [] as any[] });
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [category, setCategory] = useState<ExpenseCategory | "ALL">("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const [form, setForm] = useState({
    amount: "",
    category: "OTHER" as ExpenseCategory,
    description: "",
    date: todayStr(),
  });

  const loadData = async () => {
    setLoading(true);
    const [expRes, sumRes] = await Promise.all([
      getExpenses(from, to, category),
      getExpenseSummary(from, to),
    ]);
    if (expRes.error) {
      toast({ title: "Error", description: String(expRes.error), variant: "destructive" });
    } else {
      setExpenses(expRes.expenses || []);
    }
    setSummary(sumRes);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [from, to, category]);

  const resetForm = () => {
    setForm({ amount: "", category: "OTHER", description: "", date: todayStr() });
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (expense: any) => {
    setEditing(expense);
    setForm({
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description || "",
      date: toDateStr(new Date(expense.date)),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      amount: parseFloat(form.amount),
      category: form.category,
      description: form.description,
      date: form.date,
    };

    const result = editing
      ? await updateExpense(editing.id, data)
      : await createExpense(data);

    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: editing ? "Expense updated" : "Expense recorded", variant: "success" });
      setShowModal(false);
      resetForm();
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const result = await deleteExpense(id);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Expense deleted", variant: "success" });
      loadData();
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sym}{summary.total.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Entries</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.count}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">Average</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {sym}{summary.count ? (summary.total / summary.count).toFixed(2) : "0.00"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                value={from}
                max={todayStr()}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 block"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                value={to}
                max={todayStr()}
                onChange={(e) => setTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 block"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory | "ALL")}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 bg-white block"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {canManage && (
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5" onClick={openAdd}>
                  <Plus className="w-4 h-4" />
                  Add Expense
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {summary.byCategory.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {summary.byCategory.map((item) => (
                <div key={item.category} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{item.category}</p>
                  <p className="font-bold text-gray-900">{sym}{item._sum.amount?.toFixed(2) ?? "0.00"}</p>
                  <p className="text-xs text-gray-400">{item._count} entries</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">Expenses ({expenses.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Category</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Description</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Amount</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Recorded By</th>
                  {canManage && <th className="text-center px-4 py-2.5 text-xs text-gray-500 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500">
                      {new Date(expense.date).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{expense.description || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-red-600">{sym}{expense.amount.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{expense.createdBy?.name}</td>
                    {canManage && (
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(expense)}
                            className="text-gray-400 hover:text-orange-500 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No expenses found for this period</p>
              </div>
            )}
            {loading && (
              <div className="text-center py-12 text-gray-400">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                <p>Loading...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {editing ? "Edit Expense" : "Record Expense"}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{sym}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white"
                >
                  {CATEGORIES.filter((c) => c.key !== "ALL").map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  max={todayStr()}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="What was this expense for?"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowModal(false); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">
                  {editing ? "Update" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

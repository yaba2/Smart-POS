"use client";

import { useState, useEffect } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  recordSupplierPayment,
  deleteSupplierPayment,
} from "@/actions/suppliers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SupplierStatus } from "@prisma/client";
import {
  Plus, Truck, Phone, Mail, MapPin, Trash2, Pencil, DollarSign,
  RefreshCw, Search, X, CheckCircle2, XCircle, FileText, History,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface SuppliersClientProps {
  currencySymbol: string;
  canManage: boolean;
}

const PAYMENT_METHODS = ["CASH", "BANK", "MOBILE_MONEY", "CHEQUE"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() { return toDateStr(new Date()); }

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

export function SuppliersClient({ currencySymbol, canManage }: SuppliersClientProps) {
  const sym = currencySymbol || "$";
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    totalOwed: "",
    status: "ACTIVE" as SupplierStatus,
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    date: todayStr(),
    method: "CASH",
    notes: "",
  });

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySupplier, setHistorySupplier] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getSuppliers();
    if (res.error) {
      toast({ title: "Error", description: String(res.error), variant: "destructive" });
    } else {
      setSuppliers(res.suppliers || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const resetSupplierForm = () => {
    setSupplierForm({ name: "", phone: "", email: "", address: "", notes: "", totalOwed: "", status: "ACTIVE" });
    setEditingSupplier(null);
  };

  const openAddSupplier = () => {
    resetSupplierForm();
    setShowSupplierModal(true);
  };

  const openEditSupplier = (supplier: any) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      totalOwed: supplier.totalOwed.toString(),
      status: supplier.status,
    });
    setShowSupplierModal(true);
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: supplierForm.name,
      phone: supplierForm.phone,
      email: supplierForm.email,
      address: supplierForm.address,
      notes: supplierForm.notes,
      totalOwed: parseFloat(supplierForm.totalOwed) || 0,
      status: supplierForm.status,
    };

    const result = editingSupplier
      ? await updateSupplier(editingSupplier.id, data)
      : await createSupplier(data);

    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: editingSupplier ? "Supplier updated" : "Supplier created", variant: "success" });
      setShowSupplierModal(false);
      resetSupplierForm();
      loadData();
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Delete this supplier and all payment history?")) return;
    const result = await deleteSupplier(id);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Supplier deleted", variant: "success" });
      loadData();
    }
  };

  const openPayment = (supplier: any) => {
    setPaymentSupplier(supplier);
    setPaymentForm({ amount: "", date: todayStr(), method: "CASH", notes: "" });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplier) return;
    const result = await recordSupplierPayment({
      supplierId: paymentSupplier.id,
      amount: parseFloat(paymentForm.amount),
      date: paymentForm.date,
      method: paymentForm.method,
      notes: paymentForm.notes,
    });

    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Payment recorded", variant: "success" });
      setShowPaymentModal(false);
      setPaymentSupplier(null);
      loadData();
    }
  };

  const handleDeletePayment = async (paymentId: string, supplierId: string) => {
    if (!confirm("Delete this payment?")) return;
    const result = await deleteSupplierPayment(paymentId, supplierId);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Payment deleted", variant: "success" });
      if (historySupplier) {
        const updated = await getSuppliers();
        if (!updated.error) {
          const s = updated.suppliers?.find((x: any) => x.id === historySupplier.id);
          if (s) setHistorySupplier(s);
          setSuppliers(updated.suppliers || []);
        }
      } else {
        loadData();
      }
    }
  };

  const openHistory = (supplier: any) => {
    setHistorySupplier(supplier);
    setShowHistoryModal(true);
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || "").includes(search) ||
    (s.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalOwed = suppliers.reduce((sum, s) => sum + s.totalOwed, 0);
  const totalPaid = suppliers.reduce((sum, s) => sum + s.totalPaid, 0);
  const balanceDue = totalOwed - totalPaid;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Total Owed</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sym}{totalOwed.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sym}{totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500">Balance Due</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sym}{balanceDue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-gray-500">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search suppliers..."
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {canManage && (
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5" onClick={openAddSupplier}>
                  <Plus className="w-4 h-4" />
                  Add Supplier
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">Suppliers ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Supplier</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Contact</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Owed</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Paid</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Balance</th>
                  <th className="text-center px-4 py-2.5 text-xs text-gray-500 font-medium">Status</th>
                  <th className="text-center px-4 py-2.5 text-xs text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((supplier) => {
                  const balance = supplier.totalOwed - supplier.totalPaid;
                  return (
                    <tr key={supplier.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                        {supplier.notes && <div className="text-xs text-gray-400 truncate max-w-[200px]">{supplier.notes}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {supplier.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {supplier.phone}</div>}
                        {supplier.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {supplier.email}</div>}
                        {!supplier.phone && !supplier.email && "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{sym}{supplier.totalOwed.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{sym}{supplier.totalPaid.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-600">{sym}{balance.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          supplier.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {supplier.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openHistory(supplier)}
                            className="text-gray-400 hover:text-blue-500 transition-colors"
                            title="Payment History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => openPayment(supplier)}
                                className="text-gray-400 hover:text-green-500 transition-colors"
                                title="Record Payment"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditSupplier(supplier)}
                                className="text-gray-400 hover:text-orange-500 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSupplier(supplier.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">
                <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No suppliers found</p>
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

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {editingSupplier ? "Edit Supplier" : "Add Supplier"}
              </h3>
              <button onClick={() => { setShowSupplierModal(false); resetSupplierForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSupplierSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Total Owed</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{sym}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={supplierForm.totalOwed}
                    onChange={(e) => setSupplierForm({ ...supplierForm, totalOwed: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <select
                  value={supplierForm.status}
                  onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value as SupplierStatus })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowSupplierModal(false); resetSupplierForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">
                  {editingSupplier ? "Update" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-500">Supplier</p>
              <p className="font-bold text-gray-900">{paymentSupplier.name}</p>
              <p className="text-xs text-gray-500">Balance: {sym}{(paymentSupplier.totalOwed - paymentSupplier.totalPaid).toFixed(2)}</p>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{sym}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  required
                  value={paymentForm.date}
                  max={todayStr()}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white"
                >
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                  Record Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historySupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
                <p className="text-sm text-gray-500">{historySupplier.name}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 flex justify-between text-sm">
              <span className="text-gray-500">Balance: <strong className="text-gray-900">{sym}{(historySupplier.totalOwed - historySupplier.totalPaid).toFixed(2)}</strong></span>
              <span className="text-gray-500">Paid: <strong className="text-green-600">{sym}{historySupplier.totalPaid.toFixed(2)}</strong></span>
            </div>
            <div className="overflow-y-auto flex-1">
              {historySupplier.payments?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Date</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Amount</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Method</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Notes</th>
                      {canManage && <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {historySupplier.payments.map((p: any) => (
                      <tr key={p.id} className="border-b border-gray-50">
                        <td className="px-3 py-2 text-gray-500 text-xs">{fmtDate(p.date)}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-600">{sym}{p.amount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs">{p.method}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{p.notes || "—"}</td>
                        {canManage && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeletePayment(p.id, historySupplier.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete payment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center py-8 text-gray-400 text-sm">No payments recorded</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

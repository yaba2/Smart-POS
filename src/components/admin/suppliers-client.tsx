"use client";

import { useState, useEffect } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createInvoice,
  deleteInvoice,
  recordInvoicePayment,
  deleteInvoicePayment,
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

const STATUS_COLORS: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

export function SuppliersClient({ currencySymbol, canManage }: SuppliersClientProps) {
  const sym = currencySymbol || "$";
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: "", phone: "", email: "", address: "", notes: "", status: "ACTIVE" as SupplierStatus,
  });

  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceSupplier, setInvoiceSupplier] = useState<any | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    totalAmount: "", description: "", invoiceDate: todayStr(),
  });

  // Invoice detail / payment modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "", method: "CASH", notes: "", paidAt: todayStr(),
  });

  // Invoices list modal
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [invoicesSupplier, setInvoicesSupplier] = useState<any | null>(null);

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

  // Supplier CRUD
  const resetSupplierForm = () => {
    setSupplierForm({ name: "", phone: "", email: "", address: "", notes: "", status: "ACTIVE" });
    setEditingSupplier(null);
  };
  const openAddSupplier = () => { resetSupplierForm(); setShowSupplierModal(true); };
  const openEditSupplier = (s: any) => {
    setEditingSupplier(s);
    setSupplierForm({ name: s.name, phone: s.phone || "", email: s.email || "", address: s.address || "", notes: s.notes || "", status: s.status });
    setShowSupplierModal(true);
  };
  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = editingSupplier
      ? await updateSupplier(editingSupplier.id, supplierForm)
      : await createSupplier(supplierForm);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: editingSupplier ? "Supplier updated" : "Supplier added", variant: "success" });
      setShowSupplierModal(false);
      resetSupplierForm();
      loadData();
    }
  };
  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Delete this supplier and all invoices?")) return;
    const result = await deleteSupplier(id);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else { toast({ title: "Supplier deleted", variant: "success" }); loadData(); }
  };

  // Invoice CRUD
  const openAddInvoice = (supplier: any) => {
    setInvoiceSupplier(supplier);
    setInvoiceForm({ totalAmount: "", description: "", invoiceDate: todayStr() });
    setShowInvoiceModal(true);
  };
  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceSupplier) return;
    const result = await createInvoice({
      supplierId: invoiceSupplier.id,
      totalAmount: parseFloat(invoiceForm.totalAmount),
      description: invoiceForm.description,
      invoiceDate: invoiceForm.invoiceDate,
    });
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else { toast({ title: "Invoice created", variant: "success" }); setShowInvoiceModal(false); loadData(); }
  };
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Delete this invoice and all its payments?")) return;
    const result = await deleteInvoice(invoiceId);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else {
      toast({ title: "Invoice deleted", variant: "success" });
      const updated = await getSuppliers();
      if (!updated.error) {
        setSuppliers(updated.suppliers || []);
        if (invoicesSupplier) {
          const s = updated.suppliers?.find((x: any) => x.id === invoicesSupplier.id);
          if (s) setInvoicesSupplier(s);
        }
      }
    }
  };

  // Invoice Payment
  const openPayment = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentForm({ amount: invoice.balanceOwed.toFixed(2), method: "CASH", notes: "", paidAt: todayStr() });
    setShowPaymentModal(true);
  };
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const result = await recordInvoicePayment({
      invoiceId: selectedInvoice.id,
      amount: parseFloat(paymentForm.amount),
      method: paymentForm.method,
      notes: paymentForm.notes,
      paidAt: paymentForm.paidAt,
    });
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else {
      toast({ title: "Payment recorded", variant: "success" });
      setShowPaymentModal(false);
      const updated = await getSuppliers();
      if (!updated.error) {
        setSuppliers(updated.suppliers || []);
        if (invoicesSupplier) {
          const s = updated.suppliers?.find((x: any) => x.id === invoicesSupplier.id);
          if (s) setInvoicesSupplier(s);
        }
      }
    }
  };
  const handleDeletePayment = async (paymentId: string, invoiceId: string) => {
    if (!confirm("Delete this payment?")) return;
    const result = await deleteInvoicePayment(paymentId, invoiceId);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else {
      toast({ title: "Payment deleted", variant: "success" });
      const updated = await getSuppliers();
      if (!updated.error) {
        setSuppliers(updated.suppliers || []);
        if (invoicesSupplier) {
          const s = updated.suppliers?.find((x: any) => x.id === invoicesSupplier.id);
          if (s) setInvoicesSupplier(s);
        }
      }
    }
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || "").includes(search) ||
    (s.email || "").toLowerCase().includes(search.toLowerCase())
  );

  // Aggregate totals from invoices
  const totalInvoiced = suppliers.reduce((sum, s) => sum + s.invoices.reduce((a: number, i: any) => a + i.totalAmount, 0), 0);
  const totalPaid = suppliers.reduce((sum, s) => sum + s.invoices.reduce((a: number, i: any) => a + i.amountPaid, 0), 0);
  const totalBalance = suppliers.reduce((sum, s) => sum + s.invoices.reduce((a: number, i: any) => a + i.balanceOwed, 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Total Invoiced</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sym}{totalInvoiced.toFixed(2)}</p>
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
              <span className="text-xs text-gray-500">Balance Owed</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{sym}{totalBalance.toFixed(2)}</p>
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
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..."
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              {canManage && (
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5" onClick={openAddSupplier}>
                  <Plus className="w-4 h-4" /> Add Supplier
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
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Invoices</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Paid</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Balance</th>
                  <th className="text-center px-4 py-2.5 text-xs text-gray-500 font-medium">Status</th>
                  <th className="text-center px-4 py-2.5 text-xs text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((supplier) => {
                  const sInvoiced = supplier.invoices.reduce((a: number, i: any) => a + i.totalAmount, 0);
                  const sPaid = supplier.invoices.reduce((a: number, i: any) => a + i.amountPaid, 0);
                  const sBalance = supplier.invoices.reduce((a: number, i: any) => a + i.balanceOwed, 0);
                  return (
                    <tr key={supplier.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                        {supplier.notes && <div className="text-xs text-gray-400 truncate max-w-[180px]">{supplier.notes}</div>}
                        <div className="text-xs text-gray-400">{supplier.invoices.length} invoice{supplier.invoices.length !== 1 ? "s" : ""}</div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {supplier.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {supplier.phone}</div>}
                        {supplier.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {supplier.email}</div>}
                        {!supplier.phone && !supplier.email && "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{sym}{sInvoiced.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{sym}{sPaid.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-600">{sym}{sBalance.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${supplier.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {supplier.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setInvoicesSupplier(supplier); setShowInvoicesModal(true); }}
                            className="text-gray-400 hover:text-blue-500 transition-colors" title="View Invoices">
                            <History className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button onClick={() => openAddInvoice(supplier)}
                                className="text-gray-400 hover:text-green-500 transition-colors" title="Add Invoice">
                                <FileText className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditSupplier(supplier)}
                                className="text-gray-400 hover:text-orange-500 transition-colors" title="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteSupplier(supplier.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
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

      {/* Supplier Add/Edit Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h3>
              <button onClick={() => { setShowSupplierModal(false); resetSupplierForm(); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSupplierSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Name *</label>
                <input type="text" required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input type="text" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <input type="text" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              {editingSupplier && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select value={supplierForm.status} onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value as SupplierStatus })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowSupplierModal(false); resetSupplierForm(); }}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">{editingSupplier ? "Update" : "Save"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showInvoiceModal && invoiceSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Add Invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-xs text-gray-500">Supplier</p>
              <p className="font-bold text-gray-900">{invoiceSupplier.name}</p>
            </div>
            <form onSubmit={handleInvoiceSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Invoice Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{sym}</span>
                  <input type="number" step="0.01" min="0.01" required value={invoiceForm.totalAmount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400" placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Invoice Date</label>
                <input type="date" required value={invoiceForm.invoiceDate} max={todayStr()}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Description (items/goods)</label>
                <input type="text" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" placeholder="e.g. Weekly chicken delivery" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">Create Invoice</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Invoice Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 mb-4 text-sm space-y-0.5">
              <p className="text-xs text-gray-500">Invoice</p>
              <p className="font-bold text-gray-900">{selectedInvoice.description || "No description"}</p>
              <p className="text-xs text-gray-500">Balance owed: <strong className="text-red-600">{sym}{selectedInvoice.balanceOwed.toFixed(2)}</strong></p>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{sym}</span>
                  <input type="number" step="0.01" min="0.01" required value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-orange-400" placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Payment Date</label>
                <input type="date" required value={paymentForm.paidAt} max={todayStr()}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Method</label>
                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <input type="text" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">Record Payment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoices List Modal */}
      {showInvoicesModal && invoicesSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Invoices</h3>
                <p className="text-sm text-gray-500">{invoicesSupplier.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1" onClick={() => { setShowInvoicesModal(false); openAddInvoice(invoicesSupplier); }}>
                    <Plus className="w-3.5 h-3.5" /> Add Invoice
                  </Button>
                )}
                <button onClick={() => setShowInvoicesModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3">
              {invoicesSupplier.invoices?.length > 0 ? invoicesSupplier.invoices.map((inv: any) => (
                <div key={inv.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{inv.description || "Invoice"}</p>
                      <p className="text-xs text-gray-400">{fmtDate(inv.invoiceDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || ""}`}>{inv.status}</span>
                      {canManage && inv.status !== "PAID" && (
                        <button onClick={() => { setShowInvoicesModal(false); openPayment(inv); }}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-lg flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Pay
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => handleDeleteInvoice(inv.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500">Total</p>
                      <p className="font-bold">{sym}{inv.totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-gray-500">Paid</p>
                      <p className="font-bold text-green-700">{sym}{inv.amountPaid.toFixed(2)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2">
                      <p className="text-gray-500">Balance</p>
                      <p className="font-bold text-red-600">{sym}{inv.balanceOwed.toFixed(2)}</p>
                    </div>
                  </div>
                  {inv.payments?.length > 0 && (
                    <div className="border-t pt-2">
                      <p className="text-xs text-gray-500 mb-1.5">Payments</p>
                      {inv.payments.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                          <span className="text-gray-500">{fmtDate(p.paidAt)}</span>
                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{p.method}</span>
                          <span className="font-medium text-green-600">{sym}{p.amount.toFixed(2)}</span>
                          <span className="text-gray-400">{p.notes || ""}</span>
                          {canManage && (
                            <button onClick={() => handleDeletePayment(p.id, inv.id)} className="text-gray-300 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No invoices yet</p>
                  {canManage && (
                    <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700" onClick={() => { setShowInvoicesModal(false); openAddInvoice(invoicesSupplier); }}>
                      <Plus className="w-4 h-4 mr-1" /> Add First Invoice
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

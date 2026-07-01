"use client";

import { useState } from "react";
import {
  createInventoryItem, updateInventoryItem, deleteInventoryItem,
  recordTransaction, createRequisition, updateRequisitionStatus,
  deleteRequisition, getTransactions, getInventoryStats,
  getAllInventoryItems,
} from "@/actions/inventory";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Plus, Pencil, Trash2, ArrowUpDown, TrendingDown,
  AlertTriangle, ShoppingCart, ClipboardList, History,
  CheckCircle, XCircle, RefreshCw, Search, Filter,
  PackageOpen, Boxes, ArrowDown, ArrowUp, RotateCcw,
} from "lucide-react";
import { InventoryUnit, TransactionType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type InventoryItem = {
  id: string; name: string; sku: string | null; category: string;
  unit: InventoryUnit; currentStock: number; minStockLevel: number;
  maxStockLevel: number | null; reorderPoint: number; costPerUnit: number;
  supplierId: string | null; description: string | null; location: string | null;
  active: boolean; supplier: { id: string; name: string } | null;
};

type Transaction = {
  id: string; itemId: string; type: TransactionType; quantity: number;
  quantityBefore: number; quantityAfter: number; costPerUnit: number | null;
  totalCost: number | null; reference: string | null; notes: string | null;
  createdAt: Date | string;
  item: { id: string; name: string; unit: InventoryUnit };
  createdBy: { id: string; name: string };
};

type RequisitionItem = {
  id: string; itemId: string; quantityRequested: number;
  quantityFulfilled: number | null; notes: string | null;
  item: { id: string; name: string; unit: InventoryUnit; currentStock: number };
};

type Requisition = {
  id: string; title: string; notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";
  createdAt: Date | string;
  requester: { id: string; name: string };
  approver: { id: string; name: string } | null;
  items: RequisitionItem[];
};

type Supplier = { id: string; name: string };

type Stats = {
  totalItems: number; totalValue: number; lowStockCount: number;
  outOfStockCount: number; pendingRequisitions: number;
};

interface InventoryClientProps {
  initialItems: InventoryItem[];
  initialRequisitions: Requisition[];
  initialStats: Stats;
  initialTransactions: Transaction[];
  suppliers: Supplier[];
  currencySymbol: string;
}

const UNITS: InventoryUnit[] = ["KG","GRAMS","LITERS","ML","PIECES","BOTTLES","CANS","BOXES","BAGS","PORTIONS","OTHER"];
const TX_TYPES: { value: TransactionType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "STOCK_IN",    label: "Stock In",    icon: ArrowDown,    color: "text-green-600" },
  { value: "STOCK_OUT",   label: "Stock Out",   icon: ArrowUp,      color: "text-red-600" },
  { value: "ADJUSTMENT",  label: "Adjustment",  icon: ArrowUpDown,  color: "text-blue-600" },
  { value: "WASTE",       label: "Waste",       icon: Trash2,       color: "text-orange-600" },
  { value: "RETURN",      label: "Return",      icon: RotateCcw,    color: "text-purple-600" },
];

const REQ_STATUS_COLORS = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  APPROVED:  "bg-blue-100 text-blue-700",
  REJECTED:  "bg-red-100 text-red-700",
  FULFILLED: "bg-green-100 text-green-700",
};

function stockStatus(item: InventoryItem) {
  if (item.currentStock === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
  if (item.currentStock <= item.minStockLevel) return { label: "Low Stock", color: "bg-orange-100 text-orange-700" };
  if (item.reorderPoint > 0 && item.currentStock <= item.reorderPoint) return { label: "Reorder", color: "bg-yellow-100 text-yellow-700" };
  return { label: "In Stock", color: "bg-green-100 text-green-700" };
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InventoryClient({
  initialItems, initialRequisitions, initialStats,
  initialTransactions, suppliers, currencySymbol: sym,
}: InventoryClientProps) {
  const [tab, setTab] = useState<"items" | "transactions" | "requisitions">("items");
  const [items, setItems] = useState(initialItems);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void } | null>(null);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [requisitions, setRequisitions] = useState(initialRequisitions);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);

  // Item dialog
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "", sku: "", category: "General", unit: "PIECES" as InventoryUnit,
    currentStock: 0, minStockLevel: 0, maxStockLevel: "", reorderPoint: 0,
    costPerUnit: 0, supplierId: "", description: "", location: "",
  });

  // Transaction dialog
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [txItem, setTxItem] = useState<InventoryItem | null>(null);
  const [txForm, setTxForm] = useState({ type: "STOCK_IN" as TransactionType, quantity: 0, costPerUnit: "", reference: "", notes: "" });

  // Requisition dialog
  const [showReqDialog, setShowReqDialog] = useState(false);
  const [reqForm, setReqForm] = useState({ title: "", notes: "" });
  const [reqItems, setReqItems] = useState<{ itemId: string; quantityRequested: number; notes: string }[]>([]);

  // Fulfill dialog
  const [showFulfillDialog, setShowFulfillDialog] = useState(false);
  const [fulfillReq, setFulfillReq] = useState<Requisition | null>(null);
  const [fulfillQtys, setFulfillQtys] = useState<Record<string, number>>({});

  // View transaction history
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const refreshStats = async () => {
    const s = await getInventoryStats();
    setStats(s);
  };

  // ── Categories from items ────────────────────────────────────────────────
  const categories = ["ALL", ...Array.from(new Set(items.map(i => i.category))).sort()];

  const filteredItems = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchCat = categoryFilter === "ALL" || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  // ── Item CRUD ─────────────────────────────────────────────────────────────
  const openNewItem = () => {
    setEditingItem(null);
    setItemForm({ name: "", sku: "", category: "General", unit: "PIECES", currentStock: 0, minStockLevel: 0, maxStockLevel: "", reorderPoint: 0, costPerUnit: 0, supplierId: "", description: "", location: "" });
    setShowItemDialog(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name, sku: item.sku ?? "", category: item.category,
      unit: item.unit, currentStock: item.currentStock,
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel?.toString() ?? "",
      reorderPoint: item.reorderPoint, costPerUnit: item.costPerUnit,
      supplierId: item.supplierId ?? "", description: item.description ?? "",
      location: item.location ?? "",
    });
    setShowItemDialog(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const payload = {
        name: itemForm.name.trim(),
        sku: itemForm.sku.trim() || undefined,
        category: itemForm.category.trim() || "General",
        unit: itemForm.unit,
        minStockLevel: Number(itemForm.minStockLevel),
        maxStockLevel: itemForm.maxStockLevel ? Number(itemForm.maxStockLevel) : undefined,
        reorderPoint: Number(itemForm.reorderPoint),
        costPerUnit: Number(itemForm.costPerUnit),
        supplierId: itemForm.supplierId || undefined,
        description: itemForm.description || undefined,
        location: itemForm.location || undefined,
      };

      if (editingItem) {
        const r = await updateInventoryItem(editingItem.id, payload);
        if ("error" in r) { toast({ title: r.error, variant: "destructive" }); return; }
        const updated = await getAllInventoryItems();
        setItems(updated.filter(i => i.active));
      } else {
        const r = await createInventoryItem({ ...payload, currentStock: Number(itemForm.currentStock) });
        if ("error" in r) { toast({ title: r.error, variant: "destructive" }); return; }
        const updated = await getAllInventoryItems();
        setItems(updated.filter(i => i.active));
      }
      await refreshStats();
      toast({ title: editingItem ? "Item updated" : "Item created" });
      setShowItemDialog(false);
    } finally { setLoading(false); }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    setConfirmDialog({
      open: true,
      title: `Archive "${item.name}"?`,
      description: "The item will be removed from the inventory list.",
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteInventoryItem(item.id);
        setItems(items.filter(i => i.id !== item.id));
        await refreshStats();
      },
    });
  };

  // ── Transactions ──────────────────────────────────────────────────────────
  const openTx = (item: InventoryItem) => {
    setTxItem(item);
    setTxForm({ type: "STOCK_IN", quantity: 0, costPerUnit: "", reference: "", notes: "" });
    setShowTxDialog(true);
  };

  const handleSaveTx = async () => {
    if (!txItem || txForm.quantity <= 0) { toast({ title: "Quantity must be > 0", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await recordTransaction({
        itemId: txItem.id, type: txForm.type, quantity: Number(txForm.quantity),
        costPerUnit: txForm.costPerUnit ? Number(txForm.costPerUnit) : undefined,
        reference: txForm.reference || undefined, notes: txForm.notes || undefined,
      });
      if ("error" in r) { toast({ title: r.error, variant: "destructive" }); return; }
      const updated = await getAllInventoryItems();
      setItems(updated.filter(i => i.active));
      const newTx = await getTransactions(undefined, 100);
      setTransactions(newTx as Transaction[]);
      await refreshStats();
      toast({ title: "Transaction recorded" });
      setShowTxDialog(false);
    } finally { setLoading(false); }
  };

  // ── Requisitions ──────────────────────────────────────────────────────────
  const openNewReq = () => {
    setReqForm({ title: "", notes: "" });
    setReqItems([{ itemId: "", quantityRequested: 1, notes: "" }]);
    setShowReqDialog(true);
  };

  const handleSaveReq = async () => {
    if (!reqForm.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    const validItems = reqItems.filter(i => i.itemId && i.quantityRequested > 0);
    if (!validItems.length) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await createRequisition({ title: reqForm.title, notes: reqForm.notes || undefined, items: validItems });
      if ("error" in r) { toast({ title: r.error, variant: "destructive" }); return; }
      const updated = await getAllInventoryItems();
      setItems(updated.filter(i => i.active));
      setRequisitions(prev => [r.requisition as unknown as Requisition, ...prev]);
      await refreshStats();
      toast({ title: "Requisition submitted" });
      setShowReqDialog(false);
    } finally { setLoading(false); }
  };

  const handleReqStatus = async (req: Requisition, status: "APPROVED" | "REJECTED") => {
    setLoading(true);
    try {
      const r = await updateRequisitionStatus(req.id, status);
      if ("error" in r) { toast({ title: r.error, variant: "destructive" }); return; }
      setRequisitions(prev => prev.map(r2 => r2.id === req.id ? { ...r2, status } : r2));
      await refreshStats();
      toast({ title: `Requisition ${status.toLowerCase()}` });
    } finally { setLoading(false); }
  };

  const openFulfill = (req: Requisition) => {
    setFulfillReq(req);
    const qtys: Record<string, number> = {};
    req.items.forEach(i => { qtys[i.id] = i.quantityRequested; });
    setFulfillQtys(qtys);
    setShowFulfillDialog(true);
  };

  const handleFulfill = async () => {
    if (!fulfillReq) return;
    setLoading(true);
    try {
      const r = await updateRequisitionStatus(fulfillReq.id, "FULFILLED", fulfillQtys);
      if ("error" in r) { toast({ title: r.error, variant: "destructive" }); return; }
      const updated = await getAllInventoryItems();
      setItems(updated.filter(i => i.active));
      const newTx = await getTransactions(undefined, 100);
      setTransactions(newTx as Transaction[]);
      setRequisitions(prev => prev.map(r2 => r2.id === fulfillReq.id ? { ...r2, status: "FULFILLED" as const } : r2));
      await refreshStats();
      toast({ title: "Requisition fulfilled" });
      setShowFulfillDialog(false);
    } finally { setLoading(false); }
  };

  const handleDeleteReq = (id: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete this requisition?",
      description: "This action cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog(null);
        const r = await deleteRequisition(id);
        if ("error" in r) { toast({ title: r.error, variant: "destructive" }); return; }
        setRequisitions(prev => prev.filter(r2 => r2.id !== id));
      },
    });
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-orange-500" /> Inventory Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track stock, manage items and handle requisitions</p>
        </div>
        <div className="flex gap-2">
          {tab === "items" && (
            <Button onClick={openNewItem} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          )}
          {tab === "requisitions" && (
            <Button onClick={openNewReq} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Plus className="w-4 h-4" /> New Requisition
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard icon={Package} label="Total Items" value={stats.totalItems} color="orange" />
        <KpiCard icon={ShoppingCart} label="Stock Value" value={`${sym}${stats.totalValue.toFixed(2)}`} color="blue" />
        <KpiCard icon={AlertTriangle} label="Low Stock" value={stats.lowStockCount} color="yellow" alert={stats.lowStockCount > 0} />
        <KpiCard icon={PackageOpen} label="Out of Stock" value={stats.outOfStockCount} color="red" alert={stats.outOfStockCount > 0} />
        <KpiCard icon={ClipboardList} label="Pending Reqs" value={stats.pendingRequisitions} color="purple" alert={stats.pendingRequisitions > 0} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 mb-5 w-fit">
        {([["items", Package, "Items"], ["transactions", History, "Transactions"], ["requisitions", ClipboardList, "Requisitions"]] as const).map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-800"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Items Tab ─────────────────────────────────────────────────────── */}
      {tab === "items" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c} value={c}>{c === "ALL" ? "All Categories" : c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Min / Reorder</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Value</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400">No items found</td></tr>
                  ) : filteredItems.map(item => {
                    const st = stockStatus(item);
                    const stockPct = item.maxStockLevel ? Math.min(100, (item.currentStock / item.maxStockLevel) * 100) : null;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-400 flex gap-2">
                            {item.sku && <span>SKU: {item.sku}</span>}
                            {item.location && <span>• {item.location}</span>}
                            {item.supplier && <span>• {item.supplier.name}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{item.category}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900">{item.currentStock} <span className="text-xs font-normal text-gray-400">{item.unit}</span></div>
                          {stockPct !== null && (
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full ml-auto mt-1 overflow-hidden">
                              <div className={`h-full rounded-full ${stockPct < 20 ? "bg-red-400" : stockPct < 50 ? "bg-yellow-400" : "bg-green-400"}`} style={{ width: `${stockPct}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">
                          <div>Min: {item.minStockLevel}</div>
                          <div>Reorder: {item.reorderPoint}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{sym}{item.costPerUnit.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{sym}{(item.currentStock * item.costPerUnit).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" title="Record Transaction" onClick={() => openTx(item)}>
                              <ArrowUpDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700" title="View History" onClick={() => { setHistoryItem(item); setTab("transactions"); }}>
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditItem(item)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDeleteItem(item)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Transactions Tab ────────────────────────────────────────────────── */}
      {tab === "transactions" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Select value={historyItem?.id ?? "ALL"} onValueChange={v => setHistoryItem(v === "ALL" ? null : items.find(i => i.id === v) ?? null)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All Items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Items</SelectItem>
                {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {historyItem && <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => setHistoryItem(null)}>Clear filter</Button>}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Before / After</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Notes</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">By</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(historyItem ? transactions.filter(t => t.itemId === historyItem.id) : transactions).length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400">No transactions found</td></tr>
                  ) : (historyItem ? transactions.filter(t => t.itemId === historyItem.id) : transactions).map(tx => {
                    const txDef = TX_TYPES.find(t => t.value === tx.type);
                    const TxIcon = txDef?.icon ?? ArrowUpDown;
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{tx.item.name}</td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 font-medium ${txDef?.color ?? "text-gray-600"}`}>
                            <TxIcon className="w-3.5 h-3.5" />
                            {txDef?.label ?? tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {["STOCK_OUT","WASTE"].includes(tx.type) ? "-" : "+"}{tx.quantity} {tx.item.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">
                          {tx.quantityBefore} → {tx.quantityAfter}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {tx.totalCost ? `${sym}${tx.totalCost.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{tx.notes ?? tx.reference ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{tx.createdBy.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Requisitions Tab ────────────────────────────────────────────────── */}
      {tab === "requisitions" && (
        <div className="space-y-3">
          {requisitions.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              No requisitions yet
            </div>
          )}
          {requisitions.map(req => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-gray-900">{req.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    By {req.requester.name} · {new Date(req.createdAt).toLocaleDateString()}
                    {req.approver && ` · ${req.status === "REJECTED" ? "Rejected" : "Approved"} by ${req.approver.name}`}
                  </div>
                  {req.notes && <div className="text-xs text-gray-500 mt-1 italic">"{req.notes}"</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${REQ_STATUS_COLORS[req.status]}`}>{req.status}</span>
                  {req.status === "PENDING" && (
                    <>
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleReqStatus(req, "APPROVED")} disabled={loading}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleReqStatus(req, "REJECTED")} disabled={loading}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => handleDeleteReq(req.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  {req.status === "APPROVED" && (
                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => openFulfill(req)} disabled={loading}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Fulfill
                    </Button>
                  )}
                </div>
              </div>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Item</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">Requested</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">Current Stock</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">Fulfilled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {req.items.map(ri => (
                      <tr key={ri.id}>
                        <td className="px-3 py-2 font-medium text-gray-800">{ri.item.name}</td>
                        <td className="px-3 py-2 text-right">{ri.quantityRequested} {ri.item.unit}</td>
                        <td className={`px-3 py-2 text-right ${ri.item.currentStock < ri.quantityRequested ? "text-red-500 font-medium" : "text-gray-600"}`}>
                          {ri.item.currentStock} {ri.item.unit}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {ri.quantityFulfilled != null ? `${ri.quantityFulfilled} ${ri.item.unit}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Item Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 sm:col-span-1">
              <Label>Name *</Label>
              <Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Tomatoes" />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={itemForm.sku} onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. TOM-001" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Vegetables" />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={itemForm.unit} onValueChange={v => setItemForm(f => ({ ...f, unit: v as InventoryUnit }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!editingItem && (
              <div>
                <Label>Initial Stock</Label>
                <Input type="number" min={0} value={itemForm.currentStock} onChange={e => setItemForm(f => ({ ...f, currentStock: Number(e.target.value) }))} />
              </div>
            )}
            <div>
              <Label>Min Stock Level</Label>
              <Input type="number" min={0} value={itemForm.minStockLevel} onChange={e => setItemForm(f => ({ ...f, minStockLevel: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Max Stock Level</Label>
              <Input type="number" min={0} value={itemForm.maxStockLevel} onChange={e => setItemForm(f => ({ ...f, maxStockLevel: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label>Reorder Point</Label>
              <Input type="number" min={0} value={itemForm.reorderPoint} onChange={e => setItemForm(f => ({ ...f, reorderPoint: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Cost per Unit ({sym})</Label>
              <Input type="number" min={0} step="0.01" value={itemForm.costPerUnit} onChange={e => setItemForm(f => ({ ...f, costPerUnit: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Supplier</Label>
              <Select value={itemForm.supplierId || "NONE"} onValueChange={v => setItemForm(f => ({ ...f, supplierId: v === "NONE" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={itemForm.location} onChange={e => setItemForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Storage Room A" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveItem} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
              {loading ? "Saving..." : editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transaction Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showTxDialog} onOpenChange={setShowTxDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Transaction — {txItem?.name}</DialogTitle>
          </DialogHeader>
          {txItem && (
            <div className="py-2 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="text-gray-500">Current Stock:</span>
                <span className="font-bold text-gray-900">{txItem.currentStock} {txItem.unit}</span>
              </div>
              <div>
                <Label>Transaction Type</Label>
                <Select value={txForm.type} onValueChange={v => setTxForm(f => ({ ...f, type: v as TransactionType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity ({txItem.unit})</Label>
                <Input type="number" min={0.01} step="0.01" value={txForm.quantity}
                  onChange={e => setTxForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Cost per Unit ({sym}) <span className="text-gray-400 font-normal">optional</span></Label>
                <Input type="number" min={0} step="0.01" value={txForm.costPerUnit}
                  onChange={e => setTxForm(f => ({ ...f, costPerUnit: e.target.value }))}
                  placeholder={`Default: ${sym}${txItem.costPerUnit}`} />
              </div>
              <div>
                <Label>Reference</Label>
                <Input value={txForm.reference} onChange={e => setTxForm(f => ({ ...f, reference: e.target.value }))} placeholder="Invoice #, Order #, etc." />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTxDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTx} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
              {loading ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Requisition Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showReqDialog} onOpenChange={setShowReqDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Stock Requisition</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={reqForm.title} onChange={e => setReqForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Weekly kitchen restock" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={reqForm.notes} onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReqItems(prev => [...prev, { itemId: "", quantityRequested: 1, notes: "" }])}>
                  <Plus className="w-3 h-3 mr-1" /> Add Row
                </Button>
              </div>
              <div className="space-y-2">
                {reqItems.map((ri, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Select value={ri.itemId || "NONE"} onValueChange={v => setReqItems(prev => prev.map((x, i) => i === idx ? { ...x, itemId: v === "NONE" ? "" : v } : x))}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {items.map(it => <SelectItem key={it.id} value={it.id}>{it.name} ({it.currentStock} {it.unit})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input type="number" min={1} step="0.1" value={ri.quantityRequested} className="w-24"
                      onChange={e => setReqItems(prev => prev.map((x, i) => i === idx ? { ...x, quantityRequested: Number(e.target.value) } : x))} />
                    <Input value={ri.notes} placeholder="Notes" className="w-32"
                      onChange={e => setReqItems(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 shrink-0"
                      onClick={() => setReqItems(prev => prev.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReqDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveReq} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
              {loading ? "Submitting..." : "Submit Requisition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fulfill Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showFulfillDialog} onOpenChange={setShowFulfillDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fulfill Requisition — {fulfillReq?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-500">Set the actual quantity to issue for each item. Stock will be deducted automatically.</p>
            {fulfillReq?.items.map(ri => (
              <div key={ri.id} className="flex items-center gap-3">
                <div className="flex-1 text-sm">
                  <div className="font-medium text-gray-900">{ri.item.name}</div>
                  <div className="text-xs text-gray-400">Requested: {ri.quantityRequested} {ri.item.unit} · Available: {ri.item.currentStock}</div>
                </div>
                <Input type="number" min={0} step="0.1" className="w-24"
                  value={fulfillQtys[ri.id] ?? ri.quantityRequested}
                  onChange={e => setFulfillQtys(prev => ({ ...prev, [ri.id]: Number(e.target.value) }))} />
                <span className="text-xs text-gray-400 shrink-0">{ri.item.unit}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFulfillDialog(false)}>Cancel</Button>
            <Button onClick={handleFulfill} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? "Fulfilling..." : "Confirm Fulfillment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel="Confirm"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, alert }: {
  icon: React.ElementType; label: string; value: string | number;
  color: "orange" | "blue" | "yellow" | "red" | "purple"; alert?: boolean;
}) {
  const colors = {
    orange: "bg-orange-50 text-orange-600",
    blue:   "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red:    "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card className={`border-0 shadow-sm ${alert ? "ring-2 ring-red-200" : ""}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-lg font-bold text-gray-900">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

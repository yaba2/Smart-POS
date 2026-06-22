"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  addItemToOrder,
  updateOrderItemQuantity,
  removeOrderItem,
  sendOrder,
  completePayment,
  cancelOrder,
  updateOrderItemNotes,
  printBill,
  splitBill,
  recordPartialPayment,
  mergeOrders,
} from "@/actions/orders";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Minus,
  Trash2,
  Send,
  CreditCard,
  ArrowLeft,
  Printer,
  ShoppingCart,
  ChevronRight,
  StickyNote,
  X,
  Banknote,
  Smartphone,
  CheckCircle2,
  Scissors,
  Receipt,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrinter } from "@/hooks/use-printer";

interface ModifierItemOption {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

interface ModifierGroupData {
  id: string;
  name: string;
  type: string;
  required: boolean;
  multiple: boolean;
  items: ModifierItemOption[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  available: boolean;
  modifierGroups?: { modifierGroup: ModifierGroupData }[];
}

interface Category {
  id: string;
  name: string;
  items: MenuItem[];
  modifierGroups?: { modifierGroup: ModifierGroupData }[];
}

interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  price: number;
  notes: string | null;
  options: string | null; // JSON: { "Accompanied With": "Chips", "Extras": "Extra Shot (+$0.50)" }
  menuItem: MenuItem & { category: { name: string; printer: string | null } };
}

interface Order {
  id: string;
  status: string;
  total: number;
  paidAmount: number;
  sentAt: Date | null;
  table: { id: string; name: string };
  waiter: { name: string; id: string };
  orderItems: OrderItem[];
}

interface PaymentMethodConfig {
  id: string;
  name: string;
  code: string;
  icon: string | null;
  color: string | null;
  active: boolean;
  sortOrder: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote,
  Smartphone,
  CreditCard,
  Wallet: CreditCard,
  CircleDollarSign: Banknote,
  QrCode: Smartphone,
  Coins: Banknote,
  Landmark: CreditCard,
};

const BG_MAP: Record<string, string> = {
  "text-green-600":  "bg-green-50 border-green-200",
  "text-blue-600":   "bg-blue-50 border-blue-200",
  "text-purple-600": "bg-purple-50 border-purple-200",
  "text-orange-600": "bg-orange-50 border-orange-200",
  "text-red-600":    "bg-red-50 border-red-200",
  "text-gray-600":   "bg-gray-50 border-gray-200",
};

interface ReceiptSettings {
  restaurantName: string;
  address?: string;
  phone?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptLogo?: string;
}

interface OrderClientProps {
  order: Order;
  menu: Category[];
  currencySymbol: string;
  taxRate: number;
  permissions: string[];
  paymentMethods: PaymentMethodConfig[];
  receiptSettings?: ReceiptSettings;
  printServerIp?: string;
}

export function OrderClient({ order, menu, currencySymbol, taxRate, permissions, paymentMethods, receiptSettings, printServerIp }: OrderClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(menu[0]?.id || "");
  const [orderItems, setOrderItems] = useState<OrderItem[]>(order.orderItems);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>(paymentMethods[0]?.code || "CASH");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [orderStatus, setOrderStatus] = useState(order.status);
  const [livePaidAmount, setLivePaidAmount] = useState(order.paidAmount);
  // IDs of items that were already sent to kitchen when this page loaded
  const [sentItemIds] = useState<Set<string>>(
    () => new Set(order.status !== "OPEN" ? order.orderItems.map((i) => i.id) : [])
  );
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  // Split bill mode
  const [splitMode, setSplitMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Modifier selection dialog
  const [modifierDialogItem, setModifierDialogItem] = useState<MenuItem | null>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({}); // groupId → selected item ids

  // Printer integration
  const printerWasConnected = useRef(false);
  const printer = usePrinter({
    autoConnect: true,
    printServerIp,
    onStatusChange: (status) => {
      if (status === "connected") {
        printerWasConnected.current = true;
      }
      if (status === "error" && printerWasConnected.current) {
        toast({ title: "Printer connection lost", variant: "destructive" });
        printerWasConnected.current = false;
      }
    },
  });

  useEffect(() => {
    if (orderStatus !== "SENT" && orderStatus !== "WAITING_PAYMENT") return;
    const base = order.sentAt ? new Date(order.sentAt).getTime() : Date.now();
    const tick = () => setElapsedSec(Math.floor((Date.now() - base) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [orderStatus, order.sentAt]);

  const canSettle = permissions.includes("SETTLE_BILL");
  const canCancel = permissions.includes("CANCEL_ORDER");

  const symbol = currencySymbol || "$";
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // Allow adding items as long as order is not completed/cancelled
  const isLocked = orderStatus === "COMPLETED" || orderStatus === "CANCELLED";
  const currentCategory = menu.find((c) => c.id === selectedCategory);

  // Get all modifier groups for a menu item (item-level + category-level, deduplicated)
  const getItemModifierGroups = (item: MenuItem): ModifierGroupData[] => {
    const category = menu.find((c) => c.items.some((i) => i.id === item.id));
    const seen = new Set<string>();
    const groups: ModifierGroupData[] = [];
    for (const mg of (item.modifierGroups ?? [])) {
      if (!seen.has(mg.modifierGroup.id)) { seen.add(mg.modifierGroup.id); groups.push(mg.modifierGroup); }
    }
    for (const mg of (category?.modifierGroups ?? [])) {
      if (!seen.has(mg.modifierGroup.id)) { seen.add(mg.modifierGroup.id); groups.push(mg.modifierGroup); }
    }
    return groups;
  };

  const handleAddItem = async (item: MenuItem) => {
    // If item has modifiers, show selection dialog first
    const modGroups = getItemModifierGroups(item);
    if (modGroups.length > 0) {
      const initSelections: Record<string, string[]> = {};
      modGroups.forEach((g) => { initSelections[g.id] = []; });
      setModifierSelections(initSelections);
      setModifierDialogItem(item);
      return;
    }
    await doAddItem(item, {});
  };

  const handleConfirmWithModifiers = async () => {
    if (!modifierDialogItem) return;
    const modGroups = getItemModifierGroups(modifierDialogItem);
    // Validate required groups
    for (const g of modGroups) {
      if (g.required && (modifierSelections[g.id] ?? []).length === 0) {
        toast({ title: `Please select an option for "${g.name}"`, variant: "destructive" });
        return;
      }
    }
    // Build options string: { "Accompanied With": "Chips", "Extras": "Extra Shot (+$0.50)" }
    const optionsMap: Record<string, string> = {};
    let extraPrice = 0;
    modGroups.forEach((g) => {
      const selected = (modifierSelections[g.id] ?? [])
        .map((id) => g.items.find((i) => i.id === id))
        .filter(Boolean) as ModifierItemOption[];
      if (selected.length > 0) {
        optionsMap[g.name] = selected.map((s) => s.price > 0 ? `${s.name} (+${symbol}${s.price.toFixed(2)})` : s.name).join(", ");
        extraPrice += selected.reduce((sum, s) => sum + s.price, 0);
      }
    });
    const item = modifierDialogItem;
    setModifierDialogItem(null);
    await doAddItem({ ...item, price: item.price + extraPrice }, optionsMap);
  };

  const doAddItem = async (item: MenuItem & { price: number }, optionsMap: Record<string, string>) => {
    setActionLoading(`add-${item.id}`);
    const optionsJson = Object.keys(optionsMap).length > 0 ? JSON.stringify(optionsMap) : undefined;
    const prev = [...orderItems];
    // Only merge if no custom options
    const existing = !optionsJson ? orderItems.find((o) => o.menuItemId === item.id && !o.notes && !sentItemIds.has(o.id)) : null;
    if (existing) {
      setOrderItems(orderItems.map((o) =>
        o.id === existing.id ? { ...o, quantity: o.quantity + 1 } : o
      ));
      setNewItemIds((prev) => new Set(Array.from(prev).concat(existing.id)));
    } else {
      const tempId = `temp-${Date.now()}`;
      const tempItem: OrderItem = {
        id: tempId,
        menuItemId: item.id,
        quantity: 1,
        price: item.price,
        notes: null,
        options: optionsJson ?? null,
        menuItem: item as OrderItem["menuItem"],
      };
      setOrderItems((cur) => [...cur, tempItem]);
      setNewItemIds((prev) => new Set(Array.from(prev).concat(tempId)));
    }

    try {
      const result = await addItemToOrder(order.id, item.id, 1, undefined, optionsJson, optionsJson ? item.price : undefined);
      if ("error" in result) {
        setOrderItems(prev);
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        const response = await fetch(`/api/orders/${order.id}/items`);
        if (response.ok) {
          const data: OrderItem[] = await response.json();
          setOrderItems(data);
          setNewItemIds((prev) => {
            const updated = new Set(prev);
            data.forEach((i) => { if (!sentItemIds.has(i.id)) updated.add(i.id); });
            return updated;
          });
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const canEditItem = (itemId: string) => !sentItemIds.has(itemId) || canCancel;

  const handleQtyChange = async (itemId: string, newQty: number) => {
    if (!canEditItem(itemId)) {
      toast({ title: "Already sent — only authorised users can modify", variant: "destructive" });
      return;
    }
    const prev = [...orderItems];
    if (newQty <= 0) {
      setOrderItems(orderItems.filter((o) => o.id !== itemId));
      setNewItemIds((s) => { const n = new Set(s); n.delete(itemId); return n; });
    } else {
      setOrderItems(orderItems.map((o) => (o.id === itemId ? { ...o, quantity: newQty } : o)));
    }
    try {
      await updateOrderItemQuantity(itemId, newQty);
    } catch {
      setOrderItems(prev);
      toast({ title: "Failed to update quantity", variant: "destructive" });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!canEditItem(itemId)) {
      toast({ title: "Already sent — only authorised users can remove", variant: "destructive" });
      return;
    }
    if (!confirm("Remove this item from the order?")) return;
    const prev = [...orderItems];
    setOrderItems(orderItems.filter((o) => o.id !== itemId));
    setNewItemIds((s) => { const n = new Set(s); n.delete(itemId); return n; });
    try {
      await removeOrderItem(itemId);
    } catch {
      setOrderItems(prev);
      toast({ title: "Failed to remove item", variant: "destructive" });
    }
  };

  const handleSaveNote = async (itemId: string) => {
    await updateOrderItemNotes(itemId, noteValue);
    setOrderItems(orderItems.map((o) => (o.id === itemId ? { ...o, notes: noteValue } : o)));
    setEditingNoteId(null);
  };

  const hasNewItems = newItemIds.size > 0 || orderStatus === "OPEN";
  // True when there are unsent items — blocks bill/split/settle/back actions.
  // Covers: (a) brand-new OPEN order with items, (b) new items added to an already-SENT order.
  const hasUnsentItems =
    (orderStatus === "OPEN" && orderItems.length > 0) ||
    (orderStatus === "SENT" && newItemIds.size > 0) ||
    (orderStatus === "WAITING_PAYMENT" && newItemIds.size > 0);

  function fmtElapsed(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  const handleSendOrder = async () => {
    setActionLoading("send");
    try {
      const result = await sendOrder(order.id);
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        toast({ title: "Order sent to kitchen!" });
        
        // Trigger automatic printing to kitchen/bar printers
        if (!printer.isConnected) {
          toast({ title: "Print server not connected — start it in the print-server folder", variant: "destructive" });
        } else {
          // Only print items that are new (not yet sent) — avoids reprinting on add-to-existing-order
          const itemsToPrint = orderItems.filter(item => newItemIds.has(item.id));
          const kitchenItems = itemsToPrint.filter(
            item => item.menuItem.category?.printer === "KITCHEN"
          );
          const barItems = itemsToPrint.filter(
            item => item.menuItem.category?.printer === "BAR"
          );

          // Print kitchen tickets
          if (kitchenItems.length > 0) {
            try {
              await printer.printKitchen({
                orderId: order.id,
                tableName: order.table.name,
                waiterName: order.waiter.name,
                category: "KITCHEN",
                items: kitchenItems.map(item => {
                  const modifiers: string[] = [];
                  if (item.options) {
                    try {
                      const opts = JSON.parse(item.options) as Record<string, string>;
                      Object.entries(opts).forEach(([, v]) => modifiers.push(v));
                    } catch {}
                  }
                  return {
                    name: item.menuItem.name,
                    quantity: item.quantity,
                    notes: item.notes || undefined,
                    modifiers: modifiers.length > 0 ? modifiers : undefined,
                  };
                }),
                timestamp: new Date(),
              });
            } catch (printErr) {
              console.error("Kitchen print failed:", printErr);
              toast({ title: "Kitchen printer error", variant: "destructive" });
            }
          }

          // Print bar tickets
          if (barItems.length > 0) {
            try {
              await printer.printBar({
                orderId: order.id,
                tableName: order.table.name,
                waiterName: order.waiter.name,
                category: "BAR",
                items: barItems.map(item => {
                  const modifiers: string[] = [];
                  if (item.options) {
                    try {
                      const opts = JSON.parse(item.options) as Record<string, string>;
                      Object.entries(opts).forEach(([, v]) => modifiers.push(v));
                    } catch {}
                  }
                  return {
                    name: item.menuItem.name,
                    quantity: item.quantity,
                    notes: item.notes || undefined,
                    modifiers: modifiers.length > 0 ? modifiers : undefined,
                  };
                }),
                timestamp: new Date(),
              });
            } catch (printErr) {
              console.error("Bar print failed:", printErr);
              toast({ title: "Bar printer error", variant: "destructive" });
            }
          }

          if (kitchenItems.length === 0 && barItems.length === 0) {
            toast({ title: "No printer assigned to these items — set Category printer in admin menu", variant: "destructive" });
          }
        }
        
        router.push("/pos/tables");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleBack = () => {
    if (hasUnsentItems) {
      toast({ title: "Send or cancel the order before leaving the table", variant: "destructive" });
      return;
    }
    router.push("/pos/tables");
  };

  const handlePrintBill = async () => {
    setActionLoading("print");
    try {
      const result = await printBill(order.id);
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        // Send receipt to BILL printer
        if (!printer.isConnected) {
          toast({ title: "Print server not connected — bill not printed", variant: "destructive" });
        } else {
          try {
            const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
            const tax = subtotal * (taxRate / 100);
            const total = subtotal + tax;
            await printer.printReceipt({
              orderId: order.id,
              tableName: order.table.name,
              waiterName: order.waiter.name,
              restaurantName: receiptSettings?.restaurantName || "Restaurant",
              restaurantAddress: receiptSettings?.address,
              restaurantPhone: receiptSettings?.phone,
              header: receiptSettings?.receiptHeader,
              footer: receiptSettings?.receiptFooter,
              logo: receiptSettings?.receiptLogo,
              items: orderItems.map((i) => {
                // Build name: append only paid extras (not free accompaniments)
                let displayName = i.menuItem.name;
                if (i.options) {
                  try {
                    const opts = JSON.parse(i.options) as Record<string, string>;
                    const extrasText = Object.values(opts)
                      .filter((v) => v.includes("+")) // only entries that have a price
                      .join(", ");
                    if (extrasText) displayName += ` + ${extrasText}`;
                  } catch {}
                }
                return {
                  name: displayName,
                  quantity: i.quantity,
                  price: i.price,
                  total: i.price * i.quantity,
                };
              }),
              subtotal,
              tax,
              total,
              paymentMethod: selectedPayment,
              amountPaid: total,
              change: 0,
              timestamp: new Date(),
            });
            toast({ title: "Bill printed — table set to Waiting Payment" });
          } catch (printErr) {
            console.error("Bill print failed:", printErr);
            toast({ title: "Bill printer error — check print server", variant: "destructive" });
          }
        }
        router.push("/pos/tables");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompletePayment = async () => {
    if (!canSettle) {
      toast({ title: "You don't have permission to settle bills", variant: "destructive" });
      return;
    }
    setActionLoading("payment");
    try {
      const result = await completePayment(order.id, selectedPayment, customerName.trim() || undefined);
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        toast({ title: `Payment received via ${selectedPayment}!` });
        setShowPaymentModal(false);
        router.push("/pos/tables");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!canCancel) {
      toast({ title: "You don't have permission to cancel orders", variant: "destructive" });
      return;
    }
    if (!confirm("Cancel this order? This will mark the order as cancelled and free the table.")) return;
    setActionLoading("cancel");
    try {
      await cancelOrder(order.id);
      toast({ title: "Order cancelled" });
      router.push("/pos/tables");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseTable = () => {
    router.push("/pos/tables");
  };

  // Split Bill handlers
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectedSubtotal = orderItems
    .filter((item) => selectedItems.has(item.id))
    .reduce((s, i) => s + i.price * i.quantity, 0);
  const selectedTax = selectedSubtotal * (taxRate / 100);
  const selectedTotal = selectedSubtotal + selectedTax;

  const handleSplitBillPrint = async () => {
    if (selectedItems.size === 0) {
      toast({ title: "Select items to print bill", variant: "destructive" });
      return;
    }
    setActionLoading("split-print");
    try {
      const result = await splitBill(order.id, Array.from(selectedItems), order.waiter.id, "print");
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        toast({ title: "Bill printed for selected items" });
        setSplitMode(false);
        setSelectedItems(new Set());
        router.push("/pos/tables");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSplitBillSettle = () => {
    if (selectedItems.size === 0) {
      toast({ title: "Select items to settle", variant: "destructive" });
      return;
    }
    if (!canSettle) {
      toast({ title: "You don't have permission to settle bills", variant: "destructive" });
      return;
    }
    // Show payment method modal for split settle
    setShowSplitPaymentModal(true);
  };

  const handleConfirmSplitSettle = async () => {
    setActionLoading("split-settle");
    try {
      const result = await splitBill(
        order.id,
        Array.from(selectedItems),
        order.waiter.id,
        "settle",
        selectedPayment,
        customerName.trim() || undefined
      );
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        toast({ title: `${selectedItems.size} item(s) settled via ${selectedPayment}` });
        setShowSplitPaymentModal(false);
        setSplitMode(false);
        setSelectedItems(new Set());
        router.push("/pos/tables");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Partial Payment handler
  const handlePartialPayment = async () => {
    if (!canSettle) {
      toast({ title: "You don't have permission to settle bills", variant: "destructive" });
      return;
    }
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    const remainingDue = total - livePaidAmount;
    if (amount > remainingDue) {
      toast({ title: `Amount exceeds remaining balance (${symbol}${remainingDue.toFixed(2)})`, variant: "destructive" });
      return;
    }
    setActionLoading("partial");
    try {
      const result = await recordPartialPayment(order.id, selectedPayment, amount, customerName.trim() || undefined);
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
      } else {
        if (result.fullyPaid) {
          toast({ title: `Payment complete! ${symbol}${result.paidAmount?.toFixed(2)} via ${selectedPayment}` });
          setShowPartialPayment(false);
          setShowPaymentModal(false);
          router.push("/pos/tables");
        } else {
          const newPaid = livePaidAmount + amount;
          setLivePaidAmount(newPaid);
          toast({ title: `Paid ${symbol}${amount.toFixed(2)} via ${selectedPayment}. Remaining: ${symbol}${result.remaining?.toFixed(2)}` });
          setPartialAmount("");
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* LEFT: Menu Panel */}
      <div className="flex flex-col w-full md:w-[60%] lg:w-[65%] border-r border-gray-200 bg-white">
        {/* Table + Back */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Tables</span>
          </button>
          <ChevronRight className="w-3 h-3 text-gray-300" />
          <span className="text-sm font-semibold text-gray-800">{order.table.name}</span>
          <Badge
            variant={orderStatus === "OPEN" ? "warning" : orderStatus === "SENT" ? "info" : "success"}
            className="ml-auto"
          >
            {orderStatus}
          </Badge>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto px-3 py-2 border-b border-gray-100 scrollbar-hide">
          {menu.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                selectedCategory === cat.id
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLocked && (
            <div className="mb-3 px-3 py-2 bg-gray-100 rounded-xl text-xs text-gray-500 text-center">
              Order is {order.status.toLowerCase()} — no more items can be added
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {currentCategory?.items.map((item) => (
              <button
                key={item.id}
                onClick={() => !isLocked && item.available && handleAddItem(item)}
                disabled={isLocked || actionLoading === `add-${item.id}` || !item.available}
                className={cn(
                  "flex flex-col p-3 bg-white border-2 border-gray-100 rounded-xl text-left transition-all active:scale-95 hover:border-orange-200 hover:shadow-sm",
                  (isLocked || !item.available) && "opacity-50 cursor-not-allowed",
                  actionLoading === `add-${item.id}` && "opacity-50"
                )}
              >
                {/* Item image */}
                <div className="w-full aspect-square rounded-lg mb-2 overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement).style.display = "flex"; }} />
                  ) : null}
                  <span className="text-2xl" style={{ display: item.image ? "none" : "flex" }}>
                    {item.name.charAt(0)}
                  </span>
                </div>
                <div className="font-semibold text-gray-800 text-xs leading-tight line-clamp-2 mb-1">
                  {item.name}
                </div>
                <div className="font-bold text-orange-500 text-sm mt-auto">
                  {symbol}{item.price.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
          {!currentCategory?.items.length && (
            <div className="text-center py-12 text-gray-400">No items in this category</div>
          )}
        </div>
      </div>

      {/* RIGHT: Order Panel */}
      <div className="hidden md:flex flex-col w-[40%] lg:w-[35%] bg-gray-50">
        {/* Order header */}
        <div className="px-4 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-gray-800">Order</span>
              <span className="text-xs text-gray-400">#{order.id.slice(-6)}</span>
            </div>
            <div className="flex items-center gap-2">
              {(orderStatus === "SENT" || orderStatus === "WAITING_PAYMENT") && (
                <span className="flex items-center gap-1 text-xs font-mono font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg px-2 py-0.5">
                  <Clock className="w-3 h-3" />{fmtElapsed(elapsedSec)}
                </span>
              )}
              <span className="text-xs text-gray-500">Waiter: {order.waiter.name}</span>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orderItems.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <ShoppingCart className="w-10 h-10 opacity-30" />
              <p className="text-sm">Tap items to add to order</p>
            </div>
          )}
          {orderItems.map((item) => (
            <div key={item.id} className={cn(
              "bg-white rounded-xl p-3 border shadow-sm",
              splitMode && selectedItems.has(item.id) ? "border-orange-300 bg-orange-50" : "border-gray-100"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 flex items-start gap-2">
                  {splitMode && (
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      className="mt-1 w-4 h-4 accent-orange-500 shrink-0 cursor-pointer"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 leading-tight truncate">
                      {item.menuItem.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {symbol}{item.price.toFixed(2)} each
                    </p>
                    {item.options && (() => {
                      try {
                        const opts = JSON.parse(item.options) as Record<string, string>;
                        return Object.entries(opts).map(([k, v]) => (
                          <p key={k} className="text-xs text-orange-500 mt-0.5">↳ {k}: {v}</p>
                        ));
                      } catch { return null; }
                    })()}
                    {item.notes && (
                      <p className="text-xs text-blue-500 mt-0.5 italic">📝 {item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isLocked && sentItemIds.has(item.id) && (
                    <span className="flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 rounded-lg px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" /> x{item.quantity} SENT
                    </span>
                  )}
                  {!isLocked && !sentItemIds.has(item.id) && (
                    <>
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-600 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {isLocked && (
                    <span className="w-6 text-center text-sm font-bold text-gray-600">x{item.quantity}</span>
                  )}
                </div>
              </div>

              {/* Note + remove row */}
              {!isLocked && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => {
                      setEditingNoteId(item.id);
                      setNoteValue(item.notes || "");
                    }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <StickyNote className="w-3 h-3" />
                    {item.notes ? "Edit note" : "Add note"}
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-gray-700">
                      {symbol}{(item.price * item.quantity).toFixed(2)}
                    </span>
                    {canEditItem(item.id) ? (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="ml-1 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="ml-1 w-6 h-6 flex items-center justify-center rounded-md text-gray-200 cursor-not-allowed" title="Already sent">
                        <Trash2 className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              )}
              {isLocked && (
                <div className="flex justify-end mt-1">
                  <span className="text-xs font-bold text-gray-700">
                    {symbol}{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Inline note editor */}
              {editingNoteId === item.id && (
                <div className="mt-2 flex gap-1">
                  <input
                    type="text"
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    placeholder="e.g. No onions"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveNote(item.id);
                      if (e.key === "Escape") setEditingNoteId(null);
                    }}
                  />
                  <button
                    onClick={() => handleSaveNote(item.id)}
                    className="px-2 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingNoteId(null)}
                    className="px-1.5 py-1 bg-gray-100 rounded-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Totals & Actions */}
        <div className="bg-white border-t border-gray-200 p-4 space-y-3">
          {/* Split Bill Mode Indicator */}
          {splitMode && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Split Bill Mode
                </span>
                <button
                  onClick={() => { setSplitMode(false); setSelectedItems(new Set()); }}
                  className="text-xs text-orange-600 hover:text-orange-800"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs text-orange-600 mb-2">
                Select items to print or settle separately
              </div>
              {selectedItems.size > 0 && (
                <div className="space-y-1 border-t border-orange-200 pt-2">
                  <div className="flex justify-between text-xs text-orange-700">
                    <span>Selected ({selectedItems.size} items)</span>
                    <span>{symbol}{selectedSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-orange-800">
                    <span>Selected Total</span>
                    <span>{symbol}{selectedTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{symbol}{subtotal.toFixed(2)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tax ({taxRate}%)</span>
                <span>{symbol}{tax.toFixed(2)}</span>
              </div>
            )}
            {livePaidAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>-{symbol}{livePaidAmount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base text-gray-900">
              <span>{livePaidAmount > 0 ? "Remaining" : "Total"}</span>
              <span className="text-orange-500">{symbol}{Math.max(0, total - livePaidAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Split Bill Actions */}
          {splitMode ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleSplitBillPrint}
                disabled={selectedItems.size === 0 || !!actionLoading}
              >
                <Receipt className="w-4 h-4" />
                {actionLoading === "split-print" ? "Printing..." : "Print Selected"}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700"
                onClick={handleSplitBillSettle}
                disabled={selectedItems.size === 0 || !!actionLoading || !canSettle}
              >
                <CreditCard className="w-4 h-4" />
                {actionLoading === "split-settle" ? "Settling..." : "Settle Selected"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-gray-600"
                onClick={hasUnsentItems ? () => toast({ title: "Send the order to kitchen before printing the bill", variant: "destructive" }) : handlePrintBill}
                disabled={!!actionLoading || orderItems.length === 0 || isLocked}
                title={hasUnsentItems ? "Send order first" : undefined}
              >
                <Printer className="w-4 h-4" />
                {actionLoading === "print" ? "Printing..." : "Print Bill"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-gray-600"
                onClick={hasUnsentItems ? () => toast({ title: "Send the order to kitchen before splitting the bill", variant: "destructive" }) : () => setSplitMode(true)}
                disabled={!!actionLoading || orderItems.length === 0 || isLocked}
                title={hasUnsentItems ? "Send order first" : undefined}
              >
                <Scissors className="w-4 h-4" />
                Split Bill
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {/* Send Order and Cancel buttons row */}
            {(orderStatus === "OPEN" || orderStatus === "SENT") && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleSendOrder}
                  disabled={orderItems.length === 0 || !!actionLoading || !hasNewItems}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 h-11 disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  {actionLoading === "send" ? "Sending..." : orderStatus === "SENT" ? "Re-send Order" : "Send Order"}
                </Button>
                <Button
                  onClick={handleCancelOrder}
                  disabled={!!actionLoading || orderItems.length === 0}
                  variant="outline"
                  className="w-full gap-2 h-11 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                  {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
                </Button>
              </div>
            )}
            {hasUnsentItems && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Send order to kitchen before printing, splitting or settling
              </div>
            )}
            {/* Settle Bill and Close Table buttons row */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  if (hasUnsentItems) {
                    toast({ title: "Send order to kitchen first before settling", variant: "destructive" });
                    return;
                  }
                  canSettle ? setShowPaymentModal(true) : toast({ title: "No permission to settle bills", variant: "destructive" });
                }}
                disabled={orderItems.length === 0 || !!actionLoading || isLocked || orderStatus === "OPEN"}
                className={cn(
                  "w-full gap-2 h-11",
                  canSettle && orderStatus !== "OPEN" ? "bg-orange-500 hover:bg-orange-600" : "bg-gray-300 text-gray-500 cursor-not-allowed"
                )}
              >
                <CreditCard className="w-4 h-4" />
                {!canSettle ? "Settle (No Permission)" : orderStatus === "OPEN" ? "Send Order First" : "Settle Bill"}
              </Button>
              <Button
                onClick={handleCloseTable}
                variant="outline"
                className="w-full gap-2 h-11 border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
                Close Table
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Floating Order Button */}
      <div className="md:hidden fixed bottom-4 right-4">
        <button
          className="w-14 h-14 bg-orange-500 rounded-full shadow-lg flex items-center justify-center relative"
          onClick={() => document.getElementById("mobile-order")?.classList.toggle("hidden")}
        >
          <ShoppingCart className="w-6 h-6 text-white" />
          {orderItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
              {orderItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Select Payment Method</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {paymentMethods.map((method) => {
                const Icon = ICON_MAP[method.icon || "CreditCard"] || CreditCard;
                const color = method.color || "text-gray-600";
                const bg = BG_MAP[color] || "bg-gray-50 border-gray-200";
                return (
                  <button
                    key={method.code}
                    onClick={() => setSelectedPayment(method.code)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedPayment === method.code
                        ? `${bg} border-current ${color} shadow-sm`
                        : "border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <Icon className={cn("w-6 h-6", selectedPayment === method.code ? color : "text-gray-400")} />
                    <span className={cn("font-semibold text-sm", selectedPayment === method.code ? color : "text-gray-600")}>
                      {method.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{symbol}{subtotal.toFixed(2)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({taxRate}%)</span><span>{symbol}{tax.toFixed(2)}</span>
                </div>
              )}
              {livePaidAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Already Paid</span><span>-{symbol}{livePaidAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1 mt-1">
                <span>{livePaidAmount > 0 ? "Remaining Due" : "Total"}</span>
                <span className="text-orange-500">{symbol}{Math.max(0, total - livePaidAmount).toFixed(2)}</span>
              </div>
            </div>

            {/* Customer Name */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional — type customer name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>

            {/* Partial Payment Toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPartialPayment}
                  onChange={(e) => {
                    setShowPartialPayment(e.target.checked);
                    if (!e.target.checked) setPartialAmount("");
                  }}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">Partial Payment</span>
              </label>
            </div>

            {/* Partial Payment Input */}
            {showPartialPayment && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
                <label className="block text-xs font-medium text-blue-700">Amount to Pay Now</label>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-bold">{symbol}</span>
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    max={Math.max(0, total - livePaidAmount)}
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="text-xs space-y-1 border-t border-blue-200 pt-2">
                  {livePaidAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Already paid</span>
                      <span>{symbol}{livePaidAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {partialAmount && parseFloat(partialAmount) > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>This payment</span>
                      <span>{symbol}{parseFloat(partialAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-red-600">
                    <span>Remaining after</span>
                    <span>{symbol}{Math.max(0, total - livePaidAmount - parseFloat(partialAmount || "0")).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={showPartialPayment ? handlePartialPayment : handleCompletePayment}
              disabled={!!actionLoading || (showPartialPayment && (!partialAmount || parseFloat(partialAmount) <= 0 || parseFloat(partialAmount) > Math.max(0, total - livePaidAmount)))}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 gap-2 text-base"
            >
              <CheckCircle2 className="w-5 h-5" />
              {actionLoading === "payment" || actionLoading === "partial"
                ? "Processing..."
                : showPartialPayment
                  ? `Pay ${symbol}${partialAmount || "0.00"} via ${selectedPayment}`
                  : `Confirm ${selectedPayment} — ${symbol}${Math.max(0, total - livePaidAmount).toFixed(2)}`}
            </Button>
          </div>
        </div>
      )}

      {/* Split Settle Payment Modal */}
      {showSplitPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Settle Selected Items</h3>
              <button onClick={() => setShowSplitPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {paymentMethods.map((method) => {
                const Icon = ICON_MAP[method.icon || "CreditCard"] || CreditCard;
                const color = method.color || "text-gray-600";
                const bg = BG_MAP[color] || "bg-gray-50 border-gray-200";
                return (
                  <button
                    key={method.code}
                    onClick={() => setSelectedPayment(method.code)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedPayment === method.code
                        ? `${bg} border-current ${color} shadow-sm`
                        : "border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <Icon className={cn("w-6 h-6", selectedPayment === method.code ? color : "text-gray-400")} />
                    <span className={cn("font-semibold text-sm", selectedPayment === method.code ? color : "text-gray-600")}>
                      {method.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="bg-orange-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Selected items ({selectedItems.size})</span>
                <span>{symbol}{selectedSubtotal.toFixed(2)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({taxRate}%)</span>
                  <span>{symbol}{selectedTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-orange-200 pt-1 mt-1">
                <span>Total</span>
                <span className="text-orange-500">{symbol}{selectedTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Customer Name */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional — type customer name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>

            <Button
              onClick={handleConfirmSplitSettle}
              disabled={!!actionLoading}
              className="w-full h-12 bg-green-600 hover:bg-green-700 gap-2 text-base"
            >
              <CheckCircle2 className="w-5 h-5" />
              {actionLoading === "split-settle" ? "Processing..." : `Settle via ${selectedPayment}`}
            </Button>
          </div>
        </div>
      )}

      {/* Modifier Selection Dialog */}
      {modifierDialogItem && (() => {
        const modGroups = getItemModifierGroups(modifierDialogItem);
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl">
              <div className="p-4 border-b border-gray-100">
                <div className="font-semibold text-gray-900">{modifierDialogItem.name}</div>
                <div className="text-sm text-gray-500">Customise your order</div>
              </div>
              <div className="p-4 space-y-5">
                {modGroups.map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                      {g.required && <span className="text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5 font-medium">Required</span>}
                      {g.multiple && <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">Pick multiple</span>}
                    </div>
                    <div className="space-y-1.5">
                      {g.items.map((opt) => {
                        const selected = (modifierSelections[g.id] ?? []).includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setModifierSelections((prev) => {
                                const current = prev[g.id] ?? [];
                                if (g.multiple) {
                                  return { ...prev, [g.id]: selected ? current.filter((id) => id !== opt.id) : [...current, opt.id] };
                                } else {
                                  return { ...prev, [g.id]: selected ? [] : [opt.id] };
                                }
                              });
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors",
                              selected ? "border-orange-400 bg-orange-50 text-orange-700 font-medium" : "border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            <span>{opt.name}</span>
                            <span className={cn("text-xs", selected ? "text-orange-600 font-semibold" : "text-gray-400")}>
                              {opt.price > 0 ? `+${symbol}${opt.price.toFixed(2)}` : "Free"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => setModifierDialogItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmWithModifiers}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold"
                >
                  Add to Order
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

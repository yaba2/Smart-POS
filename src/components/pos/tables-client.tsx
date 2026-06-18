"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TableStatus } from "@prisma/client";
import { createOrder, mergeOrders } from "@/actions/orders";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, CreditCard, Utensils, Lock, X, Merge, ChevronRight, Scissors } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  price: number;
  notes: string | null;
  menuItem: { name: string };
}

interface TableOrder {
  id: string;
  status: string;
  total: number;
  paidAmount: number;
  orderItems: OrderItem[];
}

interface TableWithOrders {
  id: string;
  name: string;
  floor: string | null;
  status: TableStatus;
  orders: TableOrder[];
}

interface TablesClientProps {
  tables: TableWithOrders[];
  waiterId: string;
  hasOpenShift: boolean;
  openedByName?: string | null;
  canBypassShift?: boolean;
  currencySymbol?: string;
}

const statusConfig = {
  AVAILABLE: {
    label: "Available",
    color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    badge: "success" as const,
    icon: Utensils,
    iconColor: "text-emerald-500",
    dot: "bg-emerald-500",
  },
  OCCUPIED: {
    label: "Occupied",
    color: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    badge: "warning" as const,
    icon: Users,
    iconColor: "text-orange-500",
    dot: "bg-orange-500",
  },
  WAITING_PAYMENT: {
    label: "Waiting Payment",
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    badge: "info" as const,
    icon: CreditCard,
    iconColor: "text-blue-500",
    dot: "bg-blue-500",
  },
};

const orderStatusLabel: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "text-gray-500 bg-gray-100" },
  SENT: { label: "Sent", color: "text-orange-600 bg-orange-100" },
  WAITING_PAYMENT: { label: "Waiting Pay", color: "text-blue-600 bg-blue-100" },
};

export function TablesClient({ tables, waiterId, hasOpenShift, openedByName, canBypassShift, currencySymbol }: TablesClientProps) {
  const router = useRouter();
  const sym = currencySymbol || "$";
  const [loadingTableId, setLoadingTableId] = useState<string | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [activeFloor, setActiveFloor] = useState<string | null>(null); // null = All
  // Multi-order picker modal
  const [pickerTable, setPickerTable] = useState<TableWithOrders | null>(null);

  // Derive unique floor names from tables
  const floors = Array.from(new Set(tables.map((t) => t.floor).filter(Boolean))) as string[];
  const visibleTables = activeFloor ? tables.filter((t) => t.floor === activeFloor) : tables;

  // Auto-refresh every 30 seconds so status updates appear on all screens
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const shiftLocked = !hasOpenShift && !canBypassShift;

  const handleTableClick = async (table: TableWithOrders) => {
    if (shiftLocked) {
      toast({ title: "No open shift. Open a shift first before taking orders.", variant: "destructive" });
      return;
    }

    if (table.status === "AVAILABLE") {
      setLoadingTableId(table.id);
      try {
        const result = await createOrder(table.id, waiterId);
        if (result.success && result.order) {
          router.push(`/pos/order/${result.order.id}`);
        }
      } finally {
        setLoadingTableId(null);
      }
      return;
    }

    // Multiple split orders — show picker modal
    if (table.orders.length > 1) {
      setPickerTable(table);
      return;
    }

    // Single order — navigate directly
    const activeOrder = table.orders[0];
    if (activeOrder) {
      router.push(`/pos/order/${activeOrder.id}`);
    } else {
      setLoadingTableId(table.id);
      try {
        const result = await createOrder(table.id, waiterId);
        if (result.success && result.order) {
          router.push(`/pos/order/${result.order.id}`);
        }
      } finally {
        setLoadingTableId(null);
      }
    }
  };

  const handleMergeAll = async (table: TableWithOrders) => {
    if (table.orders.length < 2) return;
    if (!confirm(`Merge all ${table.orders.length} split orders into one?`)) return;
    setMergeLoading(true);
    try {
      const [target, ...sources] = table.orders;
      for (const src of sources) {
        const result = await mergeOrders(target.id, src.id);
        if ("error" in result) {
          toast({ title: String(result.error), variant: "destructive" });
          return;
        }
      }
      toast({ title: "Orders merged successfully" });
      setPickerTable(null);
      router.refresh();
    } finally {
      setMergeLoading(false);
    }
  };

  const counts = {
    available: visibleTables.filter((t) => t.status === "AVAILABLE").length,
    occupied: visibleTables.filter((t) => t.status === "OCCUPIED").length,
    waiting: visibleTables.filter((t) => t.status === "WAITING_PAYMENT").length,
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Shift locked banner */}
      {shiftLocked && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <Lock className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">POS is locked — no open shift</p>
            <p className="text-xs text-red-500">A cashier must open a shift before orders can be taken.</p>
          </div>
          <Link href="/pos/shift" className="text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-800">
            Open Shift →
          </Link>
        </div>
      )}
      {!shiftLocked && openedByName && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <p className="text-xs text-green-700"><span className="font-semibold">Shift open</span> — opened by <span className="font-semibold">{openedByName}</span></p>
        </div>
      )}

      {/* Floor tabs */}
      {floors.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveFloor(null)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all",
              activeFloor === null
                ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600"
            )}
          >
            All
          </button>
          {floors.map((floor) => (
            <button
              key={floor}
              onClick={() => setActiveFloor(floor)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all",
                activeFloor === floor
                  ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600"
              )}
            >
              {floor}
            </button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{counts.available}</div>
          <div className="text-xs text-gray-500 mt-0.5">Available</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{counts.occupied}</div>
          <div className="text-xs text-gray-500 mt-0.5">Occupied</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{counts.waiting}</div>
          <div className="text-xs text-gray-500 mt-0.5">Waiting Payment</div>
        </div>
      </div>

      {/* Tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {visibleTables.map((table) => {
          const config = statusConfig[table.status];
          const StatusIcon = config.icon;
          const isLoading = loadingTableId === table.id;
          const totalAll = table.orders.reduce((s, o) => s + o.total, 0);
          const hasSplits = table.orders.length > 1;

          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              disabled={isLoading}
              className={cn(
                "relative flex flex-col items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 active:scale-95 min-h-[130px]",
                config.color,
                isLoading && "opacity-60 cursor-wait"
              )}
            >
              {/* Status dot */}
              <div className="absolute top-3 right-3">
                <div className={cn("w-2.5 h-2.5 rounded-full", config.dot)} />
              </div>

              {/* Split indicator badge */}
              {hasSplits && (
                <div className="absolute top-2 left-2">
                  <span className="flex items-center gap-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    <Scissors className="w-2.5 h-2.5" />
                    {table.orders.length}
                  </span>
                </div>
              )}

              {/* Icon */}
              <div className={cn("mt-1", config.iconColor)}>
                {isLoading ? (
                  <RefreshCw className="w-7 h-7 animate-spin text-gray-400" />
                ) : (
                  <StatusIcon className="w-7 h-7" />
                )}
              </div>

              {/* Table name */}
              <div className="text-center">
                <div className="font-bold text-gray-800 text-sm leading-tight">{table.name}</div>
                <Badge variant={config.badge} className="mt-1.5 text-[10px] px-2 py-0">
                  {config.label}
                </Badge>
              </div>

              {/* Total */}
              {totalAll > 0 && (
                <div className="text-xs font-semibold text-gray-600">
                  {sym}{totalAll.toFixed(2)}
                  {hasSplits && <span className="text-purple-600 ml-1">({table.orders.length} bills)</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {visibleTables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Utensils className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">No tables found</p>
          <p className="text-sm">Ask an admin to add tables</p>
        </div>
      )}

      {/* Multi-order picker modal */}
      {pickerTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">{pickerTable.name} — Split Bills</h3>
                <p className="text-xs text-gray-400 mt-0.5">{pickerTable.orders.length} separate bills on this table</p>
              </div>
              <button onClick={() => setPickerTable(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-2 max-h-[60vh] overflow-y-auto">
              {pickerTable.orders.map((order, idx) => {
                const statusInfo = orderStatusLabel[order.status] || { label: order.status, color: "text-gray-500 bg-gray-100" };
                const remaining = order.total - (order.paidAmount || 0);
                return (
                  <button
                    key={order.id}
                    onClick={() => { setPickerTable(null); router.push(`/pos/order/${order.id}`); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">Bill #{idx + 1}</span>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">
                        {order.orderItems.length} item(s): {order.orderItems.slice(0, 3).map(i => `${i.menuItem.name}×${i.quantity}`).join(", ")}
                        {order.orderItems.length > 3 && "..."}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-orange-600">{sym}{order.total.toFixed(2)}</div>
                      {order.paidAmount > 0 && (
                        <div className="text-[10px] text-green-600">Paid: {sym}{order.paidAmount.toFixed(2)}</div>
                      )}
                      {remaining > 0 && order.paidAmount > 0 && (
                        <div className="text-[10px] text-red-500">Due: {sym}{remaining.toFixed(2)}</div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                );
              })}
            </div>

            <div className="px-4 pb-5 pt-3 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => handleMergeAll(pickerTable)}
                disabled={mergeLoading}
                className="w-full gap-2 text-purple-700 border-purple-200 hover:bg-purple-50"
              >
                <Merge className="w-4 h-4" />
                {mergeLoading ? "Merging..." : "Merge All into One Bill"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

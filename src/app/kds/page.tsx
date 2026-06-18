"use client";

import { useState, useEffect } from "react";
import { useKdsOrders, KdsOrder } from "@/hooks/useKdsOrders";
import { RefreshCw, Utensils, GlassWater, Clock, CheckCircle2, RotateCcw, Wifi, WifiOff } from "lucide-react";

// ── Elapsed timer ──────────────────────────────────────────────────────────────
function useElapsed(sentAt: string | null, createdAt: string) {
  const start = sentAt ?? createdAt;
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(start).getTime()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(start).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [start]);

  return elapsed;
}

function ElapsedBadge({ sentAt, createdAt }: { sentAt: string | null; createdAt: string }) {
  const sec = useElapsed(sentAt, createdAt);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  const isWarning = sec >= 300; // 5 min
  const isDanger = sec >= 600;  // 10 min

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
        isDanger
          ? "bg-red-600 text-white animate-pulse"
          : isWarning
          ? "bg-yellow-400 text-yellow-900"
          : "bg-green-100 text-green-800"
      }`}
    >
      <Clock className="w-3 h-3" />
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

// ── Order card ─────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onBump,
  onRecall,
  bumping,
}: {
  order: KdsOrder;
  onBump: (id: string) => void;
  onRecall: (id: string) => void;
  bumping: boolean;
}) {
  const isReady = order.status === "WAITING_PAYMENT";

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 shadow-md transition-all ${
        isReady
          ? "border-green-400 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* Card Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-t-2xl ${
          isReady ? "bg-green-500" : "bg-gray-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-xl leading-none">
            {order.table.name}
          </span>
          {isReady && (
            <span className="bg-white text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ElapsedBadge sentAt={order.sentAt} createdAt={order.createdAt} />
          <span className="text-gray-300 text-xs">{order.waiter.name}</span>
        </div>
      </div>

      {/* Order Items */}
      <div className="flex-1 p-3 space-y-1.5 min-h-[120px]">
        {order.orderItems.map((oi) => (
          <div key={oi.id} className="flex items-start gap-2">
            <span
              className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center text-xs font-black shrink-0 ${
                isReady
                  ? "bg-green-200 text-green-800"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              {oi.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight">
                {oi.menuItem.name}
              </p>
              {oi.options && (() => {
                try {
                  const parsed = JSON.parse(oi.options);
                  return (
                    <p className="text-xs text-gray-500">
                      {Object.entries(parsed)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  );
                } catch { return null; }
              })()}
              {oi.notes && (
                <p className="text-xs text-amber-600 font-medium mt-0.5">
                  ⚠ {oi.notes}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Order-level notes */}
        {order.notes && (
          <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 font-medium">Note: {order.notes}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-3 pt-0 space-y-2">
        {!isReady ? (
          <button
            onClick={() => onBump(order.id)}
            disabled={bumping}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {bumping ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {bumping ? "Updating…" : "Mark Ready"}
          </button>
        ) : (
          <button
            onClick={() => onRecall(order.id)}
            disabled={bumping}
            className="w-full py-3 rounded-xl bg-gray-200 hover:bg-gray-300 active:scale-95 text-gray-700 font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {bumping ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <RotateCcw className="w-5 h-5" />
            )}
            {bumping ? "Updating…" : "Recall"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main KDS Page ──────────────────────────────────────────────────────────────
type Station = "KITCHEN" | "BAR" | "ALL";

export default function KdsPage() {
  const [station, setStation] = useState<Station>("KITCHEN");
  const { orders, loading, error, bumping, bumpOrder, refresh } = useKdsOrders(station);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Track last refresh time
  useEffect(() => {
    setLastRefresh(new Date());
  }, [orders]);

  const handleBump = (orderId: string) => bumpOrder(orderId, "bump");
  const handleRecall = (orderId: string) => bumpOrder(orderId, "recall");

  const activeOrders = orders.filter((o) => o.status === "SENT");
  const readyOrders = orders.filter((o) => o.status === "WAITING_PAYMENT");

  const STATIONS: { key: Station; label: string; icon: React.ReactNode }[] = [
    { key: "KITCHEN", label: "Kitchen", icon: <Utensils className="w-4 h-4" /> },
    { key: "BAR",     label: "Bar",     icon: <GlassWater className="w-4 h-4" /> },
    { key: "ALL",     label: "All",     icon: <RefreshCw className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black tracking-tight text-orange-400">KDS</span>
          <span className="text-gray-400 text-sm hidden sm:block">Kitchen Display System</span>
        </div>

        {/* Station toggle */}
        <div className="flex items-center bg-gray-800 rounded-xl p-1 gap-1">
          {STATIONS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setStation(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                station === key
                  ? "bg-orange-500 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Status & refresh */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">
            {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          {error ? (
            <WifiOff className="w-4 h-4 text-red-400" />
          ) : (
            <Wifi className="w-4 h-4 text-green-400" />
          )}
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-400" : "text-gray-400"}`} />
          </button>
          {/* Counters */}
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
              {activeOrders.length} active
            </span>
            {readyOrders.length > 0 && (
              <span className="bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">
                {readyOrders.length} ready
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900 border-b border-red-700 px-4 py-2 text-sm text-red-200 flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          Connection error: {error} — retrying automatically…
        </div>
      )}

      {/* Main grid */}
      <main className="flex-1 p-4 overflow-auto">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-32 gap-4 text-gray-500">
            <RefreshCw className="w-10 h-10 animate-spin text-orange-400" />
            <p>Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-32 gap-3 text-gray-600">
            <CheckCircle2 className="w-16 h-16 text-green-600 opacity-40" />
            <p className="text-xl font-semibold">All clear!</p>
            <p className="text-sm">No active orders for this station.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active orders section */}
            {activeOrders.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-3 px-1">
                  Cooking · {activeOrders.length}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onBump={handleBump}
                      onRecall={handleRecall}
                      bumping={bumping === order.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Ready orders section */}
            {readyOrders.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3 px-1">
                  Ready for Pickup · {readyOrders.length}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {readyOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onBump={handleBump}
                      onRecall={handleRecall}
                      bumping={bumping === order.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

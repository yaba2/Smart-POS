"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface KdsCategory {
  id: string;
  name: string;
  printer: string | null;
}

export interface KdsMenuItem {
  id: string;
  name: string;
  category: KdsCategory;
}

export interface KdsOrderItem {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  options: string | null;
  menuItem: KdsMenuItem;
}

export interface KdsOrder {
  id: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  notes: string | null;
  table: { id: string; name: string };
  waiter: { id: string; name: string };
  orderItems: KdsOrderItem[];
}

const POLL_INTERVAL_MS = 6000; // 6 seconds

export function useKdsOrders(station: string) {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bumping, setBumping] = useState<string | null>(null); // orderId being bumped
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/orders/kds?station=${encodeURIComponent(station)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: KdsOrder[] = await res.json();
      setOrders(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [station]);

  // Initial fetch + start polling
  useEffect(() => {
    fetchOrders(true);
    timerRef.current = setInterval(() => fetchOrders(false), POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchOrders]);

  const bumpOrder = useCallback(async (orderId: string, action: "bump" | "recall") => {
    setBumping(orderId);
    try {
      const res = await fetch("/api/orders/kds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Update failed");
      }
      // Immediately refresh after bump
      await fetchOrders(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBumping(null);
    }
  }, [fetchOrders]);

  return { orders, loading, error, bumping, bumpOrder, refresh: () => fetchOrders(false) };
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  generateKitchenTicket,
  generateBarTicket,
  generateReceipt,
  generateTestPrint,
  type KitchenTicketData,
  type BarTicketData,
  type ReceiptData,
} from "@/lib/escpos";

export type PrinterDestination = "KITCHEN" | "BAR" | "BILL";

export interface PrintJob {
  id: string;
  destination: PrinterDestination;
  status: "pending" | "printing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: number;
}

interface PrinterConfig {
  destination: PrinterDestination;
  name: string;
  configured: boolean;
}

interface UsePrinterOptions {
  printServerIp?: string;
  printServerPort?: number;
  autoConnect?: boolean;
  onStatusChange?: (status: PrinterStatus) => void;
  onJobUpdate?: (jobs: PrintJob[]) => void;
}

export type PrinterStatus = 
  | "disconnected" 
  | "connecting" 
  | "connected" 
  | "error";

interface UsePrinterReturn {
  // Connection state
  status: PrinterStatus;
  isConnected: boolean;
  error: string | null;
  
  // Actions
  connect: (ip?: string) => void;
  disconnect: () => void;
  reconnect: () => void;
  
  // Printing
  printKitchen: (data: KitchenTicketData) => Promise<string>;
  printBar: (data: BarTicketData) => Promise<string>;
  printReceipt: (data: ReceiptData) => Promise<string>;
  testPrint: (destination: PrinterDestination) => Promise<string>;
  retryJob: (jobId: string) => void;
  
  // Queue management
  printQueue: PrintJob[];
  pendingJobs: PrintJob[];
  failedJobs: PrintJob[];
  clearCompleted: () => void;
  
  // Printer info
  printers: PrinterConfig[];
  detectPrinters: () => void;
}

/**
 * React hook for managing printer connections and printing
 * Connects to the Windows print server via WebSocket
 */
export function usePrinter(options: UsePrinterOptions = {}): UsePrinterReturn {
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const {
    printServerIp = typeof window !== "undefined" ? window.location.hostname : "localhost",
    printServerPort = isHttps ? 9091 : 9090,
    autoConnect = true,
    onStatusChange,
    onJobUpdate,
  } = options;

  // State
  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([
    { destination: "KITCHEN", name: "Kitchen Printer", configured: false },
    { destination: "BAR", name: "Bar Printer", configured: false },
    { destination: "BILL", name: "Bill Printer", configured: false },
  ]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const currentIpRef = useRef(printServerIp);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  const onJobUpdateRef = useRef(onJobUpdate);
  onStatusChangeRef.current = onStatusChange;
  onJobUpdateRef.current = onJobUpdate;

  // Computed
  const isConnected = status === "connected";
  const pendingJobs = printQueue.filter(j => j.status === "pending" || j.status === "printing");
  const failedJobs = printQueue.filter(j => j.status === "failed");

  // Update status callback — use ref to avoid firing on every render
  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  // Update queue callback — use ref to avoid firing on every render
  useEffect(() => {
    onJobUpdateRef.current?.(printQueue);
  }, [printQueue]);

  /**
   * Connect to print server
   */
  const connect = useCallback((ip?: string) => {
    const targetIp = ip || currentIpRef.current;
    currentIpRef.current = targetIp;
    intentionalDisconnectRef.current = false;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect on manual close
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("connecting");
    setError(null);

    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${targetIp}:${printServerPort}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Printer] Connected to print server");
        setStatus("connected");
        setError(null);

        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "get_queue" }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error("[Printer] Failed to parse message:", event.data);
        }
      };

      ws.onclose = () => {
        if (intentionalDisconnectRef.current) return; // don't reconnect if we closed on purpose
        console.log("[Printer] Disconnected — reconnecting in 5s…");
        setStatus("disconnected");
        wsRef.current = null;

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Auto-reconnect after 5 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!intentionalDisconnectRef.current) connect();
        }, 5000);
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so just log — don't set error state here
        console.warn("[Printer] WebSocket error — print server may not be running");
      };
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [printServerPort]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case "connected":
        // Update printer configuration from server
        if (message.printers) {
          setPrinters(message.printers);
        }
        break;

      case "print_queued":
        addJobToQueue(message.jobId, message.destination);
        break;

      case "print_completed":
        updateJobStatus(message.jobId, "completed");
        break;

      case "print_failed":
        updateJobStatus(message.jobId, "failed", message.error);
        break;

      case "queue_status":
        // Sync queue status from server
        if (message.queue) {
          setPrintQueue(prev => {
            const existing = new Map(prev.map(j => [j.id, j]));
            message.queue.forEach((serverJob: any) => {
              if (existing.has(serverJob.id)) {
                existing.set(serverJob.id, {
                  ...existing.get(serverJob.id)!,
                  status: serverJob.status,
                  attempts: serverJob.attempts,
                  error: serverJob.error,
                });
              }
            });
            return Array.from(existing.values());
          });
        }
        break;

      case "printers_detected":
        // Update printer list with detected devices
        if (message.config) {
          setPrinters([
            { destination: "KITCHEN", name: message.config.KITCHEN?.name || "Kitchen Printer", configured: !!message.config.KITCHEN?.vendorId },
            { destination: "BAR", name: message.config.BAR?.name || "Bar Printer", configured: !!message.config.BAR?.vendorId },
            { destination: "BILL", name: message.config.BILL?.name || "Bill Printer", configured: !!message.config.BILL?.vendorId },
          ]);
        }
        break;

      case "error":
        setError(message.message);
        break;
    }
  }, []);

  /**
   * Add job to local queue
   */
  const addJobToQueue = useCallback((jobId: string, destination: PrinterDestination) => {
    const job: PrintJob = {
      id: jobId,
      destination,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    };
    setPrintQueue(prev => [...prev, job]);
  }, []);

  /**
   * Update job status in queue
   */
  const updateJobStatus = useCallback((jobId: string, status: PrintJob["status"], error?: string) => {
    setPrintQueue(prev =>
      prev.map(job =>
        job.id === jobId
          ? { ...job, status, error: error || job.error }
          : job
      )
    );
  }, []);

  /**
   * Disconnect from print server
   */
  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  /**
   * Reconnect to print server
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 100);
  }, [disconnect, connect]);

  /**
   * Send print job to server
   */
  const sendPrintJob = useCallback((
    destination: PrinterDestination,
    commands: string,
    customJobId?: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected to print server"));
        return;
      }

      const jobId = customJobId || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      wsRef.current.send(JSON.stringify({
        type: "print",
        jobId,
        destination,
        commands,
      }));

      resolve(jobId);
    });
  }, []);

  /**
   * Print kitchen ticket
   */
  const printKitchen = useCallback(async (data: KitchenTicketData): Promise<string> => {
    const commands = generateKitchenTicket(data);
    return sendPrintJob("KITCHEN", commands);
  }, [sendPrintJob]);

  /**
   * Print bar ticket
   */
  const printBar = useCallback(async (data: BarTicketData): Promise<string> => {
    const commands = generateBarTicket(data);
    return sendPrintJob("BAR", commands);
  }, [sendPrintJob]);

  /**
   * Print customer receipt
   */
  const printReceipt = useCallback(async (data: ReceiptData): Promise<string> => {
    const commands = generateReceipt(data);
    return sendPrintJob("BILL", commands);
  }, [sendPrintJob]);

  /**
   * Send test print
   */
  const testPrint = useCallback(async (destination: PrinterDestination): Promise<string> => {
    const commands = generateTestPrint(destination);
    return sendPrintJob(destination, commands, `test-${Date.now()}`);
  }, [sendPrintJob]);

  /**
   * Retry failed job
   */
  const retryJob = useCallback((jobId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: "retry",
      jobId,
    }));

    // Optimistically update status
    updateJobStatus(jobId, "pending");
  }, [updateJobStatus]);

  /**
   * Clear completed jobs from queue
   */
  const clearCompleted = useCallback(() => {
    setPrintQueue(prev => prev.filter(j => j.status !== "completed"));
  }, []);

  /**
   * Request printer detection
   */
  const detectPrinters = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "detect_printers" }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    status,
    isConnected,
    error,
    connect,
    disconnect,
    reconnect,
    printKitchen,
    printBar,
    printReceipt,
    testPrint,
    retryJob,
    printQueue,
    pendingJobs,
    failedJobs,
    clearCompleted,
    printers,
    detectPrinters,
  };
}

/**
 * Hook for auto-printing based on order status changes
 */
export function useAutoPrint(
  orderItems: Array<{
    id: string;
    menuItem: { name: string; category: { printer?: string } };
    quantity: number;
    notes?: string;
    options?: Record<string, string>;
  }>,
  orderDetails: {
    orderId: string;
    tableName: string;
    waiterName: string;
    status: string;
  },
  printer: UsePrinterReturn,
  options?: {
    enabled?: boolean;
    onPrintStart?: (destination: PrinterDestination) => void;
    onPrintComplete?: (destination: PrinterDestination, jobId: string) => void;
    onPrintError?: (destination: PrinterDestination, error: string) => void;
  }
) {
  const { enabled = true, onPrintStart, onPrintComplete, onPrintError } = options || {};
  const printedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || orderDetails.status !== "SENT") return;
    if (!printer.isConnected) return;

    // Prevent duplicate prints for same order
    if (printedRef.current.has(orderDetails.orderId)) return;

    // Group items by printer destination
    const kitchenItems = orderItems.filter(
      item => item.menuItem.category?.printer === "KITCHEN"
    );
    const barItems = orderItems.filter(
      item => item.menuItem.category?.printer === "BAR"
    );

    // Print kitchen tickets
    if (kitchenItems.length > 0) {
      onPrintStart?.("KITCHEN");
      printer
        .printKitchen({
          orderId: orderDetails.orderId,
          tableName: orderDetails.tableName,
          waiterName: orderDetails.waiterName,
          category: "KITCHEN",
          items: kitchenItems.map(item => ({
            name: item.menuItem.name,
            quantity: item.quantity,
            notes: item.notes,
            modifiers: item.options ? Object.values(item.options) : undefined,
          })),
          timestamp: new Date(),
        })
        .then((jobId) => {
          onPrintComplete?.("KITCHEN", jobId);
        })
        .catch((err) => {
          onPrintError?.("KITCHEN", err.message);
        });
    }

    // Print bar tickets
    if (barItems.length > 0) {
      onPrintStart?.("BAR");
      printer
        .printBar({
          orderId: orderDetails.orderId,
          tableName: orderDetails.tableName,
          waiterName: orderDetails.waiterName,
          category: "BAR",
          items: barItems.map(item => ({
            name: item.menuItem.name,
            quantity: item.quantity,
            notes: item.notes,
            modifiers: item.options ? Object.values(item.options) : undefined,
          })),
          timestamp: new Date(),
        })
        .then((jobId) => {
          onPrintComplete?.("BAR", jobId);
        })
        .catch((err) => {
          onPrintError?.("BAR", err.message);
        });
    }

    // Mark as printed
    printedRef.current.add(orderDetails.orderId);
  }, [orderDetails.status, orderItems, printer, enabled, orderDetails.orderId, orderDetails.tableName, orderDetails.waiterName, onPrintStart, onPrintComplete, onPrintError]);

  return {
    hasPrinted: printedRef.current.has(orderDetails.orderId),
    resetPrintHistory: () => printedRef.current.clear(),
  };
}

"use client";

import { useState } from "react";
import { Printer, Wifi, WifiOff, AlertCircle, CheckCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrinter, type PrintJob, type PrinterDestination } from "@/hooks/use-printer";

interface PrinterStatusProps {
  printServerIp?: string;
  onConnectionChange?: (connected: boolean) => void;
}

export function PrinterStatusPanel({ printServerIp, onConnectionChange }: PrinterStatusProps) {
  const [showDetails, setShowDetails] = useState(false);
  const printer = usePrinter({
    printServerIp,
    onStatusChange: (status) => {
      onConnectionChange?.(status === "connected");
    },
  });

  const { status, isConnected, error, printQueue, failedJobs, printers, reconnect, retryJob, clearCompleted, testPrint } = printer;

  return (
    <>
      {/* Status Bar */}
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border rounded-lg">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm font-medium ${isConnected ? "text-green-600" : "text-red-600"}`}>
            {isConnected ? "Printers Online" : "Printers Offline"}
          </span>
        </div>

        <div className="h-4 w-px bg-gray-300" />

        {/* Printer indicators */}
        <div className="flex items-center gap-2">
          {printers.map((p) => (
            <div
              key={p.destination}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                p.configured
                  ? isConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                  : "bg-red-100 text-red-700"
              }`}
            >
              <Printer className="w-3 h-3" />
              {p.destination}
              {!p.configured && <span className="text-[10px]">(not set)</span>}
            </div>
          ))}
        </div>

        {/* Failed jobs alert */}
        {failedJobs.length > 0 && (
          <>
            <div className="h-4 w-px bg-gray-300" />
            <button
              onClick={() => setShowDetails(true)}
              className="flex items-center gap-1 text-xs text-red-600 hover:underline"
            >
              <AlertCircle className="w-3 h-3" />
              {failedJobs.length} failed
            </button>
          </>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          {!isConnected && (
            <Button size="sm" variant="outline" onClick={reconnect} className="h-7 text-xs">
              <RotateCw className="w-3 h-3 mr-1" />
              Reconnect
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowDetails(true)} className="h-7 text-xs">
            Details
          </Button>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Printer Status
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Print Server</span>
              <span className={`text-sm ${isConnected ? "text-green-600" : "text-red-600"}`}>
                {status === "connecting" ? "Connecting..." : isConnected ? "Connected" : error || "Disconnected"}
              </span>
            </div>

            {/* Printer List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Configured Printers</h4>
              {printers.map((p) => (
                <div key={p.destination} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-xs text-gray-500 block">{p.destination}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.configured ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    {isConnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => testPrint(p.destination)}
                      >
                        Test
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Failed Jobs */}
            {failedJobs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-red-700">
                    Failed Prints ({failedJobs.length})
                  </h4>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={clearCompleted}>
                    Clear Completed
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {failedJobs.map((job) => (
                    <FailedJobItem key={job.id} job={job} onRetry={() => retryJob(job.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* Print Queue Stats */}
            {printQueue.length > 0 && (
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm">
                <span>Queue Status</span>
                <span className="font-medium">
                  {printQueue.filter((j) => j.status === "pending").length} pending
                  {printQueue.filter((j) => j.status === "completed").length > 0 &&
                    ` • ${printQueue.filter((j) => j.status === "completed").length} completed`}
                </span>
              </div>
            )}

            {/* Connection Settings */}
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500">
                Print Server: ws://{printServerIp || "localhost"}:9100
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FailedJobItem({ job, onRetry }: { job: PrintJob; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between p-2 bg-red-50 border border-red-100 rounded">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Printer className="w-3 h-3 text-red-500" />
          <span className="text-sm font-medium">{job.destination}</span>
          <span className="text-xs text-gray-500">Attempt {job.attempts}/{job.maxAttempts}</span>
        </div>
        {job.error && (
          <p className="text-xs text-red-600 truncate">{job.error}</p>
        )}
      </div>
      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={onRetry}>
        <RotateCw className="w-3 h-3 mr-1" />
        Retry
      </Button>
    </div>
  );
}

// ==================== PRINT CONFIRMATION DIALOG ====================

interface PrintConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  kitchenItems: Array<{ name: string; quantity: number }>;
  barItems: Array<{ name: string; quantity: number }>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PrintConfirmationDialog({
  isOpen,
  onClose,
  kitchenItems,
  barItems,
  onConfirm,
  onCancel,
}: PrintConfirmationProps) {
  const hasKitchen = kitchenItems.length > 0;
  const hasBar = barItems.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Send to Kitchen/Bar?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            This will print tickets to the kitchen and bar printers.
          </p>

          {hasKitchen && (
            <div className="p-3 bg-orange-50 rounded-lg">
              <h4 className="text-sm font-medium text-orange-800 mb-2">
                Kitchen ({kitchenItems.length} items)
              </h4>
              <ul className="text-xs text-orange-700 space-y-1">
                {kitchenItems.slice(0, 4).map((item, i) => (
                  <li key={i}>
                    {item.quantity}x {item.name}
                  </li>
                ))}
                {kitchenItems.length > 4 && (
                  <li className="italic">+{kitchenItems.length - 4} more...</li>
                )}
              </ul>
            </div>
          )}

          {hasBar && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                Bar ({barItems.length} items)
              </h4>
              <ul className="text-xs text-blue-700 space-y-1">
                {barItems.slice(0, 4).map((item, i) => (
                  <li key={i}>
                    {item.quantity}x {item.name}
                  </li>
                ))}
                {barItems.length > 4 && (
                  <li className="italic">+{barItems.length - 4} more...</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={onConfirm}>
              <Printer className="w-4 h-4 mr-2" />
              Print & Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

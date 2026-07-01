"use client";

import { useState } from "react";
import { updateRoomServiceStatus, deleteRoomService } from "@/actions/hotel/room-services";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, ChefHat, Truck, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const STATUS_ICONS: Record<string, any> = {
  ORDERED: Clock,
  PREPARING: ChefHat,
  IN_TRANSIT: Truck,
  DELIVERED: CheckCircle,
};

const STATUS_COLORS: Record<string, string> = {
  ORDERED: "bg-orange-100 text-orange-800",
  PREPARING: "bg-yellow-100 text-yellow-800",
  IN_TRANSIT: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-green-100 text-green-800",
};

interface RoomServicesClientProps {
  services: any[];
  canManage: boolean;
}

export function RoomServicesClient({ services: initialServices, canManage }: RoomServicesClientProps) {
  const [services, setServices] = useState<any[]>(initialServices);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const handleStatusChange = async (id: string, status: string) => {
    const result = await updateRoomServiceStatus(id, status as any);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else setServices((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ open: true, id });
  };

  const doDelete = async (id: string) => {
    setConfirmDialog(null);
    const result = await deleteRoomService(id);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else { toast({ title: "Order deleted", variant: "success" }); setServices((prev) => prev.filter((s) => s.id !== id)); }
  };

  const filteredServices = statusFilter === "ALL" ? services : services.filter((s) => s.status === statusFilter);
  const sortedServices = [...filteredServices].sort((a, b) => b.priority - a.priority || new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {Object.keys(STATUS_ICONS).map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedServices.map((s) => {
          const Icon = STATUS_ICONS[s.status] || Clock;
          const items = Array.isArray(s.orderItems) ? s.orderItems : [];
          const isOverdue = s.deadline && new Date(s.deadline) < new Date() && s.status !== "DELIVERED";
          return (
            <div key={s.id} className={`border rounded-lg p-4 bg-white ${isOverdue ? "border-red-400 ring-1 ring-red-200" : ""}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">Room {s.room?.number}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-xs text-gray-500">{s.stay?.guest?.fullName} · Priority {s.priority}</p>
                </div>
                <Icon className="w-5 h-5 text-gray-500" />
              </div>
              <div className="mt-3 space-y-1">
                {items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.quantity || 1}x {item.name}</span>
                    <span>${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-sm pt-1 border-t"><span>Total</span><span>${s.total.toFixed(2)}</span></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Ordered {new Date(s.orderedAt).toLocaleTimeString()}</p>
              {s.deadline && <p className={`text-xs mt-1 ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>Deadline: {new Date(s.deadline).toLocaleString()}</p>}
              {canManage && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <Select value={s.status} onValueChange={(v) => handleStatusChange(s.id, v)}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATUS_ICONS).map((st) => <SelectItem key={st} value={st}>{st.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title="Delete room service order?"
          description="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => doDelete(confirmDialog.id)}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

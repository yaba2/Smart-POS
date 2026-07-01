"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRoomStatus, deleteRoom, createRoom, updateRoom } from "@/actions/hotel/rooms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Bed, Sparkles, Wrench, Ban, CalendarCheck } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 border-green-300 text-green-800",
  OCCUPIED: "bg-blue-100 border-blue-300 text-blue-800",
  DIRTY: "bg-yellow-100 border-yellow-300 text-yellow-800",
  MAINTENANCE: "bg-red-100 border-red-300 text-red-800",
  OUT_OF_SERVICE: "bg-gray-100 border-gray-300 text-gray-800",
};

interface RoomsClientProps {
  rooms: any[];
  canManage: boolean;
}

export function RoomsClient({ rooms: initialRooms, canManage }: RoomsClientProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>(initialRooms);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: string } | null>(null);
  const [view, setView] = useState<"floor" | "list">("floor");
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [form, setForm] = useState({
    number: "", floor: "1", type: "STANDARD", basePrice: "", dynamicPrice: "", status: "AVAILABLE", notes: "", active: "true",
  });

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);

  const resetForm = () => {
    setForm({ number: "", floor: "1", type: "STANDARD", basePrice: "", dynamicPrice: "", status: "AVAILABLE", notes: "", active: "true" });
    setEditingRoom(null);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (r: any) => {
    setEditingRoom(r);
    setForm({
      number: r.number, floor: String(r.floor), type: r.type, basePrice: String(r.basePrice),
      dynamicPrice: String(r.dynamicPrice), status: r.status, notes: r.notes || "", active: String(r.active),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.set(k, v));
    const result = editingRoom
      ? await updateRoom(editingRoom.id, data)
      : await createRoom(data);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: editingRoom ? "Room updated" : "Room added", variant: "success" });
      setShowModal(false);
      resetForm();
      setRooms((prev) => editingRoom
        ? prev.map((r) => r.id === editingRoom.id ? result.room : r)
        : [...prev, result.room]);
    }
  };

  const handleStatus = async (id: string, status: string) => {
    const result = await updateRoomStatus(id, status as any);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else setRooms((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ open: true, id });
  };

  const doDelete = async (id: string) => {
    setConfirmDialog(null);
    const result = await deleteRoom(id);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else { toast({ title: "Room deleted", variant: "success" }); setRooms((prev) => prev.filter((r) => r.id !== id)); }
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || "bg-gray-100"}`}>
      {status.replace("_", " ")}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex gap-2">
          <Button variant={view === "floor" ? "default" : "outline"} onClick={() => setView("floor")}>Floor Map</Button>
          <Button variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>List</Button>
        </div>
        {canManage && <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600"><Plus className="w-4 h-4 mr-1" /> Add Room</Button>}
      </div>

      {view === "floor" ? (
        <div className="space-y-6">
          {floors.map((floor) => (
            <div key={floor}>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Floor {floor}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {rooms.filter((r) => r.floor === floor).map((room) => (
                  <Card key={room.id} className={`border-2 cursor-pointer hover:shadow-md transition-shadow ${STATUS_COLORS[room.status]}`}>
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-base">{room.number}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[room.status]}`}>{room.status === "OUT_OF_SERVICE" ? "OOS" : room.status.replace("_", " ").slice(0, 4)}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 mt-1 truncate">{room.type}</p>
                      <p className="text-xs font-bold mt-0.5">${room.dynamicPrice}</p>
                      {room.stays?.[0]?.guest && <p className="text-xs font-semibold italic truncate mt-1">{room.stays[0].guest.fullName}</p>}
                      {canManage && (
                        <div className="flex items-center justify-between mt-2 gap-1">
                          <div className="flex gap-1">
                            {room.status === "DIRTY" && <button title="Mark Clean" className="text-yellow-700 hover:text-yellow-900" onClick={() => handleStatus(room.id, "AVAILABLE")}><Sparkles className="w-4 h-4" /></button>}
                            {room.status === "AVAILABLE" && <button title="Maintenance" className="text-gray-500 hover:text-gray-700" onClick={() => handleStatus(room.id, "MAINTENANCE")}><Wrench className="w-4 h-4" /></button>}
                            {room.status === "MAINTENANCE" && <button title="Mark Ready" className="text-blue-600 hover:text-blue-800" onClick={() => handleStatus(room.id, "AVAILABLE")}><Bed className="w-4 h-4" /></button>}
                            <button title="Edit" className="text-gray-400 hover:text-gray-700" onClick={() => openEdit(room)}><Pencil className="w-4 h-4" /></button>
                            <button title="Delete" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(room.id)}><Ban className="w-4 h-4" /></button>
                          </div>
                          {room.status === "AVAILABLE" && (
                            <button
                              title="Book this room"
                              onClick={() => router.push(`/admin/hotel/stays?roomId=${room.id}`)}
                              className="flex items-center gap-1 text-xs font-bold bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                            >
                              <CalendarCheck className="w-3.5 h-3.5" /> Book
                            </button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left">Number</th><th className="px-3 py-2 text-left">Floor</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Price</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Actions</th></tr></thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-t"><td className="px-3 py-2 font-medium">{room.number}</td><td className="px-3 py-2">{room.floor}</td><td className="px-3 py-2">{room.type}</td><td className="px-3 py-2">${room.dynamicPrice}</td><td className="px-3 py-2"><StatusBadge status={room.status} /></td><td className="px-3 py-2 flex gap-2">
                  {canManage && <><Button size="sm" variant="ghost" onClick={() => openEdit(room)}><Pencil className="w-4 h-4" /></Button><Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(room.id)}><Trash2 className="w-4 h-4" /></Button></>}
                </td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRoom ? "Edit Room" : "Add Room"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>Number</Label><Input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Floor</Label><Input type="number" required value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
              <div><Label>Type</Label><Input required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Base Price</Label><Input type="number" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} /></div>
              <div><Label>Dynamic Price</Label><Input type="number" required value={form.dynamicPrice} onChange={(e) => setForm({ ...form, dynamicPrice: e.target.value })} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(STATUS_COLORS).map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title="Delete this room?"
          description="This will permanently delete the room and all associated data."
          confirmLabel="Delete"
          onConfirm={() => doDelete(confirmDialog.id)}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

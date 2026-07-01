"use client";

import { useState } from "react";
import { createStay, checkInStay, checkOutStay, cancelStay, deleteStay } from "@/actions/hotel/stays";
import { createGuest } from "@/actions/hotel/guests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, LogIn, LogOut, Ban, Trash2, Search, Key, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const STAY_STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-purple-100 text-purple-800",
  CHECKED_IN: "bg-green-100 text-green-800",
  CHECKED_OUT: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

interface StaysClientProps {
  stays: any[];
  rooms: any[];
  guests: any[];
  canManage: boolean;
  defaultRoomId?: string;
}

export function StaysClient({ stays: initialStays, rooms, guests: initialGuests, canManage, defaultRoomId }: StaysClientProps) {
  const [stays, setStays] = useState<any[]>(initialStays);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void } | null>(null);
  const [guests, setGuests] = useState<any[]>(initialGuests);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(!!defaultRoomId);
  const [form, setForm] = useState({
    roomId: defaultRoomId || "", guestId: "", bookingSource: "WALK_IN", scheduledCheckIn: "", scheduledCheckOut: "", notes: "",
  });
  const [keyPayload, setKeyPayload] = useState<any>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestForm, setGuestForm] = useState({ fullName: "", phone: "", email: "", idNumber: "", idType: "", vipTier: "STANDARD", notes: "" });
  const [checkoutModal, setCheckoutModal] = useState<{ stayId: string; guestName: string; roomNumber: string; checkInDate: string } | null>(null);
  const [checkoutDate, setCheckoutDate] = useState("");

  const availableRooms = rooms.filter((r) => r.status === "AVAILABLE");

  const resetForm = () => {
    setForm({ roomId: "", guestId: "", bookingSource: "WALK_IN", scheduledCheckIn: "", scheduledCheckOut: "", notes: "" });
  };

  const openAdd = () => { resetForm(); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.set(k, v));
    const result = await createStay(data);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Booking created", variant: "success" });
      setShowModal(false);
      resetForm();
      setStays((prev) => [result.stay, ...prev]);
    }
  };

  const handleCheckIn = async (id: string) => {
    const result = await checkInStay(id);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else {
      toast({ title: "Checked in", variant: "success" });
      const stay = stays.find((s) => s.id === id);
      const mockKey = {
        roomId: stay?.roomId,
        guestId: stay?.guestId,
        stayId: id,
        issuedAt: new Date().toISOString(),
        expiresAt: stay?.scheduledCheckOut,
        accessCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
        type: "MOCK_KEYCARD",
      };
      setKeyPayload(mockKey);
      setStays((prev) => prev.map((s) => s.id === id ? { ...s, status: "CHECKED_IN", actualCheckIn: new Date() } : s));
    }
  };

  const openCheckoutModal = (s: any) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setCheckoutDate(local);
    setCheckoutModal({ stayId: s.id, guestName: s.guest?.fullName, roomNumber: s.room?.number, checkInDate: s.actualCheckIn ?? s.scheduledCheckIn });
  };

  const handleCheckOut = async () => {
    if (!checkoutModal) return;
    if (!checkoutDate) { toast({ title: "Error", description: "Please select a check-out date", variant: "destructive" }); return; }
    const result = await checkOutStay(checkoutModal.stayId, checkoutDate);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else {
      toast({ title: "Checked out successfully", variant: "success" });
      setStays((prev) => prev.map((s) => s.id === checkoutModal.stayId ? { ...s, status: "CHECKED_OUT", actualCheckOut: new Date(checkoutDate) } : s));
      setCheckoutModal(null);
      setCheckoutDate("");
    }
  };

  const handleCancel = (id: string) => {
    setConfirmDialog({
      open: true,
      title: "Cancel this stay?",
      description: "The stay will be marked as cancelled.",
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await cancelStay(id);
        if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
        else { toast({ title: "Stay cancelled", variant: "success" }); setStays((prev) => prev.map((s) => s.id === id ? { ...s, status: "CANCELLED" } : s)); }
      },
    });
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete this stay?",
      description: "This will permanently delete the stay record.",
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await deleteStay(id);
        if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
        else { toast({ title: "Stay deleted", variant: "success" }); setStays((prev) => prev.filter((s) => s.id !== id)); }
      },
    });
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(guestForm).forEach(([k, v]) => data.set(k, v));
    data.set("active", "true");
    const result = await createGuest(data);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Guest registered", variant: "success" });
      if (result.guest) {
        setGuests((prev) => [result.guest, ...prev]);
        setForm((prev) => ({ ...prev, guestId: result.guest!.id }));
      }
      setShowGuestModal(false);
      setGuestForm({ fullName: "", phone: "", email: "", idNumber: "", idType: "", vipTier: "STANDARD", notes: "" });
    }
  };

  const filteredStays = stays.filter((s) =>
    s.guest?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    s.room?.number?.includes(search) ||
    s.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search stays..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canManage && <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600"><Plus className="w-4 h-4 mr-1" /> New Booking</Button>}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left">Guest</th><th className="px-3 py-2 text-left">Room</th><th className="px-3 py-2 text-left">Check In</th><th className="px-3 py-2 text-left">Check Out</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Actions</th></tr></thead>
          <tbody>
            {filteredStays.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">{s.guest?.fullName}</td>
                <td className="px-3 py-2">{s.room?.number}</td>
                <td className="px-3 py-2">{new Date(s.scheduledCheckIn).toLocaleDateString()}</td>
                <td className="px-3 py-2">{s.scheduledCheckOut ? new Date(s.scheduledCheckOut).toLocaleDateString() : <span className="text-gray-400 text-xs">Open</span>}</td>
                <td className="px-3 py-2"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STAY_STATUS_COLORS[s.status]}`}>{s.status.replace("_", " ")}</span></td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {s.status === "UPCOMING" && canManage && <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700" onClick={() => handleCheckIn(s.id)}><LogIn className="w-3 h-3 mr-1" /> Check In</Button>}
                    {s.status === "CHECKED_IN" && canManage && <Button size="sm" className="h-7 bg-blue-600 hover:bg-blue-700" onClick={() => openCheckoutModal(s)}><LogOut className="w-3 h-3 mr-1" /> Check Out</Button>}
                    {(s.status === "UPCOMING" || s.status === "CHECKED_IN") && canManage && <Button size="sm" variant="outline" className="h-7 text-red-600" onClick={() => handleCancel(s.id)}><Ban className="w-3 h-3 mr-1" /> Cancel</Button>}
                    {canManage && <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => handleDelete(s.id)}><Trash2 className="w-3 h-3" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Booking</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>Room</Label>
              <Select value={form.roomId} onValueChange={(v) => setForm({ ...form, roomId: v })}>
                <SelectTrigger><SelectValue placeholder="Select available room" /></SelectTrigger>
                <SelectContent>
                  {availableRooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.number} — {r.type} (${r.dynamicPrice})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Guest</Label>
              <div className="flex gap-2">
                <Select value={form.guestId} onValueChange={(v) => setForm({ ...form, guestId: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select guest" /></SelectTrigger>
                  <SelectContent>
                    {guests.map((g) => <SelectItem key={g.id} value={g.id}>{g.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
                {canManage && <Button type="button" variant="outline" onClick={() => setShowGuestModal(true)}><UserPlus className="w-4 h-4" /></Button>}
              </div>
            </div>
            <div><Label>Source</Label>
              <Select value={form.bookingSource} onValueChange={(v) => setForm({ ...form, bookingSource: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["WALK_IN", "OTA", "WEB"].map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Check In <span className="text-red-500 text-xs">*required</span></Label>
                <Input type="datetime-local" required value={form.scheduledCheckIn} onChange={(e) => setForm({ ...form, scheduledCheckIn: e.target.value })} />
              </div>
              <div>
                <Label>Check Out <span className="text-gray-400 text-xs">(optional)</span></Label>
                <Input type="datetime-local" value={form.scheduledCheckOut} onChange={(e) => setForm({ ...form, scheduledCheckOut: e.target.value })} />
              </div>
            </div>
            {(() => {
              const selectedRoom = rooms.find((r) => r.id === form.roomId);
              const checkIn = form.scheduledCheckIn ? new Date(form.scheduledCheckIn) : new Date();
              const checkOut = form.scheduledCheckOut ? new Date(form.scheduledCheckOut) : null;
              if (!selectedRoom || !checkOut || checkOut <= checkIn) return null;
              const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
              const total = nights * selectedRoom.dynamicPrice;
              return (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                  <span className="text-gray-600">{nights} night{nights !== 1 ? "s" : ""} × ${selectedRoom.dynamicPrice}</span>
                  <span className="font-bold text-orange-700">Total: ${total.toFixed(2)}</span>
                </div>
              );
            })()}
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!keyPayload} onOpenChange={() => setKeyPayload(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> Digital Key</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Access Code:</strong> {keyPayload?.accessCode}</p>
            <p><strong>Expires:</strong> {keyPayload?.expiresAt ? new Date(keyPayload.expiresAt).toLocaleString() : "N/A"}</p>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">{JSON.stringify(keyPayload, null, 2)}</pre>
          </div>
          <Button className="w-full" onClick={() => setKeyPayload(null)}>Close</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkoutModal} onOpenChange={() => setCheckoutModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LogOut className="w-5 h-5 text-blue-600" /> Check Out Guest</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Guest:</span> <strong>{checkoutModal?.guestName}</strong></p>
              <p><span className="text-gray-500">Room:</span> <strong>{checkoutModal?.roomNumber}</strong></p>
              <p><span className="text-gray-500">Checked in:</span> {checkoutModal?.checkInDate ? new Date(checkoutModal.checkInDate).toLocaleString() : "—"}</p>
            </div>
            <div>
              <Label>Check-Out Date &amp; Time <span className="text-red-500 text-xs">*required</span></Label>
              <Input type="datetime-local" required value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} />
            </div>
            {checkoutDate && checkoutModal?.checkInDate && (() => {
              const ci = new Date(checkoutModal.checkInDate);
              const co = new Date(checkoutDate);
              if (co <= ci) return <p className="text-red-500 text-xs">Check-out must be after check-in</p>;
              const nights = Math.max(1, Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24)));
              const room = stays.find((s) => s.id === checkoutModal.stayId)?.room;
              const total = nights * (room?.dynamicPrice ?? 0);
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                  <span className="text-gray-600">{nights} night{nights !== 1 ? "s" : ""} × ${room?.dynamicPrice ?? 0}</span>
                  <span className="font-bold text-blue-700">Total: ${total.toFixed(2)}</span>
                </div>
              );
            })()}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCheckoutModal(null)}>Cancel</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCheckOut}><LogOut className="w-4 h-4 mr-1" /> Confirm Check Out</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuestModal} onOpenChange={setShowGuestModal}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Register New Guest</DialogTitle></DialogHeader>
          <form onSubmit={handleGuestSubmit} className="space-y-3">
            <div><Label>Full Name</Label><Input required value={guestForm.fullName} onChange={(e) => setGuestForm({ ...guestForm, fullName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ID Number</Label><Input value={guestForm.idNumber} onChange={(e) => setGuestForm({ ...guestForm, idNumber: e.target.value })} /></div>
              <div><Label>ID Type</Label><Input value={guestForm.idType} onChange={(e) => setGuestForm({ ...guestForm, idType: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Input value={guestForm.notes} onChange={(e) => setGuestForm({ ...guestForm, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowGuestModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Save Guest</Button>
            </div>
          </form>
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

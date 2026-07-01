"use client";

import { useState } from "react";
import { createGuest, updateGuest, deleteGuest } from "@/actions/hotel/guests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Search, Crown } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const VIP_TIERS = ["STANDARD", "SILVER", "GOLD", "PLATINUM"];

interface GuestsClientProps {
  guests: any[];
  canManage: boolean;
}

export function GuestsClient({ guests: initialGuests, canManage }: GuestsClientProps) {
  const [guests, setGuests] = useState<any[]>(initialGuests);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: string } | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<any | null>(null);
  const [form, setForm] = useState({
    fullName: "", phone: "", email: "", idNumber: "", idType: "", vipTier: "STANDARD", notes: "", active: "true",
  });

  const resetForm = () => {
    setForm({ fullName: "", phone: "", email: "", idNumber: "", idType: "", vipTier: "STANDARD", notes: "", active: "true" });
    setEditingGuest(null);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (g: any) => {
    setEditingGuest(g);
    setForm({
      fullName: g.fullName, phone: g.phone || "", email: g.email || "", idNumber: g.idNumber || "",
      idType: g.idType || "", vipTier: g.vipTier, notes: g.notes || "", active: String(g.active),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.set(k, v));
    const result = editingGuest
      ? await updateGuest(editingGuest.id, data)
      : await createGuest(data);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: editingGuest ? "Guest updated" : "Guest added", variant: "success" });
      setShowModal(false);
      resetForm();
      setGuests((prev) => editingGuest ? prev.map((g) => g.id === editingGuest.id ? result.guest : g) : [result.guest, ...prev]);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ open: true, id });
  };

  const doDelete = async (id: string) => {
    setConfirmDialog(null);
    const result = await deleteGuest(id);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else { toast({ title: "Guest deleted", variant: "success" }); setGuests((prev) => prev.filter((g) => g.id !== id)); }
  };

  const filteredGuests = guests.filter((g) =>
    g.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (g.phone && g.phone.includes(search)) ||
    (g.email && g.email.includes(search))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search guests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canManage && <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600"><Plus className="w-4 h-4 mr-1" /> Add Guest</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGuests.map((g) => (
          <div key={g.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{g.fullName}</h3>
                <p className="text-xs text-gray-500">{g.phone || g.email || "No contact"}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-orange-600"><Crown className="w-3 h-3" /> {g.vipTier}</div>
            </div>
            <div className="text-xs text-gray-600 mt-2 space-y-1">
              {g.idNumber && <p>ID: {g.idNumber} {g.idType && `(${g.idType})`}</p>}
              {g.stays?.length > 0 && <p>Active stays: {g.stays.length}</p>}
              {g.notes && <p className="italic">{g.notes}</p>}
            </div>
            {canManage && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(g)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(g.id)}><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGuest ? "Edit Guest" : "Add Guest"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>Full Name</Label><Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ID Number</Label><Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></div>
              <div><Label>ID Type</Label><Input value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })} /></div>
            </div>
            <div><Label>VIP Tier</Label>
              <Select value={form.vipTier} onValueChange={(v) => setForm({ ...form, vipTier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VIP_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
          title="Delete guest?"
          description="This will permanently delete the guest record."
          confirmLabel="Delete"
          onConfirm={() => doDelete(confirmDialog.id)}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

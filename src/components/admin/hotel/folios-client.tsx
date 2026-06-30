"use client";

import { useState } from "react";
import { addFolioCharge, addFolioPayment, getCheckoutInvoice } from "@/actions/hotel/folio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, FileText, CreditCard } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface FoliosClientProps {
  stays: any[];
  canManage: boolean;
}

export function FoliosClient({ stays: initialStays, canManage }: FoliosClientProps) {
  const [stays, setStays] = useState<any[]>(initialStays);
  const [search, setSearch] = useState("");
  const [selectedStay, setSelectedStay] = useState<any>(null);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [chargeForm, setChargeForm] = useState({ category: "FB", description: "", amount: "", isRoomBill: "true" });
  const [paymentAmount, setPaymentAmount] = useState("");

  const filteredStays = stays.filter((s) =>
    s.guest?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    s.room?.number?.includes(search)
  );

  const getBalance = (stay: any) => {
    if (!stay?.folioItems) return 0;
    return stay.folioItems.reduce((sum: number, f: any) => sum + (f.type === "CHARGE" ? f.amount : -f.amount), 0);
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStay) return;
    const amount = parseFloat(chargeForm.amount);
    const result = await addFolioCharge(selectedStay.id, chargeForm.category, chargeForm.description, amount, chargeForm.isRoomBill === "true");
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else {
      toast({ title: "Charge added", variant: "success" });
      setShowChargeModal(false);
      setChargeForm({ category: "FB", description: "", amount: "", isRoomBill: "true" });
      setStays((prev) => prev.map((s) => s.id === selectedStay.id ? { ...s, folioItems: [...s.folioItems, result.item] } : s));
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStay) return;
    const amount = parseFloat(paymentAmount);
    const result = await addFolioPayment(selectedStay.id, amount);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else {
      toast({ title: "Payment recorded", variant: "success" });
      setShowPaymentModal(false);
      setPaymentAmount("");
      setStays((prev) => prev.map((s) => s.id === selectedStay.id ? { ...s, folioItems: [...s.folioItems, result.item] } : s));
    }
  };

  const printInvoice = async (stay: any) => {
    const result = await getCheckoutInvoice(stay.id);
    if (result.error || !result.invoice) {
      toast({ title: "Error", description: String(result.error || "Failed to generate invoice"), variant: "destructive" });
      return;
    }
    const inv = result.invoice;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    const html = `
      <html><head><title>Invoice ${stay.id.slice(0,6)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:auto;} .header{border-bottom:2px solid #f97316;padding-bottom:12px;margin-bottom:24px;} .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;} .total{font-weight:bold;font-size:1.1em;margin-top:12px;}</style>
      </head><body>
      <div class="header"><h1>Guest Invoice</h1><p>Room ${stay.room?.number} · ${stay.guest?.fullName}</p></div>
      <h2>Room Charges</h2>${inv.roomCharges.map((f: any) => `<div class="row"><span>${f.description}</span><span>$${f.amount.toFixed(2)}</span></div>`).join("")}
      <h2>Incidental Charges</h2>${inv.incidentalCharges.map((f: any) => `<div class="row"><span>${f.description}</span><span>$${f.amount.toFixed(2)}</span></div>`).join("")}
      <h2>Payments</h2>${inv.payments.map((f: any) => `<div class="row"><span>${f.description}</span><span>-$${f.amount.toFixed(2)}</span></div>`).join("")}
      <div class="row total"><span>Room Total</span><span>$${inv.roomTotal.toFixed(2)}</span></div>
      <div class="row total"><span>Incidental Total</span><span>$${inv.incidentalTotal.toFixed(2)}</span></div>
      <div class="row total"><span>Paid</span><span>$${inv.paidTotal.toFixed(2)}</span></div>
      <div class="row total"><span>Balance</span><span>$${inv.balance.toFixed(2)}</span></div>
      </body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search folios..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredStays.map((s) => (
          <div key={s.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{s.guest?.fullName}</h3>
                <p className="text-xs text-gray-500">Room {s.room?.number} · {s.status.replace("_", " ")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">${getBalance(s).toFixed(2)}</p>
                <p className="text-xs text-gray-500">Balance</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {s.folioItems?.map((f: any) => (
                <div key={f.id} className="flex justify-between">
                  <span className={f.type === "PAYMENT" ? "text-green-700" : f.isRoomBill ? "text-gray-700" : "text-orange-700"}>
                    {f.type === "PAYMENT" ? "Payment" : f.category} — {f.description}
                  </span>
                  <span>{f.type === "PAYMENT" ? "-" : ""}${f.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setSelectedStay(s); setShowChargeModal(true); }}><Plus className="w-3 h-3 mr-1" /> Charge</Button>
                <Button size="sm" variant="outline" onClick={() => { setSelectedStay(s); setShowPaymentModal(true); }}><CreditCard className="w-3 h-3 mr-1" /> Payment</Button>
                <Button size="sm" variant="outline" onClick={() => printInvoice(s)}><FileText className="w-3 h-3 mr-1" /> Invoice</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showChargeModal} onOpenChange={setShowChargeModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
          <form onSubmit={handleAddCharge} className="space-y-3">
            <div><Label>Category</Label>
              <Select value={chargeForm.category} onValueChange={(v) => setChargeForm({ ...chargeForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["FB", "SPA", "LAUNDRY", "MINIBAR", "LATE_FEE", "OTHER"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input required value={chargeForm.description} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} /></div>
            <div><Label>Amount</Label><Input type="number" step="0.01" required value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} /></div>
            <div><Label>Bill To</Label>
              <Select value={chargeForm.isRoomBill} onValueChange={(v) => setChargeForm({ ...chargeForm, isRoomBill: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Room Bill</SelectItem>
                  <SelectItem value="false">Incidental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowChargeModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">Add Charge</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-3">
            <div><Label>Amount</Label><Input type="number" step="0.01" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Record</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

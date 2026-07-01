"use client";

import { useState, useEffect } from "react";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/actions/customers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Phone, Mail, MapPin, Trash2, Pencil, Search, X, Users,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CustomersClientProps {
  currencySymbol: string;
  canManage: boolean;
}

function formatMoney(n: number, sym: string) {
  return `${sym}${n.toFixed(2)}`;
}

export function CustomersClient({ currencySymbol, canManage }: CustomersClientProps) {
  const sym = currencySymbol || "$";
  const [customers, setCustomers] = useState<any[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    email: "",
    creditLimit: "",
    active: true,
  });

  const loadData = async () => {
    setLoading(true);
    const res = await getCustomers();
    if (res.error) {
      toast({ title: "Error", description: String(res.error), variant: "destructive" });
    } else {
      setCustomers(res.customers || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setForm({ name: "", phone: "", address: "", email: "", creditLimit: "", active: true });
    setEditingCustomer(null);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (c: any) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      email: c.email || "",
      creditLimit: c.creditLimit?.toString() || "",
      active: c.active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : 0,
    };
    const result = editingCustomer
      ? await updateCustomer(editingCustomer.id, data)
      : await createCustomer(data);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: editingCustomer ? "Customer updated" : "Customer added", variant: "success" });
      setShowModal(false);
      resetForm();
      loadData();
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ open: true, id });
  };

  const doDelete = async (id: string) => {
    setConfirmDialog(null);
    const result = await deleteCustomer(id);
    if (result.error) toast({ title: "Error", description: String(result.error), variant: "destructive" });
    else { toast({ title: "Customer deleted", variant: "success" }); loadData(); }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-1" /> Add Customer
          </Button>
        )}
      </div>

      {filteredCustomers.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No customers found</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => {
          const totalOwed = customer.credits?.reduce(
            (sum: number, c: any) => sum + (c.originalAmount - c.paidAmount),
            0
          ) || 0;
          return (
            <Card key={customer.id} className={customer.active ? "" : "opacity-60"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    {!customer.active && <span className="text-xs text-gray-500">(Inactive)</span>}
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(customer)}>
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  {customer.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> {customer.phone}</div>}
                  {customer.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> {customer.email}</div>}
                  {customer.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {customer.address}</div>}
                </div>
                <div className="mt-4 pt-3 border-t flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-gray-500">Credit limit:</span>{" "}
                    <span className="font-medium">{customer.creditLimit > 0 ? formatMoney(customer.creditLimit, sym) : "No limit"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Owed:</span>{" "}
                    <span className={`font-semibold ${totalOwed > 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatMoney(totalOwed, sym)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editingCustomer ? "Edit Customer" : "Add Customer"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email (optional)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Credit Limit</Label>
                <Input type="number" min="0" step="0.01" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} placeholder="0 = no limit" />
              </div>
              {editingCustomer && (
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label className="mb-0">Active</Label>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">{editingCustomer ? "Update" : "Save"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title="Delete customer?"
          description="Their credit history will also be deleted."
          confirmLabel="Delete"
          onConfirm={() => doDelete(confirmDialog.id)}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

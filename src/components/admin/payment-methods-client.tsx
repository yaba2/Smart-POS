"use client";

import { useState } from "react";
import { CreditCard, Plus, Edit2, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Dialog as AlertDialog,
  DialogContent as AlertDialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  reorderPaymentMethods,
} from "@/actions/payment-methods";

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon: string | null;
  color: string | null;
  active: boolean;
  sortOrder: number;
}

const ICONS = [
  "CreditCard", "Banknote", "Smartphone", "Wallet", "CircleDollarSign",
  "QrCode", "Coins", "Banknote", "Landmark"
];

const COLORS = [
  { label: "Green", value: "text-green-600" },
  { label: "Blue", value: "text-blue-600" },
  { label: "Purple", value: "text-purple-600" },
  { label: "Orange", value: "text-orange-600" },
  { label: "Red", value: "text-red-600" },
  { label: "Gray", value: "text-gray-600" },
];

export function PaymentMethodsClient({ methods: initialMethods }: { methods: PaymentMethod[] }) {
  const [methods, setMethods] = useState(initialMethods.sort((a, b) => a.sortOrder - b.sortOrder));
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    icon: "CreditCard",
    color: "text-blue-600",
  });

  const handleAdd = async () => {
    const result = await createPaymentMethod(formData);
    if (result.success) {
      toast({ title: "Payment method created" });
      setMethods([...methods, result.method].sort((a, b) => a.sortOrder - b.sortOrder));
      setIsAddOpen(false);
      setFormData({ name: "", code: "", icon: "CreditCard", color: "text-blue-600" });
    } else {
      toast({ title: result.error || "Failed to create", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editingMethod) return;
    const result = await updatePaymentMethod(editingMethod.id, {
      name: editingMethod.name,
      icon: editingMethod.icon,
      color: editingMethod.color,
      active: editingMethod.active,
    });
    if (result.success) {
      toast({ title: "Payment method updated" });
      setMethods(methods.map((m) => (m.id === editingMethod.id ? result.method : m)));
      setEditingMethod(null);
    } else {
      toast({ title: result.error || "Failed to update", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingMethod) return;
    const result = await deletePaymentMethod(deletingMethod.id);
    if (result.success) {
      toast({ title: "Payment method deleted" });
      setMethods(methods.filter((m) => m.id !== deletingMethod.id));
      setDeletingMethod(null);
    } else {
      toast({ title: result.error || "Failed to delete", variant: "destructive" });
    }
  };

  const moveMethod = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= methods.length) return;

    const newMethods = [...methods];
    [newMethods[index], newMethods[newIndex]] = [newMethods[newIndex], newMethods[index]];

    // Update sortOrder based on new positions
    const reordered = newMethods.map((m, i) => ({ ...m, sortOrder: i }));
    setMethods(reordered);

    // Save to server
    reorderPaymentMethods(reordered.map((m) => m.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Payment Methods
          </h1>
          <p className="text-sm text-gray-500">Manage payment methods available at POS</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Payment Method
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Payment Method</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g., Cash"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Code (unique)</Label>
                <Input
                  placeholder="e.g., CASH"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                >
                  {ICONS.map((icon) => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`px-3 py-1 rounded-full text-sm border ${
                        formData.color === color.value
                          ? "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                      onClick={() => setFormData({ ...formData, color: color.value })}
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full">Create Payment Method</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {methods.map((method, index) => (
          <div
            key={method.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-white"
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <button
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  onClick={() => moveMethod(index, "up")}
                  disabled={index === 0}
                >
                  ▲
                </button>
                <GripVertical className="w-4 h-4 text-gray-300" />
                <button
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  onClick={() => moveMethod(index, "down")}
                  disabled={index === methods.length - 1}
                >
                  ▼
                </button>
              </div>
              <div className={`p-2 rounded-lg bg-gray-100 ${method.color || ""}`}>
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{method.name}</h3>
                  <span className="text-xs text-gray-400">{method.code}</span>
                  {!method.active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Icon: {method.icon || "Default"} • Color: {method.color || "Default"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={editingMethod?.id === method.id} onOpenChange={(open) => !open && setEditingMethod(null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setEditingMethod(method)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Payment Method</DialogTitle>
                  </DialogHeader>
                  {editingMethod && (
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={editingMethod.name}
                          onChange={(e) => setEditingMethod({ ...editingMethod, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <select
                          className="w-full rounded-md border px-3 py-2"
                          value={editingMethod.icon || "CreditCard"}
                          onChange={(e) => setEditingMethod({ ...editingMethod, icon: e.target.value })}
                        >
                          {ICONS.map((icon) => (
                            <option key={icon} value={icon}>{icon}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex flex-wrap gap-2">
                          {COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              className={`px-3 py-1 rounded-full text-sm border ${
                                editingMethod.color === color.value
                                  ? "bg-gray-800 text-white border-gray-800"
                                  : "bg-white text-gray-700 border-gray-300"
                              }`}
                              onClick={() => setEditingMethod({ ...editingMethod, color: color.value })}
                            >
                              {color.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingMethod.active}
                          onCheckedChange={(checked) => setEditingMethod({ ...editingMethod, active: checked })}
                        />
                        <Label>Active</Label>
                      </div>
                      <Button onClick={handleUpdate} className="w-full">Update Payment Method</Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => setDeletingMethod(method)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!deletingMethod} onOpenChange={() => setDeletingMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingMethod?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeletingMethod(null)}>Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

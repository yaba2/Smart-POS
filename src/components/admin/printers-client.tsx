"use client";

import { useState } from "react";
import { Printer, Plus, Edit2, Trash2, Check, X } from "lucide-react";
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
import { createPrinter, updatePrinter, deletePrinter } from "@/actions/printers";

interface PrinterType {
  id: string;
  name: string;
  destination: string;
  connectionType: string;
  ipAddress: string | null;
  port: number | null;
  isDefault: boolean;
  active: boolean;
}

const DESTINATIONS = ["KITCHEN", "BAR", "BILL"];
const CONNECTION_TYPES = [
  { value: "NETWORK", label: "Network (Ethernet / Wi-Fi)" },
  { value: "USB",     label: "USB Cable" },
];

export function PrintersClient({ printers: initialPrinters }: { printers: PrinterType[] }) {
  const [printers, setPrinters] = useState(initialPrinters);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterType | null>(null);
  const [deletingPrinter, setDeletingPrinter] = useState<PrinterType | null>(null);

  const emptyForm = { name: "", destination: "KITCHEN", connectionType: "NETWORK", ipAddress: "", port: "9100", isDefault: false, active: true };
  const [formData, setFormData] = useState(emptyForm);

  const handleAdd = async () => {
    const result = await createPrinter({
      ...formData,
      port: formData.port ? parseInt(formData.port) : 9100,
    });
    if (result.success) {
      toast({ title: "Printer created" });
      setPrinters([...printers, result.printer]);
      setIsAddOpen(false);
      setFormData(emptyForm);
    } else {
      toast({ title: result.error || "Failed to create", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editingPrinter) return;
    const result = await updatePrinter(editingPrinter.id, {
      name: editingPrinter.name,
      destination: editingPrinter.destination,
      connectionType: editingPrinter.connectionType,
      ipAddress: editingPrinter.ipAddress || undefined,
      port: editingPrinter.port || 9100,
      isDefault: editingPrinter.isDefault,
      active: editingPrinter.active,
    });
    if (result.success) {
      toast({ title: "Printer updated" });
      setPrinters(printers.map((p) => (p.id === editingPrinter.id ? result.printer : p)));
      setEditingPrinter(null);
    } else {
      toast({ title: result.error || "Failed to update", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingPrinter) return;
    const result = await deletePrinter(deletingPrinter.id);
    if (result.success) {
      toast({ title: "Printer deleted" });
      setPrinters(printers.filter((p) => p.id !== deletingPrinter.id));
      setDeletingPrinter(null);
    } else {
      toast({ title: result.error || "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="w-6 h-6" />
            Printers
          </h1>
          <p className="text-sm text-gray-500">Manage kitchen, bar, and receipt printers</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Printer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Printer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Kitchen Printer"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                >
                  {DESTINATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Connection Type</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.connectionType}
                  onChange={(e) => setFormData({ ...formData, connectionType: e.target.value })}
                >
                  {CONNECTION_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
              {formData.connectionType === "NETWORK" && (
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>IP Address</Label>
                    <Input
                      placeholder="192.168.1.201"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Port</Label>
                    <Input
                      placeholder="9100"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {formData.connectionType === "USB" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  USB printers are auto-detected by the print server. Run <code>npm start</code> on the Windows PC and it will detect connected USB printers automatically.
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                />
                <Label>Set as default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Active</Label>
              </div>
              <Button onClick={handleAdd} className="w-full">Create Printer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {printers.map((printer) => (
          <div
            key={printer.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-white"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${printer.active ? "bg-green-100" : "bg-gray-100"}`}>
                <Printer className={`w-5 h-5 ${printer.active ? "text-green-600" : "text-gray-400"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{printer.name}</h3>
                  {printer.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Default</span>
                  )}
                  {!printer.active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {printer.destination}
                  {" • "}
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    printer.connectionType === "NETWORK"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                  }`}>
                    {printer.connectionType || "USB"}
                  </span>
                  {printer.connectionType === "NETWORK" && printer.ipAddress && ` • ${printer.ipAddress}:${printer.port || 9100}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={editingPrinter?.id === printer.id} onOpenChange={(open) => !open && setEditingPrinter(null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setEditingPrinter(printer)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Printer</DialogTitle>
                  </DialogHeader>
                  {editingPrinter && (
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={editingPrinter.name}
                          onChange={(e) => setEditingPrinter({ ...editingPrinter, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Destination</Label>
                        <select
                          className="w-full rounded-md border px-3 py-2"
                          value={editingPrinter.destination}
                          onChange={(e) => setEditingPrinter({ ...editingPrinter, destination: e.target.value })}
                        >
                          {DESTINATIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Connection Type</Label>
                        <select
                          className="w-full rounded-md border px-3 py-2"
                          value={editingPrinter.connectionType || "NETWORK"}
                          onChange={(e) => setEditingPrinter({ ...editingPrinter, connectionType: e.target.value })}
                        >
                          {CONNECTION_TYPES.map((ct) => (
                            <option key={ct.value} value={ct.value}>{ct.label}</option>
                          ))}
                        </select>
                      </div>
                      {(editingPrinter.connectionType || "NETWORK") === "NETWORK" && (
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-2">
                            <Label>IP Address</Label>
                            <Input
                              placeholder="192.168.1.201"
                              value={editingPrinter.ipAddress || ""}
                              onChange={(e) => setEditingPrinter({ ...editingPrinter, ipAddress: e.target.value })}
                            />
                          </div>
                          <div className="w-24 space-y-2">
                            <Label>Port</Label>
                            <Input
                              placeholder="9100"
                              value={editingPrinter.port?.toString() || "9100"}
                              onChange={(e) => setEditingPrinter({ ...editingPrinter, port: parseInt(e.target.value) || 9100 })}
                            />
                          </div>
                        </div>
                      )}
                      {editingPrinter.connectionType === "USB" && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                          USB printers are auto-detected by the print server on startup.
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingPrinter.isDefault}
                          onCheckedChange={(checked) => setEditingPrinter({ ...editingPrinter, isDefault: checked })}
                        />
                        <Label>Set as default</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingPrinter.active}
                          onCheckedChange={(checked) => setEditingPrinter({ ...editingPrinter, active: checked })}
                        />
                        <Label>Active</Label>
                      </div>
                      <Button onClick={handleUpdate} className="w-full">Update Printer</Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => setDeletingPrinter(printer)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!deletingPrinter} onOpenChange={() => setDeletingPrinter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Printer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the printer &quot;{deletingPrinter?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeletingPrinter(null)}>Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

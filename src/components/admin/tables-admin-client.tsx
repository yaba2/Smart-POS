"use client";

import { useState } from "react";
import { createTable, updateTable, deleteTable, renameFloor, deleteFloor } from "@/actions/tables";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Table2, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "WAITING_PAYMENT";

interface TableRecord {
  id: string;
  name: string;
  floor: string | null;
  status: TableStatus;
}

interface TablesAdminClientProps {
  tables: TableRecord[];
}

const statusLabels: Record<TableStatus, { label: string; variant: "success" | "warning" | "info" }> = {
  AVAILABLE: { label: "Available", variant: "success" },
  OCCUPIED: { label: "Occupied", variant: "warning" },
  WAITING_PAYMENT: { label: "Waiting Payment", variant: "info" },
};

export function TablesAdminClient({ tables: initialTables }: TablesAdminClientProps) {
  const router = useRouter();
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void } | null>(null);

  // Table dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRecord | null>(null);
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState<TableStatus>("AVAILABLE");
  const [loading, setLoading] = useState(false);

  // Floor dialog
  const [showFloorDialog, setShowFloorDialog] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");
  const [editingFloor, setEditingFloor] = useState<string | null>(null);
  const [floorLoading, setFloorLoading] = useState(false);

  // Derive floors — merge DB floors with any newly created (not yet in DB) pending floors
  const [pendingFloors, setPendingFloors] = useState<string[]>([]);
  const dbFloors = Array.from(new Set(initialTables.map((t) => t.floor).filter(Boolean))) as string[];
  const floors = Array.from(new Set([...dbFloors, ...pendingFloors]));

  const openCreate = (defaultFloor?: string) => {
    setEditingTable(null);
    setName("");
    setFloor(defaultFloor || "");
    setStatus("AVAILABLE");
    setShowDialog(true);
  };

  const openEdit = (table: TableRecord) => {
    setEditingTable(table);
    setName(table.name);
    setFloor(table.floor || "");
    setStatus(table.status);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ title: "Table name required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      if (editingTable) {
        await updateTable(editingTable.id, { name, status, floor: floor.trim() || null });
        toast({ title: "Table updated" });
      } else {
        await createTable(name.trim(), floor.trim() || undefined);
        // Floor is now in DB — remove from pending
        if (floor.trim()) setPendingFloors((prev) => prev.filter((f) => f !== floor.trim()));
        toast({ title: "Table created" });
      }
      setShowDialog(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, tname: string) => {
    setConfirmDialog({
      open: true,
      title: `Delete table "${tname}"?`,
      description: "This will permanently remove the table.",
      onConfirm: async () => { setConfirmDialog(null); await deleteTable(id); toast({ title: "Table deleted" }); router.refresh(); },
    });
  };

  const openFloorEdit = (f: string) => {
    setEditingFloor(f);
    setNewFloorName(f);
    setShowFloorDialog(true);
  };

  const openFloorCreate = () => {
    setEditingFloor(null);
    setNewFloorName("");
    setShowFloorDialog(true);
  };

  const handleFloorSubmit = async () => {
    if (!newFloorName.trim()) { toast({ title: "Floor name required", variant: "destructive" }); return; }
    setFloorLoading(true);
    const trimmed = newFloorName.trim();
    try {
      if (editingFloor) {
        await renameFloor(editingFloor, trimmed);
        // Remove old pending entry if it was pending
        setPendingFloors((prev) => prev.map((f) => f === editingFloor ? trimmed : f));
        toast({ title: `Floor renamed to "${trimmed}"` });
        setShowFloorDialog(false);
        router.refresh();
      } else {
        // Add to pending floors so it appears in the dropdown immediately
        if (!floors.includes(trimmed)) {
          setPendingFloors((prev) => [...prev, trimmed]);
        }
        setShowFloorDialog(false);
        // Immediately open Add Table dialog with this floor pre-selected
        openCreate(trimmed);
        toast({ title: `Floor "${trimmed}" created — add your first table below` });
      }
    } finally {
      setFloorLoading(false);
    }
  };

  const handleDeleteFloor = (f: string) => {
    setConfirmDialog({
      open: true,
      title: `Delete floor "${f}"?`,
      description: "Tables will stay but won't be assigned to any floor.",
      onConfirm: async () => { setConfirmDialog(null); await deleteFloor(f); toast({ title: `Floor "${f}" deleted` }); router.refresh(); },
    });
  };

  // Group tables: by floor, then unassigned
  const unassigned = initialTables.filter((t) => !t.floor);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
          <p className="text-gray-500 text-sm mt-1">{initialTables.length} tables · {floors.length} floors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openFloorCreate} className="gap-2">
            <Layers className="w-4 h-4" /> Add Floor
          </Button>
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="w-4 h-4" /> Add Table
          </Button>
        </div>
      </div>

      {/* Floors section */}
      {floors.map((f) => {
        const floorTables = initialTables.filter((t) => t.floor === f);
        return (
          <Card key={f} className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-gray-800">
                  <Layers className="w-4 h-4 text-orange-500" />
                  {f}
                  <span className="text-xs font-normal text-gray-400 ml-1">{floorTables.length} tables</span>
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreate(f)}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openFloorEdit(f)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteFloor(f)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {floorTables.map((table) => (
                  <TableCard key={table.id} table={table} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
              {floorTables.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No tables — click + to add one</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Unassigned tables */}
      {(unassigned.length > 0 || floors.length === 0) && (
        <Card className={cn("border shadow-sm", floors.length > 0 ? "border-dashed border-gray-200" : "border-gray-200")}>
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-gray-500">
                <Table2 className="w-4 h-4" />
                {floors.length === 0 ? "All Tables" : "Unassigned Tables"}
                <span className="text-xs font-normal text-gray-400 ml-1">{unassigned.length} tables</span>
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreate()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {unassigned.map((table) => (
                <TableCard key={table.id} table={table} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
            {unassigned.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">All tables are assigned to floors</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTable ? "Edit Table" : "Add New Table"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Table Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Table 1, VIP 1" />
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Select value={floor || "__none__"} onValueChange={(v) => setFloor(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No floor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No floor</SelectItem>
                  {floors.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingTable && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TableStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="OCCUPIED">Occupied</SelectItem>
                    <SelectItem value="WAITING_PAYMENT">Waiting Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : editingTable ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floor dialog */}
      <Dialog open={showFloorDialog} onOpenChange={setShowFloorDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFloor ? `Rename "${editingFloor}"` : "Add New Floor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Floor Name *</Label>
              <Input
                value={newFloorName}
                onChange={(e) => setNewFloorName(e.target.value)}
                placeholder="e.g. Ground Floor, Floor 1, Rooftop"
                onKeyDown={(e) => e.key === "Enter" && handleFloorSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFloorDialog(false)}>Cancel</Button>
            <Button onClick={handleFloorSubmit} disabled={floorLoading}>
              {floorLoading ? "Saving..." : editingFloor ? "Rename" : "Create Floor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel="Delete"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

function TableCard({
  table,
  onEdit,
  onDelete,
}: {
  table: TableRecord;
  onEdit: (t: TableRecord) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const s = statusLabels[table.status];
  return (
    <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 text-center">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Table2 className="w-5 h-5 text-gray-500" />
        </div>
        <div className="font-semibold text-gray-800 text-sm mb-2">{table.name}</div>
        <Badge variant={s.variant} className="text-[10px] mb-3">{s.label}</Badge>
        <div className="flex gap-1 justify-center">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(table)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDelete(table.id, table.name)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

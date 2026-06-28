"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCategory, updateCategory, deleteCategory,
  createMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemAvailability,
} from "@/actions/menu";
import {
  createModifierGroup, updateModifierGroup, deleteModifierGroup,
  createModifierItem, updateModifierItem, deleteModifierItem,
  assignModifierGroupToCategory, removeModifierGroupFromCategory,
  assignModifierGroupToMenuItem, removeModifierGroupFromMenuItem,
} from "@/actions/modifiers";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, UtensilsCrossed, Tag, Settings2, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  printer: string | null;
  _count: { items: number };
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  available: boolean;
  categoryId: string;
  category: { name: string };
}

interface ModifierItemData {
  id: string;
  name: string;
  price: number;
  available: boolean;
  sortOrder: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  type: string;
  required: boolean;
  multiple: boolean;
  items: ModifierItemData[];
  categories: { category: { id: string; name: string } }[];
  menuItems: { menuItem: { id: string; name: string } }[];
}

interface MenuAdminClientProps {
  categories: Category[];
  items: MenuItem[];
  modifierGroups: ModifierGroup[];
}

const emptyItemForm = { name: "", price: "", description: "", image: "", categoryId: "", available: true };
const emptyCatForm = { name: "", description: "", sortOrder: "0", printer: "" };
const emptyModGroupForm = { name: "", type: "ACCOMPANIMENT" as "ACCOMPANIMENT" | "EXTRA", required: false, multiple: false };
const emptyModItemForm = { name: "", price: "0" };

const PRINTER_OPTIONS = ["KITCHEN", "BAR", "CASHIER", "RECEIPT"];

export function MenuAdminClient({ categories: initCategories, items: initItems, modifierGroups: initModGroups }: MenuAdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"categories" | "items" | "modifiers">("items");
  const [filterCategory, setFilterCategory] = useState("all");

  // Category dialog
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState(emptyCatForm);

  // Item dialog
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [loading, setLoading] = useState(false);

  // Modifier group dialog
  const [showModGroupDialog, setShowModGroupDialog] = useState(false);
  const [editingModGroup, setEditingModGroup] = useState<ModifierGroup | null>(null);
  const [modGroupForm, setModGroupForm] = useState(emptyModGroupForm);

  // Expanded modifier group (to show items inside)
  const [expandedModGroup, setExpandedModGroup] = useState<string | null>(null);

  // Add modifier item inline form
  const [addingItemToGroup, setAddingItemToGroup] = useState<string | null>(null);
  const [modItemForm, setModItemForm] = useState(emptyModItemForm);

  // Assign dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningGroup, setAssigningGroup] = useState<ModifierGroup | null>(null);

  const filteredItems = filterCategory === "all"
    ? initItems
    : initItems.filter((i) => i.categoryId === filterCategory);

  // Category handlers
  const openCreateCat = () => { setEditingCat(null); setCatForm(emptyCatForm); setShowCatDialog(true); };
  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, description: cat.description || "", sortOrder: String(cat.sortOrder), printer: cat.printer || "" });
    setShowCatDialog(true);
  };
  const handleCatSubmit = async () => {
    if (!catForm.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, { name: catForm.name, description: catForm.description, sortOrder: Number(catForm.sortOrder), printer: catForm.printer });
        toast({ title: "Category updated" });
      } else {
        await createCategory({ name: catForm.name, description: catForm.description, sortOrder: Number(catForm.sortOrder), printer: catForm.printer });
        toast({ title: "Category created" });
      }
      setShowCatDialog(false);
      router.refresh();
    } finally { setLoading(false); }
  };
  const handleDeleteCat = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? All items will also be deleted.`)) return;
    await deleteCategory(id);
    toast({ title: "Category deleted" });
    router.refresh();
  };

  // Item handlers
  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({ ...emptyItemForm, categoryId: initCategories[0]?.id || "" });
    setShowItemDialog(true);
  };
  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({ name: item.name, price: String(item.price), description: item.description || "", image: item.image || "", categoryId: item.categoryId, available: item.available });
    setShowItemDialog(true);
  };
  const handleItemSubmit = async () => {
    if (!itemForm.name || !itemForm.price || !itemForm.categoryId) {
      toast({ title: "Name, price and category are required", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const data = { name: itemForm.name, price: Number(itemForm.price), description: itemForm.description || undefined, image: itemForm.image || undefined, categoryId: itemForm.categoryId, available: itemForm.available };
      if (editingItem) {
        await updateMenuItem(editingItem.id, data);
        toast({ title: "Item updated" });
      } else {
        await createMenuItem(data);
        toast({ title: "Item created" });
      }
      setShowItemDialog(false);
      router.refresh();
    } finally { setLoading(false); }
  };
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteMenuItem(id);
    toast({ title: "Item deleted" });
    router.refresh();
  };
  const handleToggleItem = async (id: string, available: boolean) => {
    await toggleMenuItemAvailability(id, available);
    router.refresh();
  };

  // ── Modifier handlers ──────────────────────────────────────────────────────
  const openCreateModGroup = () => { setEditingModGroup(null); setModGroupForm(emptyModGroupForm); setShowModGroupDialog(true); };
  const openEditModGroup = (g: ModifierGroup) => {
    setEditingModGroup(g);
    setModGroupForm({ name: g.name, type: g.type as "ACCOMPANIMENT" | "EXTRA", required: g.required, multiple: g.multiple });
    setShowModGroupDialog(true);
  };
  const handleModGroupSubmit = async () => {
    if (!modGroupForm.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      if (editingModGroup) {
        await updateModifierGroup(editingModGroup.id, modGroupForm);
        toast({ title: "Modifier group updated" });
      } else {
        await createModifierGroup(modGroupForm);
        toast({ title: "Modifier group created" });
      }
      setShowModGroupDialog(false);
      router.refresh();
    } finally { setLoading(false); }
  };
  const handleDeleteModGroup = async (id: string, name: string) => {
    if (!confirm(`Delete modifier group "${name}"?`)) return;
    await deleteModifierGroup(id);
    toast({ title: "Deleted" });
    router.refresh();
  };

  const handleAddModItem = async (groupId: string) => {
    if (!modItemForm.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await createModifierItem({ modifierGroupId: groupId, name: modItemForm.name, price: Number(modItemForm.price) });
      toast({ title: "Option added" });
      setModItemForm(emptyModItemForm);
      setAddingItemToGroup(null);
      router.refresh();
    } finally { setLoading(false); }
  };
  const handleDeleteModItem = async (id: string) => {
    await deleteModifierItem(id);
    toast({ title: "Option removed" });
    router.refresh();
  };
  const handleToggleModItem = async (id: string, available: boolean) => {
    await updateModifierItem(id, { available });
    router.refresh();
  };

  const openAssignDialog = (g: ModifierGroup) => { setAssigningGroup(g); setShowAssignDialog(true); };
  const handleToggleCategoryAssign = async (catId: string, assigned: boolean) => {
    if (!assigningGroup) return;
    if (assigned) {
      await removeModifierGroupFromCategory(catId, assigningGroup.id);
    } else {
      await assignModifierGroupToCategory(catId, assigningGroup.id);
    }
    router.refresh();
  };
  const handleToggleItemAssign = async (itemId: string, assigned: boolean) => {
    if (!assigningGroup) return;
    if (assigned) {
      await removeModifierGroupFromMenuItem(itemId, assigningGroup.id);
    } else {
      await assignModifierGroupToMenuItem(itemId, assigningGroup.id);
    }
    router.refresh();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-500 text-sm mt-1">{initItems.length} items in {initCategories.length} categories</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "modifiers" && (
            <Button onClick={openCreateModGroup} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Modifier Group
            </Button>
          )}
          {activeTab === "categories" && (
            <Button variant="outline" onClick={openCreateCat} className="gap-1.5">
              <Tag className="w-4 h-4" /> Add Category
            </Button>
          )}
          {activeTab === "items" && (
            <Button onClick={openCreateItem} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {(["items", "categories", "modifiers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              activeTab === tab ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Items Tab */}
      {activeTab === "items" && (
        <div>
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            <button
              onClick={() => setFilterCategory("all")}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", filterCategory === "all" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
            >
              All ({initItems.length})
            </button>
            {initCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", filterCategory === cat.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
              >
                {cat.name} ({cat._count.items})
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-lg font-bold text-orange-600 shrink-0 overflow-hidden">
                  {item.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    : item.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-800">{item.name}</span>
                    {!item.available && <Badge variant="outline" className="text-[10px] text-gray-400">Unavailable</Badge>}
                  </div>
                  <div className="text-xs text-gray-400">{item.category.name} · ${item.price.toFixed(2)}</div>
                  {item.description && <div className="text-xs text-gray-400 truncate">{item.description}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={item.available} onCheckedChange={(v) => handleToggleItem(item.id, v)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditItem(item)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteItem(item.id, item.name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No items found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {initCategories.map((cat) => (
            <Card key={cat.id} className="border border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-800">{cat.name}</div>
                    {cat.description && <div className="text-xs text-gray-400 mt-0.5">{cat.description}</div>}
                  </div>
                  <Badge variant="secondary" className="shrink-0">{cat._count.items} items</Badge>
                </div>
                <div className="flex gap-1 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEditCat(cat)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteCat(cat.id, cat.name)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modifiers Tab */}
      {activeTab === "modifiers" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Create <strong>Accompaniment</strong> groups (e.g. "Accompanied With" → Chips, Rice, Salad) and <strong>Extra Charges</strong> groups (e.g. "Extras" → Extra Shot $0.50), then assign them to categories or individual items.
          </p>
          {initModGroups.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Settings2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No modifier groups yet. Click "Add Modifier Group" to start.</p>
            </div>
          )}
          {initModGroups.map((g) => (
            <Card key={g.id} className="border border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{g.name}</span>
                      <Badge variant={g.type === "ACCOMPANIMENT" ? "secondary" : "outline"} className={g.type === "EXTRA" ? "text-orange-600 border-orange-300" : ""}>
                        {g.type === "ACCOMPANIMENT" ? "Accompanied With" : "Extra Charge"}
                      </Badge>
                      {g.required && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
                      {g.multiple && <Badge variant="outline" className="text-[10px]">Multi-select</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {g.categories.map((c) => (
                        <span key={c.category.id} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">{c.category.name}</span>
                      ))}
                      {g.menuItems.map((m) => (
                        <span key={m.menuItem.id} className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">{m.menuItem.name}</span>
                      ))}
                      {g.categories.length === 0 && g.menuItems.length === 0 && (
                        <span className="text-[10px] text-gray-400 italic">Not assigned</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => openAssignDialog(g)}>
                      <Tag className="w-3 h-3" /> Assign
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModGroup(g)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteModGroup(g.id, g.name)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedModGroup(expandedModGroup === g.id ? null : g.id)}>
                      {expandedModGroup === g.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {expandedModGroup === g.id && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
                    <div className="text-xs font-medium text-gray-500 mb-1">Options ({g.items.length})</div>
                    {g.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                        <Switch checked={item.available} onCheckedChange={(v) => handleToggleModItem(item.id, v)} />
                        <span className="text-sm flex-1">{item.name}</span>
                        {item.price > 0 && <span className="text-xs font-medium text-orange-600">+${item.price.toFixed(2)}</span>}
                        {item.price === 0 && <span className="text-xs text-gray-400">Free</span>}
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => handleDeleteModItem(item.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {addingItemToGroup === g.id ? (
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Option name (e.g. Chips)"
                          value={modItemForm.name}
                          onChange={(e) => setModItemForm({ ...modItemForm, name: e.target.value })}
                          className="h-8 text-sm flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={modItemForm.price}
                          onChange={(e) => setModItemForm({ ...modItemForm, price: e.target.value })}
                          className="h-8 text-sm w-24"
                        />
                        <Button size="sm" className="h-8" onClick={() => handleAddModItem(g.id)} disabled={loading}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddingItemToGroup(null); setModItemForm(emptyModItemForm); }}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1 mt-1 text-xs" onClick={() => { setAddingItemToGroup(g.id); setModItemForm(emptyModItemForm); }}>
                        <Plus className="w-3 h-3" /> Add Option
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Burgers" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input type="number" value={catForm.sortOrder} onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Printer Destination</Label>
              <Select value={catForm.printer || "NONE"} onValueChange={(v) => setCatForm({ ...catForm, printer: v === "NONE" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select printer..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {PRINTER_OPTIONS.map((printer) => (
                    <SelectItem key={printer} value={printer}>{printer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatDialog(false)}>Cancel</Button>
            <Button onClick={handleCatSubmit} disabled={loading}>{loading ? "Saving..." : editingCat ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Classic Burger" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price *</Label>
                <Input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={itemForm.categoryId} onValueChange={(v) => setItemForm({ ...itemForm, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {initCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input value={itemForm.image} onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })} placeholder="https://example.com/image.jpg" />
              {itemForm.image && (
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={itemForm.image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      const parent = img.parentElement;
                      if (parent) {
                        parent.innerHTML = "<span class=\"text-xs text-red-400 flex items-center justify-center h-full px-1 text-center\">Invalid URL</span>";
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Optional description" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={itemForm.available} onCheckedChange={(v) => setItemForm({ ...itemForm, available: v })} />
              <Label>Available</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancel</Button>
            <Button onClick={handleItemSubmit} disabled={loading}>{loading ? "Saving..." : editingItem ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modifier Group Dialog */}
      <Dialog open={showModGroupDialog} onOpenChange={setShowModGroupDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingModGroup ? "Edit Modifier Group" : "Add Modifier Group"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Group Name *</Label>
              <Input value={modGroupForm.name} onChange={(e) => setModGroupForm({ ...modGroupForm, name: e.target.value })} placeholder="e.g. Accompanied With, Extras" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={modGroupForm.type} onValueChange={(v) => setModGroupForm({ ...modGroupForm, type: v as "ACCOMPANIMENT" | "EXTRA" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCOMPANIMENT">Accompanied With (free sides — chips, rice, salad…)</SelectItem>
                  <SelectItem value="EXTRA">Extra Charge (paid add-ons — extra shot, extra milk…)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={modGroupForm.required} onCheckedChange={(v) => setModGroupForm({ ...modGroupForm, required: v })} />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={modGroupForm.multiple} onCheckedChange={(v) => setModGroupForm({ ...modGroupForm, multiple: v })} />
                <Label>Multi-select</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModGroupDialog(false)}>Cancel</Button>
            <Button onClick={handleModGroupSubmit} disabled={loading}>{loading ? "Saving..." : editingModGroup ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Modifier Group Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign "{assigningGroup?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Categories</div>
              <div className="space-y-1.5">
                {initCategories.map((cat) => {
                  const assigned = assigningGroup?.categories.some((c) => c.category.id === cat.id) ?? false;
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <span className="text-sm">{cat.name}</span>
                      <Switch checked={assigned} onCheckedChange={() => handleToggleCategoryAssign(cat.id, assigned)} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Individual Items <span className="text-xs text-gray-400 font-normal">(overrides category)</span></div>
              <div className="space-y-1.5">
                {initItems.map((item) => {
                  const assigned = assigningGroup?.menuItems.some((m) => m.menuItem.id === item.id) ?? false;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div>
                        <span className="text-sm">{item.name}</span>
                        <span className="text-xs text-gray-400 ml-1">({item.category.name})</span>
                      </div>
                      <Switch checked={assigned} onCheckedChange={() => handleToggleItemAssign(item.id, assigned)} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowAssignDialog(false); router.refresh(); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

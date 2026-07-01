"use client";

import { useState } from "react";
import { createUser, updateUser, deleteUser, toggleUserActive, updateUserPermissions } from "@/actions/users";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Shield, User, KeyRound, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  MANAGER: "bg-purple-100 text-purple-700",
  SUPERVISOR: "bg-indigo-100 text-indigo-700",
  CASHIER: "bg-blue-100 text-blue-700",
  WAITER: "bg-green-100 text-green-700",
};

const ALL_PERMISSIONS = [
  // Order Management
  { key: "CANCEL_ORDER", label: "Cancel Orders", category: "Orders" },
  { key: "MODIFY_SENT_ORDERS", label: "Modify Sent Orders", category: "Orders" },
  { key: "PROCESS_REFUND", label: "Process Refunds", category: "Orders" },
  { key: "VIEW_ALL_ORDERS", label: "View All Orders (Any User)", category: "Orders" },
  { key: "OVERRIDE_PRICES", label: "Override Prices", category: "Orders" },

  // Billing & Payments
  { key: "SETTLE_BILL", label: "Settle Bills", category: "Billing" },
  { key: "APPLY_DISCOUNT", label: "Apply Discounts", category: "Billing" },
  { key: "SPLIT_BILL", label: "Split Bills", category: "Billing" },

  // Reports & Analytics
  { key: "VIEW_REPORTS", label: "View Reports", category: "Reports" },
  { key: "VIEW_SHIFT_REPORTS", label: "View Shift Reports", category: "Reports" },
  { key: "EXPORT_REPORTS", label: "Export Reports", category: "Reports" },

  // Shift Management
  { key: "OPEN_SHIFT", label: "Open Shift", category: "Shifts" },
  { key: "CLOSE_SHIFT", label: "Close Shift", category: "Shifts" },
  { key: "VIEW_SHIFT_HISTORY", label: "View Shift History", category: "Shifts" },

  // User Management
  { key: "MANAGE_USERS", label: "Manage Users", category: "Admin" },
  { key: "MANAGE_ROLES", label: "Manage Roles & Permissions", category: "Admin" },

  // Menu & Inventory
  { key: "MANAGE_MENU", label: "Manage Menu Items", category: "Menu" },
  { key: "MANAGE_CATEGORIES", label: "Manage Categories", category: "Menu" },
  { key: "MANAGE_MODIFIERS", label: "Manage Modifiers", category: "Menu" },
  { key: "UPDATE_INVENTORY", label: "Update Inventory", category: "Menu" },

  // Tables & Floor
  { key: "MANAGE_TABLES", label: "Manage Tables", category: "Tables" },
  { key: "RESERVE_TABLES", label: "Reserve Tables", category: "Tables" },

  // System Settings
  { key: "MANAGE_SETTINGS", label: "Manage Settings", category: "Settings" },
  { key: "MANAGE_TAX_RATES", label: "Manage Tax Rates", category: "Settings" },
  { key: "CONFIGURE_PRINTERS", label: "Configure Printers", category: "Settings" },

  // Admin
  { key: "VIEW_AUDIT_LOG", label: "View Audit Log", category: "Security" },
  { key: "BACKUP_DATA", label: "Backup & Restore Data", category: "Security" },
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    "CANCEL_ORDER", "MODIFY_SENT_ORDERS", "PROCESS_REFUND", "VIEW_ALL_ORDERS", "OVERRIDE_PRICES",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS", "EXPORT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT", "VIEW_SHIFT_HISTORY",
    "MANAGE_USERS", "MANAGE_ROLES",
    "MANAGE_MENU", "MANAGE_CATEGORIES", "MANAGE_MODIFIERS", "UPDATE_INVENTORY",
    "MANAGE_TABLES", "RESERVE_TABLES",
    "MANAGE_SETTINGS", "MANAGE_TAX_RATES", "CONFIGURE_PRINTERS",
    "VIEW_AUDIT_LOG", "BACKUP_DATA"
  ],
  MANAGER: [
    "CANCEL_ORDER", "MODIFY_SENT_ORDERS", "PROCESS_REFUND", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS", "EXPORT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT", "VIEW_SHIFT_HISTORY",
    "MANAGE_MENU", "MANAGE_CATEGORIES", "UPDATE_INVENTORY",
    "MANAGE_TABLES", "RESERVE_TABLES",
    "MANAGE_SETTINGS"
  ],
  SUPERVISOR: [
    "CANCEL_ORDER", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT",
    "RESERVE_TABLES"
  ],
  CASHIER: [
    "CANCEL_ORDER", "PROCESS_REFUND", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT",
    "RESERVE_TABLES"
  ],
  WAITER: ["VIEW_ALL_ORDERS"],
};

interface UserRecord {
  id: string;
  name: string;
  role: string;
  username: string | null;
  active: boolean;
  pin: string | null;
  permissions: string[];
  createdAt: Date;
}

interface UsersClientProps {
  users: UserRecord[];
}

const emptyForm = { name: "", role: "WAITER" as "WAITER" | "CASHIER" | "MANAGER" | "SUPERVISOR" | "ADMIN", pin: "", username: "", password: "" };

export function UsersClient({ users: initialUsers }: UsersClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showPermsDialog, setShowPermsDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [permsUser, setPermsUser] = useState<UserRecord | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const openCreate = () => { setEditingUser(null); setForm(emptyForm); setShowDialog(true); };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setForm({ name: user.name, role: user.role as "WAITER" | "CASHIER" | "MANAGER" | "SUPERVISOR" | "ADMIN", pin: user.pin || "", username: user.username || "", password: "" });
    setShowDialog(true);
  };

  const openPerms = (user: UserRecord) => {
    setPermsUser(user);
    const stored = user.permissions;
    const defaults = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    setSelectedPerms(stored.length > 0 ? [...stored] : [...defaults]);
    setShowPermsDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      if (editingUser) {
        const result = await updateUser(editingUser.id, { name: form.name, pin: form.pin || undefined, username: form.username || undefined, password: form.password || undefined });
        if ("error" in result) { toast({ title: String(result.error), variant: "destructive" }); return; }
        // Update local state immediately
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, name: form.name, pin: form.pin || null, username: form.username || null } : u));
        toast({ title: "User updated" });
      } else {
        const result = await createUser({ name: form.name, role: form.role, pin: form.pin || undefined, username: form.username || undefined, password: form.password || undefined });
        if ("error" in result) { toast({ title: String(result.error), variant: "destructive" }); return; }
        // Add new user to local state
        if (result.user) {
          const newUser: UserRecord = {
            id: result.user.id,
            name: result.user.name,
            role: result.user.role,
            username: result.user.username,
            active: result.user.active,
            pin: form.pin || null,
            permissions: [],
            createdAt: new Date(),
          };
          setUsers([...users, newUser]);
        }
        toast({ title: "User created" });
      }
      setShowDialog(false);
    } finally { setLoading(false); }
  };

  const handleSavePerms = async () => {
    if (!permsUser) return;
    setLoading(true);
    try {
      // Save the full checked set — this becomes the exact permission list for this user
      const result = await updateUserPermissions(permsUser.id, selectedPerms);
      if ("error" in result) {
        toast({ title: String(result.error), variant: "destructive" });
        return;
      }
      setUsers(users.map(u => u.id === permsUser.id ? { ...u, permissions: selectedPerms } : u));
      toast({ title: "Permissions saved", description: `${selectedPerms.length} permissions set for ${permsUser.name}`, variant: "success" });
      setShowPermsDialog(false);
    } finally { setLoading(false); }
  };

  const handleResetPerms = () => {
    if (!permsUser) return;
    const defaults = DEFAULT_ROLE_PERMISSIONS[permsUser.role] || [];
    setSelectedPerms([...defaults]);
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDialog({ open: true, id, name });
  };

  const doDelete = async (id: string) => {
    setConfirmDialog(null);
    await deleteUser(id);
    setUsers(users.filter(u => u.id !== id));
    toast({ title: "User deleted" });
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await toggleUserActive(id, active);
    // Update local state immediately
    setUsers(users.map(u => u.id === id ? { ...u, active } : u));
  };

  const admins = users.filter((u) => u.role === "ADMIN");
  const managers = users.filter((u) => u.role === "MANAGER");
  const supervisors = users.filter((u) => u.role === "SUPERVISOR");
  const cashiers = users.filter((u) => u.role === "CASHIER");
  const waiters = users.filter((u) => u.role === "WAITER");

  const roleGroups = [
    { label: "Administrators", icon: Shield, color: "text-red-600", users: admins },
    { label: "Managers", icon: Briefcase, color: "text-purple-600", users: managers },
    { label: "Supervisors", icon: Shield, color: "text-indigo-600", users: supervisors },
    { label: "Cashiers", icon: Briefcase, color: "text-blue-600", users: cashiers },
    { label: "Waiters", icon: User, color: "text-green-600", users: waiters },
  ];

  const posRoles = ["WAITER", "CASHIER", "MANAGER", "SUPERVISOR"];
  const needsPin = posRoles.includes(form.role) || (editingUser && posRoles.includes(editingUser.role));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} users total</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </div>

      {roleGroups.map(({ label, icon: Icon, color, users: group }) => (
        <Card key={label} className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className={`text-sm flex items-center gap-2 ${color}`}>
              <Icon className="w-4 h-4" /> {label} ({group.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.map((user) => (
              <UserRow key={user.id} user={user} onEdit={openEdit} onDelete={handleDelete} onToggleActive={handleToggleActive} onEditPerms={openPerms} />
            ))}
            {group.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No {label.toLowerCase()}</p>}
          </CardContent>
        </Card>
      ))}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmed Ali" />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "WAITER" | "CASHIER" | "MANAGER" | "SUPERVISOR" | "ADMIN" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WAITER">Waiter</SelectItem>
                    <SelectItem value="CASHIER">Cashier</SelectItem>
                    <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {needsPin && (
              <div className="space-y-2">
                <Label>PIN Code (4 digits)</Label>
                <Input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="e.g. 1234" maxLength={4} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. ahmed" />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? "New Password (leave blank to keep)" : "Password"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? "Saving..." : editingUser ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={showPermsDialog} onOpenChange={setShowPermsDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-orange-500" />
              Permissions — {permsUser?.name}
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ml-1 ${ROLE_COLORS[permsUser?.role || ""] || "bg-gray-100 text-gray-600"}`}>
                {permsUser?.role}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">
                Check to grant, uncheck to revoke. Changes are saved immediately and override role defaults.
                <span className="ml-1 font-medium text-orange-600">{selectedPerms.length} permissions active.</span>
              </p>
              <Button size="sm" variant="outline" className="text-xs shrink-0 ml-2" onClick={handleResetPerms}>
                Reset to defaults
              </Button>
            </div>
            <div className="space-y-3">
              {Object.entries(
                ALL_PERMISSIONS.reduce((acc, perm) => {
                  if (!acc[perm.category]) acc[perm.category] = [];
                  acc[perm.category].push(perm);
                  return acc;
                }, {} as Record<string, typeof ALL_PERMISSIONS>)
              ).map(([category, perms]) => {
                const allChecked = perms.every(p => selectedPerms.includes(p.key));
                const someChecked = perms.some(p => selectedPerms.includes(p.key));
                return (
                  <div key={category} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-100">
                      <span className="text-sm font-semibold text-gray-700">{category}</span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={(e) => {
                            const keys = perms.map(p => p.key);
                            if (e.target.checked) setSelectedPerms(Array.from(new Set([...selectedPerms, ...keys])));
                            else setSelectedPerms(selectedPerms.filter(p => !keys.includes(p)));
                          }}
                          className="w-3.5 h-3.5 accent-orange-500"
                        />
                        All
                      </label>
                    </div>
                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                      {perms.map((perm) => {
                        const isDefault = (DEFAULT_ROLE_PERMISSIONS[permsUser?.role || ""] || []).includes(perm.key);
                        const checked = selectedPerms.includes(perm.key);
                        return (
                          <label key={perm.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${checked ? "bg-orange-50" : "hover:bg-gray-50"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedPerms([...selectedPerms, perm.key]);
                                else setSelectedPerms(selectedPerms.filter((p) => p !== perm.key));
                              }}
                              className="w-4 h-4 accent-orange-500 shrink-0"
                            />
                            <span className={`text-sm flex-1 ${checked ? "text-gray-900 font-medium" : "text-gray-500"}`}>{perm.label}</span>
                            {isDefault && (
                              <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded shrink-0">default</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPermsDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePerms} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
              {loading ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={`Delete user "${confirmDialog.name}"?`}
          description="This will permanently remove the user account."
          confirmLabel="Delete"
          onConfirm={() => doDelete(confirmDialog.id)}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

function UserRow({
  user, onEdit, onDelete, onToggleActive, onEditPerms,
}: {
  user: UserRecord;
  onEdit: (u: UserRecord) => void;
  onDelete: (id: string, name: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onEditPerms: (u: UserRecord) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
      <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-800">{user.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-600"}`}>{user.role}</span>
          {!user.active && <Badge variant="outline" className="text-[10px] text-gray-400">Inactive</Badge>}
        </div>
        <div className="text-xs text-gray-400">
          {user.username && <span>@{user.username}</span>}
          {user.pin && <span className="ml-2">PIN: {user.pin}</span>}
          {user.permissions.length > 0
            ? <span className="ml-2 text-orange-500 font-medium">{user.permissions.length} permissions set</span>
            : <span className="ml-2 text-gray-400">using role defaults</span>
          }
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Switch checked={user.active} onCheckedChange={(v) => onToggleActive(user.id, v)} />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-600" title="Permissions" onClick={() => onEditPerms(user)}>
          <KeyRound className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(user)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(user.id, user.name)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

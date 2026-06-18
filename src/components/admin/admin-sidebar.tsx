"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import {
  LayoutDashboard,
  Users,
  Table2,
  UtensilsCrossed,
  Settings,
  LogOut,
  Menu,
  X,
  ChefHat,
  BarChart3,
  Printer,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  adminName: string;
  restaurantName: string;
  role: string;
  permissions: string[];
}

const allNavItems = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: null },
  { href: "/admin/users", icon: Users, label: "Users", permission: "MANAGE_USERS" },
  { href: "/admin/tables", icon: Table2, label: "Tables", permission: "MANAGE_TABLES" },
  { href: "/admin/menu", icon: UtensilsCrossed, label: "Menu", permission: "MANAGE_MENU" },
  { href: "/admin/printers", icon: Printer, label: "Printers", permission: "MANAGE_SETTINGS" },
  { href: "/admin/payment-methods", icon: CreditCard, label: "Payment Methods", permission: "MANAGE_SETTINGS" },
  { href: "/admin/reports", icon: BarChart3, label: "Reports", permission: "VIEW_REPORTS" },
  { href: "/admin/settings", icon: Settings, label: "Settings", permission: "MANAGE_SETTINGS" },
];

function NavContent({
  navItems,
  pathname,
  restaurantName,
  adminName,
  role,
  loggingOut,
  onLinkClick,
  onLogout,
}: {
  navItems: typeof allNavItems;
  pathname: string;
  restaurantName: string;
  adminName: string;
  role: string;
  loggingOut: boolean;
  onLinkClick: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-white text-sm truncate">{restaurantName}</div>
            <div className="text-xs text-gray-400">Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-500 text-center">
            No navigation items available
          </div>
        )}
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium",
                isActive
                  ? "bg-orange-500 text-white shadow-md"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User + Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{adminName}</div>
            <div className="text-xs text-gray-500">{role === "MANAGER" ? "Manager" : role === "SUPERVISOR" ? "Supervisor" : "Administrator"}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </>
  );
}

export function AdminSidebar({ adminName, restaurantName, role, permissions }: AdminSidebarProps) {
  const navItems = role === "ADMIN"
    ? allNavItems
    : allNavItems.filter(item => !item.permission || permissions.includes(item.permission));
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const navProps = { navItems, pathname, restaurantName, adminName, role, loggingOut, onLinkClick: () => setMobileOpen(false), onLogout: handleLogout };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 h-screen shrink-0">
        <NavContent {...navProps} />
      </aside>

      {/* Mobile Toggle */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <aside className="flex flex-col w-56 bg-gray-900 h-screen">
            <NavContent {...navProps} />
          </aside>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}

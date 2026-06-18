"use client";

import { useState } from "react";
import Link from "next/link";
import { UtensilsCrossed, LogOut, User, Clock, BarChart3 } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

interface PosHeaderProps {
  waiterName: string;
  restaurantName: string;
  permissions?: string[];
  role?: string;
}

export function PosHeader({ waiterName, restaurantName, permissions = [], role }: PosHeaderProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const canManageShift = permissions.includes("CLOSE_SHIFT") || role === "ADMIN";
  const canViewReports = permissions.includes("VIEW_REPORTS") || role === "ADMIN";

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 bg-orange-100 rounded-xl">
          <UtensilsCrossed className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">{restaurantName}</h1>
          <p className="text-xs text-gray-400 leading-tight">POS System</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canManageShift && (
          <Link href="/pos/shift">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 gap-1.5">
              <Clock className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">Shift</span>
            </Button>
          </Link>
        )}
        {canViewReports && (
          <Link href="/pos/report">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-green-600 hover:bg-green-50 gap-1.5">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">Reports</span>
            </Button>
          </Link>
        )}

        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
          <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <span className="text-sm font-medium text-gray-700">{waiterName}</span>
            {role && <p className="text-[10px] text-gray-400 capitalize">{role.toLowerCase()}</p>}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-gray-500 hover:text-red-500 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}

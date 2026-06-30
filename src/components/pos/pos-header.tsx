"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UtensilsCrossed, LogOut, User, Clock, BarChart3, BedDouble } from "lucide-react";
import { logout } from "@/actions/auth";
import { getAvailableMenu } from "@/actions/menu";
import { getStays } from "@/actions/hotel/stays";
import { createRoomService } from "@/actions/hotel/room-services";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

interface PosHeaderProps {
  waiterName: string;
  restaurantName: string;
  permissions?: string[];
  role?: string;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export function PosHeader({ waiterName, restaurantName, permissions = [], role }: PosHeaderProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [showRoomService, setShowRoomService] = useState(false);
  const [activeStays, setActiveStays] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [selectedStay, setSelectedStay] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const canManageShift = permissions.includes("CLOSE_SHIFT") || role === "ADMIN";
  const canViewReports = permissions.includes("VIEW_REPORTS") || role === "ADMIN";

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const loadRoomServiceData = async () => {
    setLoading(true);
    const [menuRes, staysRes] = await Promise.all([getAvailableMenu(), getStays("CHECKED_IN")]);
    setMenu(menuRes || []);
    setActiveStays(staysRes.stays || []);
    if (staysRes.stays?.[0]) setSelectedStay(staysRes.stays[0].id);
    if (menuRes?.[0]) setSelectedCategory(menuRes[0].id);
    setLoading(false);
  };

  useEffect(() => {
    if (showRoomService) loadRoomServiceData();
  }, [showRoomService]);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.menuItemId === item.id);
      if (existing) return prev.map((p) => p.menuItemId === item.id ? { ...p, quantity: p.quantity + 1 } : p);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((p) => p.menuItemId !== menuItemId));
  };

  const updateQty = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) return removeFromCart(menuItemId);
    setCart((prev) => prev.map((p) => p.menuItemId === menuItemId ? { ...p, quantity } : p));
  };

  const handleSubmitRoomService = async () => {
    if (!selectedStay) return toast({ title: "Select a stay", variant: "destructive" });
    if (cart.length === 0) return toast({ title: "Cart is empty", variant: "destructive" });
    const stay = activeStays.find((s) => s.id === selectedStay);
    if (!stay) return;
    const result = await createRoomService(stay.id, stay.roomId, cart);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Room service order placed", variant: "success" });
      setShowRoomService(false);
      setCart([]);
    }
  };

  const selectedCategoryItems = menu.find((c) => c.id === selectedCategory)?.items || [];
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <>
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
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-purple-600 hover:bg-purple-50 gap-1.5" onClick={() => setShowRoomService(true)}>
            <BedDouble className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Room Services</span>
          </Button>
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

      <Dialog open={showRoomService} onOpenChange={setShowRoomService}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BedDouble className="w-5 h-5" /> Room Service Order</DialogTitle></DialogHeader>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : activeStays.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No checked-in guests available.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Active Room / Guest</Label>
                <Select value={selectedStay} onValueChange={setSelectedStay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeStays.map((s) => <SelectItem key={s.id} value={s.id}>Room {s.room?.number} — {s.guest?.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {menu.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {selectedCategoryItems.map((item: any) => (
                      <Button key={item.id} variant="outline" className="justify-start h-auto py-2" onClick={() => addToCart(item)}>
                        <div className="text-left">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-gray-500">${item.price.toFixed(2)}</p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Cart</Label>
                  <div className="border rounded-lg p-3 space-y-2 min-h-[200px]">
                    {cart.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Tap items to add</p>}
                    {cart.map((item) => (
                      <div key={item.menuItemId} className="flex items-center justify-between text-sm">
                        <div className="flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-gray-500">${item.price.toFixed(2)}</p></div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateQty(item.menuItemId, item.quantity - 1)}>-</Button>
                          <span className="w-4 text-center">{item.quantity}</span>
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateQty(item.menuItemId, item.quantity + 1)}>+</Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600" onClick={() => removeFromCart(item.menuItemId)}>×</Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-bold"><span>Total</span><span>${cartTotal.toFixed(2)}</span></div>
                  </div>
                  <Button className="w-full mt-3 bg-orange-500 hover:bg-orange-600" onClick={handleSubmitRoomService} disabled={cart.length === 0}>
                    Place Order (${cartTotal.toFixed(2)})
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { requireAdmin } from "@/lib/auth";
import { getDashboardStats } from "@/actions/settings";
import { getSettings } from "@/actions/settings";
import {
  TrendingUp,
  ShoppingBag,
  Table2,
  Star,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  await requireAdmin();
  const [stats, settings] = await Promise.all([getDashboardStats(), getSettings()]);
  const symbol = settings.currencySymbol;

  const statCards = [
    {
      title: "Today's Sales",
      value: `${symbol}${stats.todaySales.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
      sub: "Completed orders",
    },
    {
      title: "Orders Today",
      value: stats.todayOrders.toString(),
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
      sub: "Sent & completed",
    },
    {
      title: "Active Tables",
      value: stats.activeTables.toString(),
      icon: Table2,
      color: "text-orange-600",
      bg: "bg-orange-50",
      sub: "Occupied & waiting",
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Items */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Popular Items Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.popularItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No orders yet today</div>
            ) : (
              <div className="space-y-3">
                {stats.popularItems.map((item, idx) => (
                  <div key={item.menuItemId} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.menuItem?.name || "Unknown"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {item._sum.quantity} sold
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No recent orders</div>
            ) : (
              <div className="space-y-2">
                {stats.recentOrders.slice(0, 8).map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-700">{order.table.name}</div>
                      <div className="text-xs text-gray-400">by {order.waiter.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {symbol}{order.total.toFixed(2)}
                      </span>
                      <Badge
                        variant={
                          order.status === "COMPLETED" ? "success" :
                          order.status === "SENT" ? "info" :
                          order.status === "OPEN" ? "warning" : "outline"
                        }
                        className="text-[10px] px-1.5"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

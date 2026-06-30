"use client";

import { Card, CardContent } from "@/components/ui/card";

interface AnalyticsClientProps {
  analytics: any;
  canView: boolean;
}

export function HotelAnalyticsClient({ analytics, canView }: AnalyticsClientProps) {
  if (!canView) {
    return <div className="p-4 text-center text-gray-500">You do not have permission to view hotel analytics.</div>;
  }
  if (!analytics) {
    return <div className="p-4 text-center text-gray-500">No analytics data available.</div>;
  }

  const { roomStats, stayStats, revenue, serviceStats, topSources } = analytics;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Occupancy Rate</p><p className="text-2xl font-bold text-gray-900">{roomStats?.occupancyRate?.toFixed(1) || 0}%</p><p className="text-xs text-gray-500">{roomStats?.occupiedRooms}/{roomStats?.totalRooms} rooms</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-gray-900">${revenue?.totalRevenue?.toFixed(2) || "0.00"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Room Revenue</p><p className="text-2xl font-bold text-gray-900">${revenue?.roomRevenue?.toFixed(2) || "0.00"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-gray-500">Service Revenue</p><p className="text-2xl font-bold text-gray-900">${revenue?.serviceRevenue?.toFixed(2) || "0.00"}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><h3 className="font-semibold text-gray-900 mb-3">Room Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Available</span><span className="font-medium">{roomStats?.availableRooms || 0}</span></div>
            <div className="flex justify-between"><span>Occupied</span><span className="font-medium">{roomStats?.occupiedRooms || 0}</span></div>
            <div className="flex justify-between"><span>Dirty</span><span className="font-medium">{roomStats?.dirtyRooms || 0}</span></div>
            <div className="flex justify-between"><span>Maintenance</span><span className="font-medium">{roomStats?.maintenanceRooms || 0}</span></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4"><h3 className="font-semibold text-gray-900 mb-3">Stay Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Upcoming</span><span className="font-medium">{stayStats?.upcoming || 0}</span></div>
            <div className="flex justify-between"><span>Checked In</span><span className="font-medium">{stayStats?.checkedIn || 0}</span></div>
            <div className="flex justify-between"><span>Checked Out</span><span className="font-medium">{stayStats?.checkedOut || 0}</span></div>
            <div className="flex justify-between"><span>Total</span><span className="font-medium">{stayStats?.total || 0}</span></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4"><h3 className="font-semibold text-gray-900 mb-3">Room Services</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Pending</span><span className="font-medium">{serviceStats?.pendingServices || 0}</span></div>
            <div className="flex justify-between"><span>Delivered</span><span className="font-medium">{serviceStats?.deliveredServices || 0}</span></div>
            <div className="flex justify-between"><span>Avg Order</span><span className="font-medium">${serviceStats?.averageServiceValue?.toFixed(2) || "0.00"}</span></div>
          </div>
        </CardContent></Card>
      </div>

      <Card><CardContent className="p-4"><h3 className="font-semibold text-gray-900 mb-3">Booking Sources</h3>
        <div className="space-y-2 text-sm">
          {Object.entries(topSources || {}).map(([source, count]) => (
            <div key={source} className="flex justify-between"><span>{source.replace("_", " ")}</span><span className="font-medium">{String(count)}</span></div>
          ))}
          {Object.keys(topSources || {}).length === 0 && <p className="text-gray-500">No bookings yet.</p>}
        </div>
      </CardContent></Card>
    </div>
  );
}

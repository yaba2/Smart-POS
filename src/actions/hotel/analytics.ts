"use server";

import { prisma } from "@/lib/prisma";

export async function getHotelAnalytics(days = 30) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [rooms, stays, services, folioItems] = await Promise.all([
      prisma.room.findMany({
        include: { stays: { where: { status: "CHECKED_IN" } } },
      }),
      prisma.stay.findMany({
        where: { createdAt: { gte: since } },
        include: { room: true, guest: true },
      }),
      prisma.roomService.findMany({
        where: { createdAt: { gte: since } },
        include: { room: true, stay: { include: { guest: true } } },
      }),
      prisma.folioItem.findMany({
        where: { createdAt: { gte: since } },
      }),
    ]);

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.status === "OCCUPIED").length;
    const dirtyRooms = rooms.filter((r) => r.status === "DIRTY").length;
    const maintenanceRooms = rooms.filter((r) => r.status === "MAINTENANCE").length;
    const availableRooms = rooms.filter((r) => r.status === "AVAILABLE").length;
    const occupancyRate = totalRooms ? (occupiedRooms / totalRooms) * 100 : 0;

    const checkedIn = stays.filter((s) => s.status === "CHECKED_IN").length;
    const checkedOut = stays.filter((s) => s.status === "CHECKED_OUT").length;
    const upcoming = stays.filter((s) => s.status === "UPCOMING").length;

    const roomRevenue = folioItems
      .filter((f) => f.type === "CHARGE" && f.category === "ROOM")
      .reduce((sum, f) => sum + f.amount, 0);
    const serviceRevenue = folioItems
      .filter((f) => f.type === "CHARGE" && f.category === "FB")
      .reduce((sum, f) => sum + f.amount, 0);
    const lateFeeRevenue = folioItems
      .filter((f) => f.type === "CHARGE" && f.category === "LATE_FEE")
      .reduce((sum, f) => sum + f.amount, 0);
    const totalRevenue = folioItems
      .filter((f) => f.type === "CHARGE")
      .reduce((sum, f) => sum + f.amount, 0);
    const totalPayments = folioItems
      .filter((f) => f.type === "PAYMENT")
      .reduce((sum, f) => sum + f.amount, 0);

    const pendingServices = services.filter((s) => s.status !== "DELIVERED").length;
    const deliveredServices = services.filter((s) => s.status === "DELIVERED").length;
    const averageServiceValue = services.length
      ? services.reduce((sum, s) => sum + s.total, 0) / services.length
      : 0;

    const topSources: Record<string, number> = {};
    stays.forEach((s) => {
      topSources[s.bookingSource] = (topSources[s.bookingSource] || 0) + 1;
    });

    return {
      success: true,
      analytics: {
        roomStats: { totalRooms, occupiedRooms, availableRooms, dirtyRooms, maintenanceRooms, occupancyRate },
        stayStats: { total: stays.length, checkedIn, checkedOut, upcoming },
        revenue: { roomRevenue, serviceRevenue, lateFeeRevenue, totalRevenue, totalPayments, balance: totalRevenue - totalPayments },
        serviceStats: { total: services.length, pendingServices, deliveredServices, averageServiceValue },
        topSources,
      },
    };
  } catch (e) {
    return { error: "Failed to load hotel analytics" };
  }
}

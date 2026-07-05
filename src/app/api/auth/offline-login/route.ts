import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Called by PosLoginClient when the DB is unreachable.
// The client has already verified the PIN against IndexedDB — this route just
// writes the iron-session cookie so the rest of the app treats the user as logged in.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, role, permissions } = body as {
      userId: string;
      name: string;
      role: "WAITER" | "CASHIER" | "MANAGER" | "SUPERVISOR";
      permissions: string[];
    };

    if (!userId || !name || !role) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const session = await getSession();
    session.userId = userId;
    session.name = name;
    session.role = role;
    session.permissions = permissions;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true, name, role });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Offline login failed" },
      { status: 500 }
    );
  }
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  if (session.isLoggedIn) {
    if (session.role === "ADMIN") {
      redirect("/admin/dashboard");
    } else {
      redirect("/pos/tables");
    }
  }

  redirect("/pos/login");
}

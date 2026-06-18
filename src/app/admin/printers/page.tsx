import { getPrinters } from "@/actions/printers";
import { PrintersClient } from "@/components/admin/printers-client";

export const metadata = {
  title: "Printers - Admin",
};

export default async function PrintersPage() {
  const printers = await getPrinters();

  return (
    <div className="p-6">
      <PrintersClient printers={printers} />
    </div>
  );
}

import { requireStrictAdmin } from "@/lib/auth";
import { getSettings } from "@/actions/settings";
import { SettingsClient } from "@/components/admin/settings-client";

export default async function AdminSettingsPage() {
  await requireStrictAdmin();
  const settings = await getSettings();
  return <SettingsClient settings={settings} />;
}

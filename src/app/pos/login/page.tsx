import { getSettings } from "@/actions/settings";
import { PosLoginClient } from "@/components/pos/pos-login-client";

export default async function PosLoginPage() {
  const settings = await getSettings();
  return (
    <PosLoginClient
      restaurantName={settings.restaurantName}
      logo={settings.logo ?? null}
      address={settings.address ?? null}
      phone={settings.phone ?? null}
    />
  );
}

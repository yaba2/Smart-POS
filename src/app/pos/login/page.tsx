import { getSettings } from "@/actions/settings";
import { PosLoginClient } from "@/components/pos/pos-login-client";

export default async function PosLoginPage() {
  let restaurantName = "POS";
  let logo: string | null = null;
  let address: string | null = null;
  let phone: string | null = null;

  try {
    const settings = await getSettings();
    restaurantName = settings.restaurantName;
    logo = settings.logo ?? null;
    address = settings.address ?? null;
    phone = settings.phone ?? null;
  } catch {
    // DB unreachable (offline)
  }

  return (
    <PosLoginClient
      restaurantName={restaurantName}
      logo={logo}
      address={address}
      phone={phone}
    />
  );
}

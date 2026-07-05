import { getFullOrder } from "@/actions/orders";
import { getAvailableMenu } from "@/actions/menu";
import { getSettings } from "@/actions/settings";
import { getPaymentMethods } from "@/actions/payment-methods";
import { requireWaiter } from "@/lib/auth";
import { OrderClient } from "@/components/pos/order-client";

export default async function OrderPage({ params }: { params: { id: string } }) {
  const session = await requireWaiter();

  // Fetch from DB; if offline, fall back to empty props — IndexedDB in OrderClient takes over
  let order: Awaited<ReturnType<typeof getFullOrder>> = null;
  let menu: Awaited<ReturnType<typeof getAvailableMenu>> = [];
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  let paymentMethods: Awaited<ReturnType<typeof getPaymentMethods>> = [];

  try {
    [order, menu, settings, paymentMethods] = await Promise.all([
      getFullOrder(params.id),
      getAvailableMenu(),
      getSettings(),
      getPaymentMethods(),
    ]);
  } catch {
    // DB unreachable (offline) — OrderClient will load from IndexedDB
  }

  const defaultSettings = {
    currencySymbol: "$",
    tax: 0,
    restaurantName: "",
    address: null,
    phone: null,
    receiptHeader: null,
    receiptFooter: null,
    receiptLogo: null,
    printServerIp: null,
  };
  const s = settings ?? defaultSettings;

  return (
    <OrderClient
      order={order ?? undefined}
      orderId={params.id}
      menu={menu}
      currencySymbol={s.currencySymbol}
      taxRate={s.tax}
      permissions={session.permissions || []}
      paymentMethods={paymentMethods.filter((m) => m.active)}
      receiptSettings={{
        restaurantName: s.restaurantName,
        address: s.address || undefined,
        phone: s.phone || undefined,
        receiptHeader: s.receiptHeader || undefined,
        receiptFooter: s.receiptFooter || undefined,
        receiptLogo: s.receiptLogo || undefined,
      }}
      printServerIp={s.printServerIp || undefined}
    />
  );
}

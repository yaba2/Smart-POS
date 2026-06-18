import { notFound } from "next/navigation";
import { getFullOrder } from "@/actions/orders";
import { getAvailableMenu } from "@/actions/menu";
import { getSettings } from "@/actions/settings";
import { getPaymentMethods } from "@/actions/payment-methods";
import { requireWaiter } from "@/lib/auth";
import { OrderClient } from "@/components/pos/order-client";

export default async function OrderPage({ params }: { params: { id: string } }) {
  const session = await requireWaiter();
  const [order, menu, settings, paymentMethods] = await Promise.all([
    getFullOrder(params.id),
    getAvailableMenu(),
    getSettings(),
    getPaymentMethods(),
  ]);

  if (!order) notFound();

  return (
    <OrderClient
      order={order}
      menu={menu}
      currencySymbol={settings.currencySymbol}
      taxRate={settings.tax}
      permissions={session.permissions || []}
      paymentMethods={paymentMethods.filter((m) => m.active)}
      receiptSettings={{
        restaurantName: settings.restaurantName,
        address: settings.address || undefined,
        phone: settings.phone || undefined,
        receiptHeader: settings.receiptHeader || undefined,
        receiptFooter: settings.receiptFooter || undefined,
      }}
    />
  );
}

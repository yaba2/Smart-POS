import { getPaymentMethods } from "@/actions/payment-methods";
import { PaymentMethodsClient } from "@/components/admin/payment-methods-client";

export const metadata = {
  title: "Payment Methods - Admin",
};

export default async function PaymentMethodsPage() {
  const methods = await getPaymentMethods();

  return (
    <div className="p-6">
      <PaymentMethodsClient methods={methods} />
    </div>
  );
}

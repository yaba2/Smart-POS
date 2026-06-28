"use client";

import { useState, useEffect } from "react";
import { getCustomerCredits, recordCustomerCreditPayment, markCustomerCreditPaid } from "@/actions/customer-credits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Search, X, CreditCard, User, DollarSign, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { CreditStatus } from "@prisma/client";

interface CustomerCreditsClientProps {
  currencySymbol: string;
  canManage: boolean;
}

const STATUS_LABELS: Record<CreditStatus, string> = {
  PENDING: "Pending",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
};

const STATUS_COLORS: Record<CreditStatus, string> = {
  PENDING: "bg-red-100 text-red-700 hover:bg-red-100",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  PAID: "bg-green-100 text-green-700 hover:bg-green-100",
};

function formatMoney(n: number, sym: string) {
  return `${sym}${n.toFixed(2)}`;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

export function CustomerCreditsClient({ currencySymbol, canManage }: CustomerCreditsClientProps) {
  const sym = currencySymbol || "$";
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CreditStatus | "ALL">("ALL");
  const [selectedCredit, setSelectedCredit] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const loadData = async () => {
    setLoading(true);
    const res = await getCustomerCredits();
    if (res.error) {
      toast({ title: "Error", description: String(res.error), variant: "destructive" });
    } else {
      setCredits(res.credits || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleMarkPaid = async (credit: any) => {
    const result = await markCustomerCreditPaid(credit.id);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Credit marked as paid", variant: "success" });
      loadData();
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredit) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    const result = await recordCustomerCreditPayment(selectedCredit.id, amount);
    if (result.error) {
      toast({ title: "Error", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Payment recorded", variant: "success" });
      setSelectedCredit(null);
      setPaymentAmount("");
      loadData();
    }
  };

  const filteredCredits = credits.filter((c) => {
    const matchesSearch =
      c.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.customer.phone && c.customer.phone.includes(search));
    const matchesStatus = filter === "ALL" || c.status === filter;
    return matchesSearch && matchesStatus;
  });

  const totalPending = credits
    .filter((c) => c.status !== "PAID")
    .reduce((sum, c) => sum + (c.originalAmount - c.paidAmount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["ALL", "PENDING", "PARTIALLY_PAID", "PAID"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              {f === "ALL" ? "All" : STATUS_LABELS[f]}
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-orange-50 border-orange-100">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Total outstanding credit</span>
          </div>
          <span className="text-xl font-bold text-orange-600">{formatMoney(totalPending, sym)}</span>
        </CardContent>
      </Card>

      {filteredCredits.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No credit records found</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredCredits.map((credit) => {
          const remaining = credit.originalAmount - credit.paidAmount;
          return (
            <Card key={credit.id} className={credit.status === "PAID" ? "opacity-70" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{credit.customer.name}</span>
                      <Badge className={STATUS_COLORS[credit.status as CreditStatus]}>{STATUS_LABELS[credit.status as CreditStatus]}</Badge>
                    </div>
                    <div className="text-sm text-gray-500 space-y-0.5">
                      <div>Order #{credit.order.id.slice(-6).toUpperCase()} • {fmtDate(credit.createdAt)}</div>
                      {credit.customer.phone && <div>Phone: {credit.customer.phone}</div>}
                      {credit.notes && <div className="text-gray-400">{credit.notes}</div>}
                    </div>
                  </div>
                  <div className="text-right min-w-[140px]">
                    <div className="text-sm text-gray-500">Original</div>
                    <div className="font-semibold text-gray-900">{formatMoney(credit.originalAmount, sym)}</div>
                    {credit.paidAmount > 0 && (
                      <div className="text-sm text-green-600 mt-1">
                        Paid: {formatMoney(credit.paidAmount, sym)}
                      </div>
                    )}
                    {credit.status !== "PAID" && (
                      <div className="text-sm text-red-600 mt-1">
                        Remaining: {formatMoney(remaining, sym)}
                      </div>
                    )}
                  </div>
                  {canManage && credit.status !== "PAID" && (
                    <div className="flex flex-col gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(credit)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Paid
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedCredit(credit); setPaymentAmount(remaining.toFixed(2)); }}>
                        <DollarSign className="w-4 h-4 mr-1" /> Partial Pay
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Record Partial Payment</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCredit(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="mb-4 text-sm text-gray-600">
              <div>Customer: <span className="font-medium text-gray-900">{selectedCredit.customer.name}</span></div>
              <div>Original: {formatMoney(selectedCredit.originalAmount, sym)}</div>
              <div>Remaining: {formatMoney(selectedCredit.originalAmount - selectedCredit.paidAmount, sym)}</div>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="space-y-1">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCredit.originalAmount - selectedCredit.paidAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedCredit(null)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">Record Payment</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

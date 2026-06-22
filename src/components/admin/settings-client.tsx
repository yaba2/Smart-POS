"use client";

import { useState } from "react";
import { updateSettings } from "@/actions/settings";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, Store, DollarSign, Receipt, ImageIcon, AlignCenter, Eye, Printer, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Settings {
  id: string;
  restaurantName: string;
  logo: string | null;
  receiptLogo: string | null;
  currency: string;
  currencySymbol: string;
  tax: number;
  receiptHeader: string | null;
  receiptFooter: string | null;
  address: string | null;
  phone: string | null;
  printServerIp: string | null;
}

interface SettingsClientProps {
  settings: Settings;
}

export function SettingsClient({ settings }: SettingsClientProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    restaurantName: settings.restaurantName,
    logo: settings.logo || "",
    receiptLogo: settings.receiptLogo || "",
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    tax: String(settings.tax),
    address: settings.address || "",
    phone: settings.phone || "",
    receiptHeader: settings.receiptHeader || "",
    receiptFooter: settings.receiptFooter || "",
    printServerIp: settings.printServerIp || "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettings({
        restaurantName: form.restaurantName,
        logo: form.logo || undefined,
        receiptLogo: form.receiptLogo || undefined,
        currency: form.currency,
        currencySymbol: form.currencySymbol,
        tax: Number(form.tax),
        address: form.address || undefined,
        phone: form.phone || undefined,
        receiptHeader: form.receiptHeader || undefined,
        receiptFooter: form.receiptFooter || undefined,
        printServerIp: form.printServerIp || undefined,
      });
      toast({ title: "Settings saved successfully" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const headerLines = form.receiptHeader.split("\n").filter(Boolean);
  const footerLines = form.receiptFooter.split("\n").filter(Boolean);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurant Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure restaurant details and receipt design</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="w-4 h-4" />
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN — Settings */}
        <div className="space-y-6">

          {/* Restaurant Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <Store className="w-4 h-4" /> Restaurant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Restaurant Name</Label>
                <Input value={form.restaurantName} onChange={set("restaurantName")} placeholder="Smart POS Restaurant" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={set("address")} placeholder="123 Main Street, City" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={set("phone")} placeholder="+1 (555) 123-4567" />
              </div>
            </CardContent>
          </Card>

          {/* Currency & Tax */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <DollarSign className="w-4 h-4" /> Currency & Tax
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency Code</Label>
                  <Input value={form.currency} onChange={set("currency")} placeholder="USD" maxLength={3} />
                </div>
                <div className="space-y-2">
                  <Label>Currency Symbol</Label>
                  <Input value={form.currencySymbol} onChange={set("currencySymbol")} placeholder="$" maxLength={3} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input type="number" min="0" max="100" step="0.1" value={form.tax} onChange={set("tax")} placeholder="8" />
                <p className="text-xs text-gray-400">Enter 0 for no tax</p>
              </div>
            </CardContent>
          </Card>

          {/* Print Server */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <Printer className="w-4 h-4" /> Print Server
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Print Server IP Address</Label>
                <Input
                  value={form.printServerIp}
                  onChange={set("printServerIp")}
                  placeholder="192.168.1.100"
                />
                <p className="text-xs text-gray-400">
                  Local IP of the computer running the print server (e.g. <code>192.168.1.100</code>).
                  Run <code>ipconfig</code> on that PC to find it. Leave blank to use auto-detect.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Receipt Design */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                <Receipt className="w-4 h-4" /> Receipt Design
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Receipt Logo Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-gray-400" /> Bill Printer Logo
                </Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Upload logo image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 200 * 1024) {
                          alert("Image too large — please use an image under 200KB");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setForm((f) => ({ ...f, receiptLogo: reader.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {form.receiptLogo && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, receiptLogo: "" }))}
                      className="p-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {form.receiptLogo && (
                  <div className="flex items-center gap-3 p-2 border rounded-lg bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.receiptLogo}
                      alt="Receipt logo preview"
                      className="h-12 w-auto object-contain rounded"
                    />
                    <span className="text-xs text-gray-500">Logo ready — will print on bill header</span>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  Upload your restaurant logo (PNG/JPG, max 200KB). Prints at the top of the customer bill.
                </p>
              </div>

              {/* Header Text */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlignCenter className="w-3.5 h-3.5 text-gray-400" /> Header Text
                </Label>
                <Textarea
                  value={form.receiptHeader}
                  onChange={set("receiptHeader")}
                  placeholder={"Welcome!\nBest food in town\nOpen 7 days a week"}
                  rows={4}
                />
                <p className="text-xs text-gray-400">
                  Each line prints centered below the restaurant name. Use this for taglines, WiFi password, offers, etc.
                </p>
              </div>

              {/* Footer Text */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlignCenter className="w-3.5 h-3.5 text-gray-400" /> Footer Text
                </Label>
                <Textarea
                  value={form.receiptFooter}
                  onChange={set("receiptFooter")}
                  placeholder={"Thank you for dining with us!\nVisit us again soon!"}
                  rows={3}
                />
                <p className="text-xs text-gray-400">
                  Printed at the bottom of the receipt after the total. Each line is centered.
                </p>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN — Live Preview */}
        <div className="lg:sticky lg:top-6 self-start">
          <Card className="border border-dashed border-gray-300 bg-gray-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-500">
                <Eye className="w-4 h-4" /> Receipt Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {/* Thermal receipt mock */}
              <div
                className="bg-white mx-auto rounded shadow-sm p-4 font-mono text-[11px] leading-tight"
                style={{ width: "100%", maxWidth: 300 }}
              >
                {/* Logo */}
                {(form.receiptLogo || form.logo) && (
                  <div className="flex justify-center mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.receiptLogo || form.logo}
                      alt="logo"
                      className="h-14 w-auto object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}

                {/* Restaurant name */}
                <p className="text-center font-bold text-sm tracking-wide uppercase">
                  {form.restaurantName || "RESTAURANT NAME"}
                </p>

                {/* Address / phone */}
                {form.address && <p className="text-center text-gray-500">{form.address}</p>}
                {form.phone && <p className="text-center text-gray-500">{form.phone}</p>}

                {/* Header lines */}
                {headerLines.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {headerLines.map((line, i) => (
                      <p key={i} className="text-center text-gray-600 italic">{line}</p>
                    ))}
                  </div>
                )}

                <div className="border-t border-dashed border-gray-300 my-2" />

                {/* Table / order info */}
                <p>Table: A1</p>
                <p>Order #: 000123</p>
                <p>Server: Ahmed</p>

                <div className="border-t border-dashed border-gray-300 my-2" />

                {/* Sample items */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>2x Grilled Chicken</span>
                    <span>{form.currencySymbol || "$"}18.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Caesar Salad</span>
                    <span>{form.currencySymbol || "$"}8.50</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                {/* Totals */}
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal:</span>
                  <span>{form.currencySymbol || "$"}26.50</span>
                </div>
                {Number(form.tax) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tax ({form.tax}%):</span>
                    <span>{form.currencySymbol || "$"}{(26.5 * Number(form.tax) / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold mt-1">
                  <span>TOTAL:</span>
                  <span>
                    {form.currencySymbol || "$"}
                    {(26.5 * (1 + Number(form.tax) / 100)).toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                <p className="text-center text-gray-500">Payment: CASH</p>

                {/* Footer lines */}
                {footerLines.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {footerLines.map((line, i) => (
                      <p key={i} className="text-center text-gray-500 italic">{line}</p>
                    ))}
                  </div>
                )}

                {/* Cut indicator */}
                <div className="flex items-center gap-1 mt-3 text-gray-300">
                  <div className="flex-1 border-t border-dashed" />
                  <span className="text-xs">✂</span>
                  <div className="flex-1 border-t border-dashed" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

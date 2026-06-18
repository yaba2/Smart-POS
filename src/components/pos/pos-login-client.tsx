"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginWithPin } from "@/actions/auth";
import { toast } from "@/components/ui/use-toast";
import { Delete, UtensilsCrossed, MapPin, Phone } from "lucide-react";

interface PosLoginClientProps {
  restaurantName: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
}

export function PosLoginClient({ restaurantName, logo, address, phone }: PosLoginClientProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) setPin((prev) => prev + key);
  };

  const handleDelete = () => setPin((prev) => prev.slice(0, -1));

  const handleLogin = async () => {
    if (pin.length !== 4) {
      toast({ title: "Enter 4-digit PIN", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithPin(pin);
      if (result.error) {
        toast({ title: result.error, variant: "destructive" });
        setPin("");
      } else {
        toast({ title: `Welcome, ${result.name}!` });
        router.push("/pos/tables");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const numKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-800 to-orange400 p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/10" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-white/10" />
      <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-white/5" />

      {/* Two panels side by side with gap */}
      <div className="relative z-10 flex items-stretch w-full "  style={{paddingRight: '15px'}}>

        {/* ── LEFT PANEL: Branding (semi-transparent, square) ── */}
        <div className="hidden md:flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl p-16 text-white" style={{width: '820px',  flexShrink: 0}}>
          <div className="flex flex-col items-center text-center gap-5">
            {/* Logo — square shape */}
            {logo ? (
              <div className="w-40 h-40 rounded-xl overflow-hidden border-4 border-white/40 bg-white/30 shadow-xl flex items-center justify-center">
                <Image src={logo} alt={restaurantName} width={160} height={160} className="object-contain" />
              </div>
            ) : (
              <div className="w-40 h-40 rounded-xl bg-white/20 border-4 border-white/40 flex items-center justify-center shadow-xl">
                <UtensilsCrossed className="w-20 h-20 text-white" />
              </div>
            )}

            <div>
              <h1 className="text-4xl font-extrabold tracking-tight leading-tight drop-shadow">{restaurantName}</h1>
              <p className="text-white/80 text-base mt-2 font-light">Point of Sale System</p>
            </div>

            {(address || phone) && (
              <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/20 w-full">
                {address && (
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{address}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{phone}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-white/50 text-xs mt-4">Powered by LavelUP IT Solutions</p>
          </div>
        </div>

        {/* ── RIGHT PANEL: PIN entry (white, extends right) ── */}
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl py-12 px-14 shadow-2xl ml-auto" style={{width: '480px', flexShrink: 0}}>

          {/* Mobile-only logo */}
          <div className="flex md:hidden flex-col items-center mb-8">
            {logo ? (
              <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-orange-200 bg-white flex items-center justify-center mb-3">
                <Image src={logo} alt={restaurantName} width={80} height={80} className="object-contain" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl bg-orange-100 flex items-center justify-center mb-3">
                <UtensilsCrossed className="w-10 h-10 text-orange-500" />
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900">{restaurantName}</h1>
          </div>

          <div className="w-full max-w-[340px]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Staff Login</h2>
              <p className="text-gray-400 text-sm mt-1">Enter your 4-digit PIN</p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-150 ${
                    i < pin.length
                      ? "border-orange-500 bg-orange-50 text-orange-500 scale-105"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  {i < pin.length ? "●" : ""}
                </div>
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {numKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  disabled={loading}
                  className="h-14 bg-gray-50 hover:bg-orange-50 hover:text-orange-600 border border-gray-200 rounded-xl text-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
                >
                  {key}
                </button>
              ))}

              <button
                onClick={handleDelete}
                disabled={loading}
                className="h-14 bg-gray-50 hover:bg-red-50 hover:text-red-500 border border-gray-200 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              >
                <Delete className="w-5 h-5" />
              </button>

              <button
                onClick={() => handleKeyPress("0")}
                disabled={loading}
                className="h-14 bg-gray-50 hover:bg-orange-50 hover:text-orange-600 border border-gray-200 rounded-xl text-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                0
              </button>

              <button
                onClick={handleLogin}
                disabled={loading || pin.length !== 4}
                className="h-14 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed"
              >
                {loading ? <span className="spinner" /> : "LOGIN"}
              </button>
            </div>

            <div className="mt-8 text-center">
              <a href="/admin/login" className="text-xs text-gray-400 hover:text-orange-500 transition-colors">
                Admin Login →
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useFrappeAuth } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";


// ---- typy ----
type FridayToken = {
  id: string;
  issuedYear: number;
  minutesRemaining: number;
  status: "active" | "spent" | "listed";
};

type FridayBalance = {
  userId: string;
  totalMinutes: number;
  tokens: FridayToken[];
};

type SupplyInfo = {
  year: number;
  priceEur: number;
  treasuryAvailable: number;
  totalMinted: number;
  totalSold: number;
};


type Listing = {
  id: string;
  tokenId: string;
  sellerId: string;
  priceEur: number;
  status: "open" | "sold" | "cancelled";
  createdAt: string;
  token: FridayToken;
};
type HistoryItem = {
  id: string;
  type: "purchase" | "trade";
  direction: "buy" | "sell";
  price: number;
  year: number;
  createdAt: string | Date;
};

// --- OPRAVENÝ INTERFACE PRE CALL LOG ---
interface CallLog {
    name: string;
    klient: string;
    poradca: string;
    kto_volal: "Klient" | "Poradca"; // Pridané nové pole
    zaciatok_datum: string;
    zaciatok_cas: string;
    koniec_datum?: string;
    koniec_cas?: string;
    trvanie_s?: number;
    pouzity_token?: string;
}

function BurzaTokenovInner() {
  const { user, isSignedIn, ready, token, signOut } = useFrappeAuth();
  const router = useRouter();
  const search = useSearchParams();

  // poradca = admin práva (mint/cena); klient = klientske taby
  const role = user?.role === "advisor" ? "admin" : "client";
  const email = user?.email ?? null;

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const frappeBase = `${process.env.NEXT_PUBLIC_FRAPPE_URL}/api/method/bcservices.api`;

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [supply, setSupply] = useState<SupplyInfo | null>(null);

  const [balance, setBalance] = useState<FridayBalance | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [qty, setQty] = useState<number>(1);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mintSheetOpen, setMintSheetOpen] = useState(false);
  const [mintQty, setMintQty] = useState<number>(1);
  const [mintPrice, setMintPrice] = useState<number>(450);
  const [mintYear, setMintYear] = useState<number>(currentYear);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // State pre hovory
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  // --- FETCH HISTORY ---
  const fetchHistory = useCallback(async () => {
    if (!email) return;
    const res = await fetch(
      `${frappeBase}.market.history?userId=${encodeURIComponent(email)}`
    );
    const data = await res.json();
    const msg = data?.message;

    if (msg?.success && Array.isArray(msg.items)) {
      setHistory(
        msg.items.map((tx: HistoryItem) => ({
          ...tx,
          createdAt: new Date(tx.createdAt),
        }))
      );
    }
  }, [email, frappeBase]);

  // --- FETCH CALL LOGS (OPRAVENÉ) ---
  const fetchCallLogs = useCallback(async () => {
    if (!email) return;
    try {
      const res = await fetch(
        `${frappeBase}.market.call_logs?userId=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (data?.message?.success) {
        setCallLogs(data.message.items);
      }
    } catch (e) {
      console.error("Chyba pri načítaní hovorov:", e);
    }
  }, [email, frappeBase]);

  useEffect(() => {
    if (isSignedIn && role !== "admin") {
      fetchHistory();
      fetchCallLogs(); // Spustí načítanie hovorov
    }
  }, [isSignedIn, role, fetchHistory, fetchCallLogs]);


  // drawer – kúpa
  const [buySheetOpen, setBuySheetOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  // či kupujem z pokladnice
  const [buyFromTreasury, setBuyFromTreasury] = useState(false);

  // drawer – odpredaj
  const [sellSheetOpen, setSellSheetOpen] = useState(false);
  const [sellPrice, setSellPrice] = useState<number>(450);
  const [sellQty, setSellQty] = useState<number>(1);

  // === odvodené ===
  const tokensActive = useMemo(
    () =>
      (balance?.tokens || []).filter(
        (t) => t.status === "active" && t.minutesRemaining === 60
      ),
    [balance]
  );

  const ownedThisYear = useMemo(
    () =>
      (balance?.tokens || []).filter(
        (t) =>
          t.issuedYear === currentYear &&
          (t.status === "active" || t.status === "listed")
      ).length,
    [balance, currentYear]
  );
  const maxCanBuy = Math.max(0, 20 - ownedThisYear);

  // === FETCHY ========================================================
  const fetchSupply = useCallback(async () => {
    const res = await fetch(`${backend}/friday/supply?year=${currentYear}`);
    const data = (await res.json()) as SupplyInfo;
    setSupply(data);
  }, [backend, currentYear]);

  const fetchBalance = useCallback(async () => {
    if (!email) return;

    const res = await fetch(
      `${frappeBase}.user.balance?userId=${encodeURIComponent(email)}`,
      {
        headers: {
          "X-Clerk-Authorization": `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    const msg = data?.message;

    if (msg?.userId) {
      setBalance({
        userId: msg.userId,
        totalMinutes: msg.totalMinutes,
        tokens: msg.tokens,
      });
    }
  }, [email, token, frappeBase]);

  const fetchListings = useCallback(async () => {
    const res = await fetch(`${frappeBase}.market.listings`);
    const data = await res.json();
    const msg = data?.message;

    if (msg?.success) {
      setListings(msg.items);
    }
  }, [frappeBase]);

  // sync user (Stripe/friday backend)
  useEffect(() => {
    const init = async () => {
      if (!isSignedIn || !email) return;
      try {
        await fetch(`${backend}/friday/sync-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (e) {
        console.error("sync-user FE error:", e);
      }
    };
    init();
  }, [isSignedIn, email, backend, token]);

  useEffect(() => {
    fetchSupply();
    fetchListings();
    if (isSignedIn && role !== "admin") fetchBalance();
  }, [isSignedIn, role, fetchSupply, fetchBalance, fetchListings]);

  // === nákup z pokladnice (1 token) ======================
  const handlePrimaryBuy = useCallback(
    async (quantity = 1) => {
      if (!email || !supply) return;

      if (quantity > maxCanBuy) {
        alert(`Maximálne môžeš dokúpiť ešte ${maxCanBuy} tokenov pre rok ${currentYear}.`);
        return;
      }
      if (quantity > (supply.treasuryAvailable ?? 0)) {
        alert("Nie je dostatok tokenov v pokladnici.");
        return;
      }

      const res = await fetch(`${backend}/friday/payments/checkout/treasury`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: email,
          quantity,
          year: currentYear,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url;
      } else {
        alert(data?.message || "Vytvorenie platby zlyhalo.");
      }
    },
    [backend, email, supply, maxCanBuy, currentYear]
  );

  // === nákup z burzy ======================
  const handleBuyListing = useCallback(
    async (listingId: string) => {
      if (!email) return;
      try {
        setBuyingId(listingId);
        const res = await fetch(`${backend}/friday/payments/checkout/listing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyerId: email, listingId }),
        });
        const data = await res.json();
        if (res.ok && data?.url) {
          window.location.href = data.url;
        } else {
          alert(data?.message || "Kúpa zlyhala.");
        }
      } finally {
        setBuyingId(null);
        setBuySheetOpen(false);
      }
    },
    [backend, email]
  );

  // === návrat zo Stripe ===================
  const searchStatus = search.get("payment");
  useEffect(() => {
    if (!searchStatus) return;
    if (searchStatus === "success") {
      Promise.allSettled([fetchBalance(), fetchSupply(), fetchListings()]);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [searchStatus, router, fetchBalance, fetchListings, fetchSupply]);

  // === odpredaj – klient zalistuje token =========================
  const handleClientListTokens = useCallback(async () => {
    if (!email || !balance) return;

    const safePrice = isNaN(sellPrice) ? 450 : sellPrice;

    const sellableTokens = (balance.tokens || []).filter(
      (t) => t.status === "active" && t.minutesRemaining === 60
    );

    const countToList = Math.min(sellQty, sellableTokens.length);

    for (let i = 0; i < countToList; i++) {
      const tkn = sellableTokens[i];
      await fetch(
        `${frappeBase}.market.list_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Clerk-Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            sellerId: email,
            tokenId: tkn.id,
            priceEur: safePrice,
          }),
        }
      );
    }

    await Promise.all([fetchBalance(), fetchListings()]);
    setSellSheetOpen(false);
  }, [email, balance, sellQty, sellPrice, fetchBalance, fetchListings, token, frappeBase]);


  // === admin akcie =============================
  const handleAdminMint = useCallback(async () => {
    if (role !== "admin") return;

    const res = await fetch(
      `${frappeBase}.admin.admin_mint`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Clerk-Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity: mintQty,
          priceEur: mintPrice,
          year: mintYear,
        }),
      }
    );

    const data = await res.json();

    if (res.ok && data?.message?.success) {
      setStatusMessage(`Vytvorených ${mintQty} tokenov pre rok ${mintYear}.`);
      setTimeout(() => setStatusMessage(null), 3500);

      await fetchSupply();
      setMintSheetOpen(false);
    } else {
      setStatusMessage("Mint zlyhal.");
      setTimeout(() => setStatusMessage(null), 3500);
    }
  }, [role, mintQty, mintPrice, mintYear, fetchSupply, token, frappeBase]);


  const handleAdminSetPrice = useCallback(async () => {
    if (role !== "admin") return;

    const priceStr = prompt("Nová cena v pokladnici (€):");
    const price = Number((priceStr || "").replace(",", "."));

    if (!Number.isFinite(price) || price <= 0) {
      setStatusMessage("Neplatná cena.");
      setTimeout(() => setStatusMessage(null), 3500);
      return;
    }

    const res = await fetch(
      `${frappeBase}.admin.admin_set_price`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Clerk-Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          newPrice: price,
          repriceTreasury: false,
        }),
      }
    );

    const data = await res.json();

    if (res.ok && data?.message?.success) {
      setStatusMessage(`Cena nastavená na ${price.toFixed(2)} €.`);
      setTimeout(() => setStatusMessage(null), 3500);

      await fetchSupply();
    } else {
      setStatusMessage("Zmena ceny zlyhala.");
      setTimeout(() => setStatusMessage(null), 3500);
    }
  }, [role, fetchSupply, token, frappeBase]);


  const handleCancelListing = useCallback(async (listingId: string) => {
    if (!confirm("Naozaj chcete stiahnuť tento token z predaja?")) return;

    try {
      const res = await fetch(
        `${frappeBase}.market.cancel_listing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Clerk-Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ listingId }),
        }
      );

      const data = await res.json();

      if (data?.message?.success) {
        await Promise.all([fetchBalance(), fetchListings()]);
      } else {
        alert(data?.message?.error || "Nepodarilo sa zrušiť inzerát.");
      }
    } catch (e) {
      console.error("Chyba pri rušení:", e);
      alert("Nastala chyba pri komunikácii so serverom.");
    }
  }, [token, frappeBase, fetchBalance, fetchListings]);

  // ==================== AUTH GUARD ====================
  if (!ready) {
    return <div className="p-6 text-center text-neutral-400">Načítavam…</div>;
  }
  if (!isSignedIn) {
    return <LoginForm />;
  }

  // ==================== RENDER ====================
  return (
    <main className="min-h-screen bg-white">
      {statusMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-5 py-3 rounded-full shadow-lg animate-fade-in z-50">
          {statusMessage}
        </div>
      )}

      {/* sticky header */}
      <header className="sticky top-0 z-30 w-full bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center">
              🪙
            </div>
            <span className="text-sm font-medium text-neutral-800">
              Tokeny
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 px-3 rounded-full border bg-white text-xs flex items-center gap-1 text-neutral-600">
              <span>🇸🇰</span>
            </div>
            <span className="hidden sm:inline text-xs text-neutral-500">
              {email}
            </span>
            <Button
              variant="outline"
              className="rounded-full h-8 px-4 text-xs"
              onClick={signOut}
            >
              Odhlásiť
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tokeny</h1>
          </div>
          <Button
            variant="outline"
            className="hidden"
            onClick={() => {
              fetchBalance();
              fetchListings();
              fetchSupply();
            }}
          >
          </Button>
        </div>

        <Tabs defaultValue="moje" className="space-y-5">
          <TabsList className="bg-transparent p-0 gap-3">

            {/* klientská sekcia */}
            {role !== "admin" && (
              <>
                <TabsTrigger
                  value="moje"
                  className="rounded-full bg-white text-neutral-900 px-6 py-2 text-sm border
                    border-neutral-200 data-[state=active]:bg-black data-[state=active]:text-white"
                >
                  Moje tokeny
                </TabsTrigger>

                <TabsTrigger
                  value="hovory"
                  className="rounded-full bg-white text-neutral-900 px-6 py-2 text-sm border
                    border-neutral-200 data-[state=active]:bg-black data-[state=active]:text-white"
                >
                  Záznam hovorov
                </TabsTrigger>
              </>
            )}

            {/* admin sekcia */}
            {role === "admin" && (
              <TabsTrigger
                value="admin"
                className="rounded-full bg-white text-neutral-900 px-6 py-2 text-sm border
                  border-neutral-200 data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Administrácia
              </TabsTrigger>
            )}
          </TabsList>

          {/* ============ TAB: HOVORY (OPRAVENÝ RENDER) ============ */}
          {role !== "admin" && (
            <TabsContent value="hovory">
              <Card className="bg-white border border-neutral-200 rounded-[28px] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Záznam hovorov</CardTitle>
                  <p className="text-xs text-neutral-400">Prehľad uskutočnených hovorov a čerpanie tokenov.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[1fr,1fr,80px,100px] text-[10px] uppercase tracking-wider text-neutral-400 pb-2 border-b">
                    <span>Začiatok</span>
                    <span>Koniec</span>
                    <span className="text-center">Trvanie</span>
                    <span className="text-right">Token</span>
                  </div>
                  <ScrollArea className="h-[400px]">
                    {callLogs.length === 0 ? (
                      <div className="py-10 text-center text-sm text-neutral-400">Žiadne záznamy o hovoroch</div>
                    ) : (
                      callLogs.map((log) => {
                        // Vytvorenie dátumov
                        const startDateTime = log.zaciatok_datum && log.zaciatok_cas
                            ? new Date(`${log.zaciatok_datum}T${log.zaciatok_cas}`)
                            : null;

                        const endDateTime = log.koniec_datum && log.koniec_cas
                            ? new Date(`${log.koniec_datum}T${log.koniec_cas}`)
                            : null;

                        // Určenie smeru hovoru (pre Klienta)
                        const isOutgoing = log.kto_volal === "Klient";

                        return (
                          <div key={log.name} className="grid grid-cols-[1fr,1fr,80px,100px] items-center py-4 text-sm border-b last:border-0 relative">
                            {/* Dátumy */}
                            <span className="text-neutral-700">
                              {startDateTime ? startDateTime.toLocaleString("sk-SK") : "?"}
                            </span>
                            <span className="text-neutral-700">
                              {endDateTime ? endDateTime.toLocaleString("sk-SK") : <span className="text-green-600 animate-pulse">Prebieha...</span>}
                            </span>

                            {/* Trvanie */}
                            <span className="text-center font-medium">
                              {log.trvanie_s ? `${Math.floor(log.trvanie_s / 60)}m ${log.trvanie_s % 60}s` : "--"}
                            </span>

                            {/* Token */}
                            <span className="text-right text-xs font-mono text-neutral-500">
                              {log.pouzity_token ? log.pouzity_token.slice(-6) : "---"}
                            </span>

                            {/* DETAIL HOVORU (Smer a meno) */}
                            <div className="col-span-4 mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", isOutgoing ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700")}>
                                    {isOutgoing ? "↘ Volali ste" : "↙ Volal vám"}
                                </span>
                                <span>
                                    {isOutgoing ? `poradcovi: ${log.poradca}` : `poradca: ${log.poradca}`}
                                </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TAB 2: MOJE TOKENY */}
            {role !== "admin" && (
              <TabsContent value="moje" className="space-y-5">
                <Card className="bg-white border border-neutral-200 rounded-[28px] shadow-sm">
                  <CardContent className="pt-6 pb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-neutral-400 mb-1">Moje tokeny</p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-semibold tracking-tight">
                          {balance?.totalMinutes
                            ? (balance.totalMinutes / 60).toFixed(2)
                            : "0,00"}
                        </span>
                        <span className="text-sm text-neutral-400">h</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        {tokensActive.length} pripravených na predaj
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {/*
                      <Button
                        variant="outline"
                        className="rounded-full h-9 px-5 text-sm"
                        onClick={() => {
                          setSellQty(1);
                          setSellPrice(supply?.priceEur ?? 450);
                          setSellSheetOpen(true);
                        }}
                        disabled={tokensActive.length === 0}
                      >
                        Zalistovať
                      </Button>
                      */}

                      {balance && balance.totalMinutes > 0 && tokensActive.length === 0 && (
                        <span className="text-[9px] text-orange-500 font-medium">
                          Iba celé tokeny (60m)
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

              {/* História transakcií */}
              <Card className="bg-white border border-neutral-200 rounded-[28px] shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    História transakcií
                  </CardTitle>
                  <p className="text-xs text-neutral-400">
                    Záznamy o nákupoch a predajoch tokenov.
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-[80px,1fr,90px] text-xs text-neutral-400 py-2 border-b">
                    <span>Dátum</span>
                    <span>Typ</span>
                    <span className="text-right">Suma</span>
                  </div>
                  <ScrollArea className="h-[280px]">
                    <div className="flex flex-col">
                      {history.length === 0 ? (
                        <div className="py-6 text-center text-neutral-400 text-sm">
                          Žiadne transakcie
                        </div>
                      ) : (
                        history.slice(0, 8).map((tx) => (
                          <div
                            key={tx.id}
                            className="grid grid-cols-[80px,1fr,90px] items-center py-3 text-sm border-b last:border-b-0"
                          >
                            <span className="text-neutral-500">
                              {new Date(tx.createdAt).toLocaleDateString("sk-SK")}
                            </span>

                            <div className="flex flex-col leading-tight">
                              <span className="font-medium text-neutral-800">
                                {tx.type === "purchase"
                                  ? "Nákup z pokladnice"
                                  : tx.direction === "sell"
                                  ? "Predaj tokenu"
                                  : "Nákup tokenu"}
                              </span>
                              <span className="text-xs text-neutral-400">
                                {tx.year} • {tx.id?.slice(0, 10)}…
                              </span>
                            </div>

                            <span
                              className={`text-right font-semibold ${
                                tx.direction === "sell"
                                  ? "text-emerald-500"
                                  : "text-red-500"
                              }`}
                            >
                              {tx.direction === "sell" ? "+" : "-"}
                              {tx.price.toFixed(2)} €
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            )}
            {/* TAB 3 — ADMIN PANEL (iba admin) */}
          {role === "admin" && (
            <TabsContent value="admin" className="space-y-5">
              <Card className="bg-white border border-neutral-200 rounded-[28px] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Administrácia tokenov</CardTitle>
                  <p className="text-xs text-neutral-400">Mintovanie a nastavenia pokladnice.</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="text-sm text-neutral-500">
                    <p>Cena tokenu: <strong>{supply?.priceEur} €</strong></p>
                    <p>Dostupné v pokladnici: <strong>{supply?.treasuryAvailable ?? 0}</strong></p>
                    <p>Rok: <strong>{currentYear}</strong></p>
                  </div>

                  <Button
                    className="w-full rounded-full bg-black text-white py-2"
                    onClick={() => setMintSheetOpen(true)}
                  >
                    🪙 Mintovať tokeny
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            )}
          </Tabs>


          <p className="text-[10px] text-neutral-400 mt-6">
            Token = právo na 60 min v piatok. Nevyužité tokeny sa prenášajú do ďalšieho roka.
          </p>
      </div>

      {/* ===== DRAWER: KÚPIŤ TOKEN ===== */}
      <Sheet open={buySheetOpen} onOpenChange={setBuySheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl px-6 py-6 max-w-md mx-auto"
        >
          <SheetHeader className="items-center">
            <div className="w-16 h-1.5 bg-neutral-200 rounded-full mb-4" />
            <SheetTitle>Kúpiť token</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-neutral-100 border flex items-center justify-center">
                🕒
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  Token
                </span>
                <span className="text-xs text-neutral-400">
                  {buyFromTreasury
                    ? `pokladnica ${currentYear}`
                    : selectedListing?.token?.id?.slice(0, 12)}
                  {!buyFromTreasury && selectedListing ? "…" : ""}
                </span>
              </div>
            </div>
            <div className="text-lg font-semibold tracking-tight">
              {buyFromTreasury
                ? supply
                  ? supply.priceEur.toFixed(2)
                  : "0.00"
                : selectedListing
                ? Number(selectedListing.priceEur).toFixed(2)
                : "0.00"}{" "}
              €
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              variant="default"
              className="w-full rounded-xl"
              onClick={() => {
                if (buyFromTreasury) {
                  handlePrimaryBuy(1);
                } else if (selectedListing) {
                  handleBuyListing(selectedListing.id);
                }
              }}
              disabled={
                (!buyFromTreasury && !selectedListing) ||
                (buyFromTreasury &&
                  (!supply || (supply?.treasuryAvailable ?? 0) <= 0))
              }
            >
              Kúpiť
            </Button>

            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full rounded-xl border-neutral-200"
              >
                Zrušiť
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== DRAWER: ODPREDAŤ TOKEN (CLIENT) ===== */}
      <Sheet open={sellSheetOpen} onOpenChange={setSellSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl px-6 py-6 max-w-md mx-auto"
        >
          <SheetHeader className="items-center">
            <div className="w-16 h-1.5 bg-neutral-200 rounded-full mb-4" />
            <SheetTitle>Odpredať token</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-400">Množstvo tokenov</p>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setSellQty((n) => Math.max(1, n - 1))}
                >
                  –
                </Button>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold">{sellQty}</span>
                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                    🕒 60 min
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setSellQty((n) => (n < tokensActive.length ? n + 1 : n))}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-400">Cena</p>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setSellPrice((p) => Math.max(1, p - 10))}
                >
                  –
                </Button>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">
                    {sellPrice}
                  </span>
                  <span className="text-sm text-neutral-500">€</span>
                </div>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setSellPrice((p) => p + 10)}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                variant="default"
                className="w-full rounded-xl"
                onClick={handleClientListTokens}
              >
                Pridať na burzu
              </Button>

              <SheetClose asChild>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-neutral-200"
                >
                  Zrušiť
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== DRAWER: ADMIN MINT ===== */}
      <Sheet open={mintSheetOpen} onOpenChange={setMintSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl px-6 py-6 max-w-md mx-auto"
        >
          <SheetHeader className="items-center">
            <div className="w-16 h-1.5 bg-neutral-200 rounded-full mb-4" />
            <SheetTitle>Mintovanie tokenov</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Počet tokenov */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-400">Počet tokenov</p>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setMintQty((n) => Math.max(1, n - 1))}
                >
                  –
                </Button>
                <span className="text-xl font-semibold">{mintQty}</span>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setMintQty((n) => n + 1)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Cena */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-400">Cena (€)</p>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setMintPrice((p) => Math.max(1, p - 10))}
                >
                  –
                </Button>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">{mintPrice}</span>
                  <span className="text-sm text-neutral-500">€</span>
                </div>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setMintPrice((p) => p + 10)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Rok */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-400">Rok</p>
              <div className="flex items-center gap-3 justify-center">
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setMintYear((y) => y - 1)}
                >
                  –
                </Button>
                <span className="text-xl font-semibold">{mintYear}</span>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setMintYear((y) => y + 1)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Potvrdiť */}
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className={cn("w-full rounded-xl", role === "admin" && "border-neutral-200")}
                onClick={handleAdminMint}
              >
                Vytvoriť tokeny
              </Button>

              <SheetClose asChild>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-neutral-200"
                >
                  Zrušiť
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </main>
  );
}

export default function BurzaTokenovPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Načítavam…</div>}>
      <BurzaTokenovInner />
    </Suspense>
  );
}

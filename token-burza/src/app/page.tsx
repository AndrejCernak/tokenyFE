"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  useUser,
  useAuth,
  UserButton,
} from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

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


function BurzaTokenovInner() {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  const role = (user?.publicMetadata.role as string) || "client";

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL!;
  // nahrad starú backend premennú
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


  const fetchHistory = useCallback(async () => {
  if (!user) return;

  const res = await fetch(`${backend}/friday/history/${user.id}`);
  const data = await res.json();

  if (data?.success && Array.isArray(data.items)) {
    setHistory(
  data.items.map((tx: HistoryItem) => ({
    ...tx,
    createdAt: new Date(tx.createdAt),
  }))
);

  }
}, [backend, user]);


  useEffect(() => {
    if (isSignedIn) fetchHistory();
  }, [isSignedIn, fetchHistory]);



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
        (t) => t.status === "active" && t.minutesRemaining > 0
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
  if (!user) return;

  const jwt = await getToken({ template: "market" });
  const base = process.env.NEXT_PUBLIC_FRAPPE_URL;

  const res = await fetch(
    `${base}/api/method/bcservices.api.user.balance?userId=${user.id}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  );

  const data = await res.json();

  if (data?.userId) {
    setBalance({
      userId: data.userId,
      totalMinutes: data.totalMinutes,
      tokens: data.tokens,
    });
  }
}, [user, getToken]);




  const fetchListings = useCallback(async () => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_FRAPPE_URL}/api/method/bcservices.api.market.listings`);
  const data = await res.json();
  if (data?.success) setListings(data.items);
}, []);



  // sync user
  useEffect(() => {
    const init = async () => {
      if (!isSignedIn || !user) return;
      try {
      const jwt = await getToken({ template: "market" });
        await fetch(`${backend}/friday/sync-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
        });
      } catch (e) {
        console.error("sync-user FE error:", e);
      }
    };
    init();
  }, [isSignedIn, user, backend, getToken]);

  useEffect(() => {
    fetchSupply();
    fetchListings();
    if (isSignedIn) fetchBalance();
  }, [isSignedIn, fetchSupply, fetchBalance, fetchListings]);

  const authHeaders = useCallback(async () => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getToken({ template: "market" })}`
    };
  }, [getToken]);

  // === nákup z pokladnice (1 token) ======================
  const handlePrimaryBuy = useCallback(
    async (quantity = 1) => {
      if (!user || !supply) return;

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
          userId: user.id,
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
    [backend, user, supply, maxCanBuy, currentYear]
  );

  // === nákup z burzy ======================
  const handleBuyListing = useCallback(
    async (listingId: string) => {
      if (!user) return;
      try {
        setBuyingId(listingId);
        const res = await fetch(`${backend}/friday/payments/checkout/listing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyerId: user.id, listingId }),
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
    [backend, user]
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
  // klient si nastaví množstvo N, ale do BE pôjdeme po jednom
  const handleClientListTokens = useCallback(async () => {
    if (!user) return;
    if (!balance) return;

    
    // dostupné aktívne tokeny klienta
    const activeTokens = (balance.tokens || []).filter(
      (t) => t.status === "active" && t.minutesRemaining > 0
    );

    if (activeTokens.length === 0) {
      alert("Nemáš žiadne aktívne tokeny.");
      return;
    }

    const countToList = Math.min(sellQty, activeTokens.length);
    const price = sellPrice;

    // urobíme viac requestov po jednom
    for (let i = 0; i < countToList; i++) {
      const token = activeTokens[i];
      // každý list je 1 token
      // BE endpoint: /friday/list { sellerId, tokenId, priceEur }
      // necháme to presne ako máš
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${backend}/friday/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: user.id,
          tokenId: token.id,
          priceEur: price,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        console.warn("Listovanie zlyhalo pre token", token.id);
      }
    }
    console.log("Listujem token:", {
  sellerId: user.id,
  tokenId: activeTokens[0]?.id,
  priceEur: sellPrice,
});


    // po listovaní obnovíme dáta
    await Promise.all([fetchBalance(), fetchListings()]);
    setSellSheetOpen(false);
  }, [user, balance, sellQty, sellPrice, backend, fetchBalance, fetchListings]);

  // === admin akcie (nechávam) =============================
  const handleAdminMint = useCallback(async () => {
  if (role !== "admin") return;

  const res = await fetch(`${backend}/friday/admin/mint`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      quantity: mintQty,
      priceEur: mintPrice,
      year: mintYear,
    }),
  });
  const data = await res.json();

  if (res.ok && data?.success) {
    alert(`✅ Vytvorených ${mintQty} tokenov pre rok ${mintYear} @ ${mintPrice.toFixed(2)} €`);
    await fetchSupply();
    setMintSheetOpen(false);
  } else {
    alert(data?.message || "Mint zlyhal.");
  }
}, [backend, role, mintQty, mintPrice, mintYear, fetchSupply, authHeaders]);


  const handleAdminSetPrice = useCallback(async () => {
    if (role !== "admin") return;
    const priceStr = prompt("Nová cena v pokladnici (€):");
    const price = Number((priceStr || "").replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      alert("Neplatná cena.");
      return;
    }

    const res = await fetch(`${backend}/friday/admin/set-price`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ newPrice: price, repriceTreasury: false }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      alert(`Cena nastavená na ${price.toFixed(2)} €`);
      await fetchSupply();
    } else {
      alert(data?.message || "Zmena ceny zlyhala.");
    }
  }, [backend, role, fetchSupply, authHeaders]);

  function handleCancelListing(id: string): void {
    throw new Error("Function not implemented.");
  }

  // ==================== RENDER ====================
  return (
    <main className="min-h-screen bg-white">
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
            <SignedOut>
              <SignInButton>
                <Button className="rounded-full bg-black hover:bg-black/80 h-8 px-4 text-xs">
                  Prihlásiť sa
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tokeny</h1>
            <p className="text-sm text-neutral-500">
              Recent transactions from your store.
            </p>
          </div>
          <SignedIn>
            <Button
              variant="outline"
              className="hidden md:inline-flex rounded-full"
              onClick={() => {
                fetchBalance();
                fetchListings();
                fetchSupply();
              }}
            >
              Obnoviť dáta
            </Button>
          </SignedIn>
        </div>

        <SignedIn>
          <Tabs defaultValue="burza" className="space-y-5">
            <TabsList className="bg-transparent p-0 gap-3">
              <TabsTrigger
                value="burza"
                className="rounded-full bg-black text-white px-6 py-2 text-sm data-[state=inactive]:bg-white data-[state=inactive]:text-neutral-900 border border-transparent data-[state=inactive]:border-neutral-200"
              >
                Burza tokenov
              </TabsTrigger>
              <TabsTrigger
                value="moje"
                className="rounded-full bg-white text-neutral-900 px-6 py-2 text-sm border border-neutral-200 data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Moje tokeny
              </TabsTrigger>
            </TabsList>

            {/* ============ TAB 1: BURZA – IBA BURZA ============ */}
            <TabsContent value="burza">
              <Card className="bg-white border border-neutral-200 rounded-[28px] shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      Burza tokenov
                    </CardTitle>
                    <p className="text-xs text-neutral-400 mt-1">
                      Recent transactions from your store.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[520px] pr-2">
                    <div className="flex flex-col gap-3 pt-3">
                      {/* 1) najprv tokeny z pokladnice (admin vygenerované) */}
                      {supply && supply.treasuryAvailable > 0 && (
                        <div className="flex items-center justify-between bg-[#f3f3f3] rounded-2xl px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-xs">
                              🕒
                            </div>
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-medium">
                                Token {supply.year}
                              </span>
                              <span className="text-xs text-neutral-400">
                                {supply.treasuryAvailable} dostupných v pokladnici
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tracking-tight">
                              {supply.priceEur.toFixed(2)} €
                            </span>
                            <Button
                              size="sm"
                              className="rounded-full bg-black text-white text-xs"
                              onClick={() => {
                                setBuyFromTreasury(true);
                                setBuySheetOpen(true);
                              }}
                              disabled={maxCanBuy <= 0}
                            >
                              Kúpiť
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 2) potom všetky listingy (user aj admin) */}
                      {listings.length === 0 ? (
                        <p className="text-sm text-neutral-400">
                          Žiadne otvorené ponuky.
                        </p>
                      ) : (
                        listings.map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between bg-[#f3f3f3] rounded-2xl px-3 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-xs">
                                🕒
                              </div>
                              <div className="flex flex-col leading-tight">
                                <span className="text-sm font-medium">
                                  Token {l.token?.issuedYear ?? ""}
                                </span>
                                <span className="text-xs text-neutral-400">
                                  {l.token?.id?.slice(0, 12) ?? l.tokenId}…
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold tracking-tight">
                                {Number(l.priceEur).toFixed(2)} €
                              </span>
                              {user?.id === l.sellerId ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full text-xs"
                                  onClick={() => handleCancelListing(l.id)}
                                >
                                  Zrušiť
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="rounded-full bg-black hover:bg-black/85 text-xs"
                                  disabled={buyingId === l.id}
                                  onClick={() => {
                                    setSelectedListing(l);
                                    setBuyFromTreasury(false);
                                    setBuySheetOpen(true);
                                  }}
                                >
                                  {buyingId === l.id ? "Kupujem…" : "Kúpiť"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            {/* ============ TAB 2: MOJE TOKENY ============ */}
            <TabsContent value="moje" className="space-y-5">
              {/* vrchný riadok ako na obrázku */}
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
                      {tokensActive.length} aktívnych
                    </p>
                  </div>
                  {/* tu už „Odpredať“ pre KLIENTA */}
                  <Button
                    variant="outline"
                    className="rounded-full h-9 px-5 text-sm"
                    onClick={() => {
                      setSellQty(1);
                      setSellPrice(supply ? supply.priceEur : 450);
                      setSellSheetOpen(true);
                    }}
                    disabled={tokensActive.length === 0}
                  >
                    Odpredať
                  </Button>
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
              {/* dátum */}
              <span className="text-neutral-500">
                {new Date(tx.createdAt).toLocaleDateString("sk-SK")}
              </span>

              {/* typ transakcie */}
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

              {/* cena */}
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


              {/* admin panel dolu */}
              {role === "admin" ? (
                <Card className="bg-white border border-neutral-200 rounded-[28px] shadow-sm">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-xs text-neutral-400">
                      Admin – pokladnica
                    </p>
                    <p className="text-xs text-neutral-500">
                      Cena:{" "}
                      <span className="font-semibold">
                        {supply ? supply.priceEur.toFixed(2) : "…"} €
                      </span>{" "}
                      • V pokladnici:{" "}
                      <span className="font-semibold">
                        {supply?.treasuryAvailable ?? 0}
                      </span>{" "}
                      (rok {currentYear})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="bg-black hover:bg-black/80 text-white"
                        onClick={() => setMintSheetOpen(true)}
                      >
                        Mint
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAdminSetPrice}
                      >
                        Nastaviť cenu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          fetchSupply();
                          fetchListings();
                        }}
                      >
                        Obnoviť
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>

          <p className="text-[10px] text-neutral-400 mt-6">
            Token = právo na 60 min v piatok. Nevyužité tokeny sa prenášajú do ďalšieho roka.
          </p>
        </SignedIn>
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
                  onClick={() => setSellQty((n) => n + 1)}
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
          variant="default"
          className={cn("w-full rounded-xl", role === "admin" && "text-white")}
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

"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  useUser,
  useAuth,
} from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

// shadcn ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

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

function BurzaTokenovInner() {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  const role = (user?.publicMetadata.role as string) || "client";

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [supply, setSupply] = useState<SupplyInfo | null>(null);

  const [balance, setBalance] = useState<FridayBalance | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listPrice, setListPrice] = useState<Record<string, string>>({});
  const [buyingId, setBuyingId] = useState<string | null>(null);

  // UI state pre sheet/modal
  const [buySheetOpen, setBuySheetOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const [sellSheetOpen, setSellSheetOpen] = useState(false);
  const [sellSelectedToken, setSellSelectedToken] = useState<FridayToken | null>(
    null
  );
  const [sellPrice, setSellPrice] = useState<number>(450);
  const [sellQty, setSellQty] = useState<number>(1); // v tvojom backende sa listuje 1 token, ale urobil som UI ako v návrhu

  // odvodené
  const tokensActive = useMemo(
    () =>
      (balance?.tokens || []).filter(
        (t) => t.status === "active" && t.minutesRemaining > 0
      ),
    [balance]
  );
  const tokensListed = useMemo(
    () => (balance?.tokens || []).filter((t) => t.status === "listed"),
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
    const res = await fetch(`${backend}/friday/balance/${user.id}`);
    const data = (await res.json()) as FridayBalance;
    setBalance(data);
  }, [backend, user]);

  const fetchListings = useCallback(async () => {
    const res = await fetch(`${backend}/friday/listings?take=50`);
    const data = await res.json();
    setListings(data?.items || []);
  }, [backend]);

  // sync user
  useEffect(() => {
    const init = async () => {
      if (!isSignedIn || !user) return;
      try {
        const jwt = await getToken();
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

  // prvotné fetchy
  useEffect(() => {
    fetchSupply();
    fetchListings();
    if (isSignedIn) fetchBalance();
  }, [isSignedIn, fetchSupply, fetchBalance, fetchListings]);

  const authHeaders = useCallback(async () => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getToken()}`,
    };
  }, [getToken]);

  // === STRIPE Treasury Checkout (primárny nákup) =====================
  const handlePrimaryBuy = useCallback(async () => {
    if (!user || !supply) return;

    const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
    if (q > maxCanBuy) {
      alert(`Maximálne môžeš dokúpiť ešte ${maxCanBuy} tokenov pre rok ${currentYear}.`);
      return;
    }
    if (q > (supply.treasuryAvailable ?? 0)) {
      alert("Nie je dostatok tokenov v pokladnici.");
      return;
    }

    const res = await fetch(`${backend}/friday/payments/checkout/treasury`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, quantity: q, year: currentYear }),
    });
    const data = await res.json();
    if (res.ok && data?.url) {
      window.location.href = data.url;
    } else {
      alert(data?.message || "Vytvorenie platby zlyhalo.");
    }
  }, [backend, user, qty, maxCanBuy, currentYear, supply]);

  // === STRIPE Listing Checkout (z burzy) =============================
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

  // === spracovanie návratu z checkoutu ===============================
  useEffect(() => {
    const status = search.get("payment");
    if (status === "success") {
      Promise.allSettled([fetchBalance(), fetchSupply(), fetchListings()]);
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      router.replace(url.pathname + url.search, { scroll: false });
    }
    if (status === "cancel") {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [search, router, fetchBalance, fetchListings, fetchSupply]);

  // === listovanie tokenu =============================================
  const handleListToken = useCallback(
    async (tokenId: string, price: number) => {
      if (!user) return;
      const res = await fetch(`${backend}/friday/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: user.id, tokenId, priceEur: price }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        await Promise.all([fetchBalance(), fetchListings()]);
      } else {
        alert(data?.message || "Zalistovanie zlyhalo.");
      }
    },
    [backend, user, fetchBalance, fetchListings]
  );

  const handleCancelListing = useCallback(
    async (listingId: string) => {
      if (!user) return;
      const res = await fetch(`${backend}/friday/cancel-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: user.id, listingId }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        await Promise.all([fetchBalance(), fetchListings()]);
      } else {
        alert(data?.message || "Zrušenie zlyhalo.");
      }
    },
    [backend, user, fetchBalance, fetchListings]
  );

  // === admin akcie ===================================================
  const handleAdminMint = useCallback(async () => {
    if (role !== "admin") return;
    const qtyStr = prompt("Koľko tokenov chceš vytvoriť?");
    const priceStr = prompt("Za akú cenu (€) ich chceš ponúknuť?");
    const yearStr = prompt(`Pre aký rok? (default ${currentYear})`) || `${currentYear}`;
    const q = Number(qtyStr);
    const price = Number((priceStr || "").replace(",", "."));
    const year = Number(yearStr);

    if (!Number.isInteger(q) || q <= 0 || !Number.isFinite(price) || price <= 0 || !Number.isInteger(year)) {
      alert("Neplatné vstupy.");
      return;
    }

    const res = await fetch(`${backend}/friday/admin/mint`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ quantity: q, priceEur: price, year }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      alert(`Vytvorených ${q} tokenov pre rok ${year} @ ${price.toFixed(2)} €`);
      await fetchSupply();
    } else {
      alert(data?.message || "Mint zlyhal.");
    }
  }, [backend, role, currentYear, fetchSupply, authHeaders]);

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

  // === RENDER ========================================================
  return (
    <main className="min-h-screen bg-[#e9eaec] text-black">
      <div className="mx-auto max-w-6xl">
        {/* top bar */}
        <header className="h-16 px-6 flex items-center justify-between bg-white/70 backdrop-blur border-b border-neutral-200">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center">
              🪙
            </div>
            <span className="font-medium text-neutral-700">Tokeny</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white border flex items-center justify-center text-xs">
              🇸🇰
            </div>
            <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <div className="h-9 w-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-semibold">
                {user?.firstName?.[0] ?? "A"}
              </div>
            </SignedIn>
          </div>
        </header>

        <div className="px-6 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Tokeny</h1>
              <p className="text-sm text-neutral-500">
                Recent transactions from your store.
              </p>
            </div>
            <SignedIn>
              {role !== "admin" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    fetchBalance();
                    fetchListings();
                    fetchSupply();
                  }}
                  className="rounded-full border-neutral-200"
                >
                  Obnoviť dáta
                </Button>
              ) : null}
            </SignedIn>
          </div>

          <SignedIn>
            {/* Tabs ako v návrhu */}
            <Tabs defaultValue="burza" className="space-y-6">
              <TabsList className="bg-transparent p-0 gap-3">
                <TabsTrigger
                  value="burza"
                  className="rounded-full border bg-white data-[state=active]:bg-black data-[state=active]:text-white border-neutral-200 px-5 py-2 text-sm"
                >
                  Burza tokenov
                </TabsTrigger>
                <TabsTrigger
                  value="moje"
                  className="rounded-full border bg-white data-[state=active]:bg-black data-[state=active]:text-white border-neutral-200 px-5 py-2 text-sm"
                >
                  Moje tokeny
                </TabsTrigger>
              </TabsList>

              {/* ================== BURZA ================== */}
              <TabsContent value="burza" className="flex gap-6">
                {/* ĽAVÝ panel - burza */}
                <Card className="flex-1 rounded-3xl border-neutral-200 shadow-sm bg-white">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        Burza tokenov
                      </CardTitle>
                      <p className="text-xs text-neutral-400 mt-1">
                        Recent transactions from your store.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-neutral-200 text-xs"
                    >
                      Cena ⇵
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="h-[460px] pr-3">
                      <div className="flex flex-col gap-3 pt-3">
                        {listings.length === 0 ? (
                          <p className="text-sm text-neutral-400">
                            Žiadne otvorené ponuky.
                          </p>
                        ) : (
                          listings.map((l) => (
                            <div
                              key={l.id}
                              className="flex items-center justify-between bg-neutral-100/60 rounded-2xl px-3 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center border border-neutral-200">
                                  🕒
                                </div>
                                <div className="flex flex-col leading-tight">
                                  <span className="text-sm font-medium">
                                    Token
                                  </span>
                                  <span className="text-xs text-neutral-400">
                                    {l.token?.id?.slice(0, 10) ?? l.tokenId}…
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
                                    className="rounded-full bg-black hover:bg-black/80 text-white text-xs"
                                    disabled={role === "admin" || buyingId === l.id}
                                    onClick={() => {
                                      setSelectedListing(l);
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

                {/* PRAVÝ panel - moje tokeny + história */}
                <div className="w-[420px] flex flex-col gap-6">
                  {/* Moje tokeny */}
                  <Card className="rounded-3xl border-neutral-200 shadow-sm bg-white">
                    <CardContent className="pt-6 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-neutral-400 mb-1">
                          Moje tokeny
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-semibold tracking-tight">
                            {balance?.totalMinutes
                              ? (balance.totalMinutes / 60).toFixed(2)
                              : "0,00"}
                          </span>
                          <span className="text-sm text-neutral-400">
                            h
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">
                          {tokensActive.length} aktívnych •{" "}
                          {tokensListed.length} na burze
                        </p>
                      </div>
                      {role !== "admin" ? (
                        <Button
                          variant="outline"
                          className="rounded-full border-neutral-200 text-sm"
                          onClick={() => {
                            // otvor sheet na odpredaj a vyber prvý aktívny token
                            setSellSelectedToken(tokensActive[0] ?? null);
                            setSellSheetOpen(true);
                          }}
                        >
                          Odpredať
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* História transakcií */}
                  <Card className="rounded-3xl border-neutral-200 shadow-sm bg-white flex-1">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">
                        História transakcií
                      </CardTitle>
                      <p className="text-xs text-neutral-400">
                        Recent transactions from your store.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-[90px,1fr,100px] text-xs text-neutral-400 py-2 border-b">
                        <span>Dátum</span>
                        <span>Typ</span>
                        <span className="text-right">Množstvo</span>
                      </div>
                      <ScrollArea className="h-[300px]">
                        <div className="flex flex-col">
                          {/* nemáš priamo history v BE, tak zobrazím posledné listy kúpy/predaja z burzy
                              + prikladové dáta, aby to vyzeralo ako v návrhu */}
                          {listings.slice(0, 5).map((l) => (
                            <div
                              key={l.id}
                              className="grid grid-cols-[90px,1fr,100px] items-center py-3 text-sm border-b last:border-b-0"
                            >
                              <span className="text-neutral-500">
                                {new Date(l.createdAt).toLocaleDateString(
                                  "sk-SK"
                                )}
                              </span>
                              <div className="flex flex-col leading-tight">
                                <span className="font-medium text-neutral-800">
                                  {l.sellerId === user?.id
                                    ? "Predaj tokenu"
                                    : "Nákup tokenu"}
                                </span>
                                <span className="text-xs text-neutral-400">
                                  {l.token?.id?.slice(0, 10)}…
                                </span>
                              </div>
                              <span
                                className={`text-right font-semibold ${
                                  l.sellerId === user?.id
                                    ? "text-emerald-500"
                                    : "text-red-500"
                                }`}
                              >
                                {l.sellerId === user?.id ? "+" : "-"}
                                {Number(l.priceEur).toFixed(2)} €
                              </span>
                            </div>
                          ))}
                          {/* dummy riadky aby to vyzeralo ako v návrhu */}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {role !== "admin" ? (
                    <Card className="rounded-2xl border-neutral-200 bg-white/70">
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-xs text-neutral-400">
                          Primárny nákup (pokladnica)
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-500">
                            Rok {currentYear}
                          </span>
                          <span className="text-sm font-semibold">
                            {supply ? supply.priceEur.toFixed(2) : "…"} € / token
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={Math.min(
                              maxCanBuy,
                              supply?.treasuryAvailable ?? 0
                            )}
                            value={qty}
                            onChange={(e) =>
                              setQty(parseInt(e.target.value || "1", 10))
                            }
                            className="w-20 rounded-xl bg-neutral-100 border-0 text-center"
                          />
                          <Button
                            className="flex-1 rounded-xl bg-black text-white hover:bg-black/85"
                            onClick={handlePrimaryBuy}
                            disabled={
                              role === "admin" ||
                              !supply ||
                              (supply?.treasuryAvailable ?? 0) <= 0 ||
                              maxCanBuy <= 0
                            }
                          >
                            Kúpiť tokeny
                          </Button>
                        </div>
                        <p className="text-[10px] text-neutral-400">
                          Limit: max 20 tokenov/rok/osoba. Aktuálne držíš{" "}
                          {ownedThisYear} tokenov z {currentYear}.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </TabsContent>

              {/* ================== MOJE TOKENY (druhá záložka) ================== */}
              <TabsContent value="moje" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="rounded-3xl bg-white border-neutral-200 shadow-sm">
                    <CardContent className="pt-6">
                      <p className="text-xs text-neutral-400 mb-1">
                        Moje tokeny
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-semibold tracking-tight">
                          {tokensActive.length}
                        </span>
                        <span className="text-sm text-neutral-400">
                          aktívnych
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-2">
                        Spolu minút: {balance?.totalMinutes ?? 0} min
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl bg-white border-neutral-200 shadow-sm">
                    <CardContent className="pt-6">
                      <p className="text-xs text-neutral-400 mb-1">
                        Na burze
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-semibold tracking-tight">
                          {tokensListed.length}
                        </span>
                        <span className="text-sm text-neutral-400">
                          tokenov
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-2">
                        Môžeš ich zrušiť v časti burza.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl bg-white border-neutral-200 shadow-sm">
                    <CardContent className="pt-6 flex flex-col gap-3">
                      <p className="text-xs text-neutral-400">
                        Rýchly predaj
                      </p>
                      <Button
                        className="rounded-full bg-black hover:bg-black/80"
                        onClick={() => {
                          setSellSelectedToken(tokensActive[0] ?? null);
                          setSellSheetOpen(true);
                        }}
                      >
                        Odpredať token
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* zoznam mojich tokenov */}
                <Card className="rounded-3xl bg-white border-neutral-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Moje tokeny (detail)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {balance?.tokens?.length ? (
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {balance.tokens.map((t) => (
                          <div
                            key={t.id}
                            className="border rounded-2xl px-4 py-3 bg-neutral-50 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {t.issuedYear}
                              </span>
                              <span
                                className={`text-[10px] uppercase px-2 py-1 rounded-full ${
                                  t.status === "active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : t.status === "listed"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-neutral-200 text-neutral-700"
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400">
                              Zostatok: {t.minutesRemaining} min
                            </p>
                            {t.status === "active" && t.minutesRemaining > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full text-xs"
                                onClick={() => {
                                  setSellSelectedToken(t);
                                  setSellSheetOpen(true);
                                  setSellPrice(
                                    supply ? supply.priceEur : 450
                                  );
                                }}
                              >
                                Dať na burzu
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">
                        Zatiaľ nemáš žiadne tokeny.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* ADMIN sekcia - aby si o ňu neprišiel */}
            {role === "admin" ? (
              <Card className="rounded-3xl mt-4 bg-white border-neutral-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Admin – pokladnica</CardTitle>
                  <p className="text-xs text-neutral-400">
                    Aktuálna cena:{" "}
                    <span className="font-semibold">
                      {supply ? supply.priceEur.toFixed(2) : "…"} €
                    </span>{" "}
                    • V pokladnici:{" "}
                    <span className="font-semibold">
                      {supply?.treasuryAvailable ?? 0}
                    </span>{" "}
                    tokenov (rok {currentYear})
                  </p>
                </CardHeader>
                <CardContent className="flex gap-3 flex-wrap">
                  <Button
                    className="bg-black hover:bg-black/80"
                    onClick={handleAdminMint}
                  >
                    Vygenerovať tokeny
                  </Button>
                  <Button variant="outline" onClick={handleAdminSetPrice}>
                    Zmeniť cenu
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      fetchSupply();
                      fetchListings();
                    }}
                  >
                    Obnoviť
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <p className="text-[10px] text-neutral-400 pt-2 pb-8">
              Token = právo na 60 min v piatok. Nevyužité tokeny sa prenášajú do
              ďalšieho roka.
            </p>
          </SignedIn>
        </div>

        {/* ============ SHEET: kúpiť token (ako v návrhu) ============ */}
        <Sheet open={buySheetOpen} onOpenChange={setBuySheetOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl px-6 py-6">
            <SheetHeader className="items-center">
              <div className="w-16 h-1.5 bg-neutral-200 rounded-full mb-4" />
              <SheetTitle>Kúpiť token</SheetTitle>
              <SheetDescription></SheetDescription>
            </SheetHeader>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-neutral-100 border flex items-center justify-center">
                  🕒
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Token</span>
                  <span className="text-xs text-neutral-400">
                    {selectedListing?.token?.id?.slice(0, 12)}…
                  </span>
                </div>
              </div>
              <div className="text-lg font-semibold tracking-tight">
                {selectedListing
                  ? Number(selectedListing.priceEur).toFixed(2)
                  : "0.00"}{" "}
                €
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Button
                className="w-full rounded-xl bg-black hover:bg-black/85"
                disabled={
                  !selectedListing ||
                  role === "admin" ||
                  user?.id === selectedListing?.sellerId ||
                  buyingId === selectedListing?.id
                }
                onClick={() =>
                  selectedListing && handleBuyListing(selectedListing.id)
                }
              >
                {buyingId === selectedListing?.id ? "Kupujem…" : "Kúpiť"}
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

        {/* ============ SHEET: odpredať token (ako v návrhu) ============ */}
        <Sheet open={sellSheetOpen} onOpenChange={setSellSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl px-6 py-6">
            <SheetHeader className="items-center">
              <div className="w-16 h-1.5 bg-neutral-200 rounded-full mb-4" />
              <SheetTitle>Odpredať token</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {/* množstvo tokenov - u teba sa listuje 1 kus, ale nechal som UI */}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-neutral-400">Množstvo tokenov</p>
                <div className="flex items-center gap-3">
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
                      🕒 {sellSelectedToken?.minutesRemaining ?? 60} min
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

              {/* cena */}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-neutral-400">Cena</p>
                <div className="flex items-center gap-3">
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
                  className="w-full rounded-xl bg-black hover:bg-black/80"
                  disabled={!sellSelectedToken}
                  onClick={() => {
                    if (!sellSelectedToken) return;
                    // reálne BE berie 1 tokenId, tak listujeme prvý vybraný
                    handleListToken(sellSelectedToken.id, sellPrice);
                    setSellSheetOpen(false);
                  }}
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
      </div>
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

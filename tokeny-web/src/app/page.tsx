"use client";
import { useEffect, useState } from "react";

type Listing = { id: number; priceCents: number; tokenId: string; sellerId: string; createdAt: string };

export default function MarketPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();

  const load = async () => {
    setLoading(true);
    setErr(undefined);
    try {
      const res = await fetch("/api/listings").then(r => r.json());
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr((e as Error).message);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const buy = async (listingId: number) => {
    const res = await fetch("/api/market/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "P2P", listingId }),
    }).then(r => r.json());
    window.location.href = res.url;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Burza tokenov</h1>
      {loading && <p>Načítavam…</p>}
      {err && <p className="text-red-600">{err}</p>}
      <div className="grid gap-3">
        {items.map(it => (
          <div key={it.id} className="rounded border bg-white p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">Token {it.tokenId.slice(0,8)}…</div>
              <div className="text-sm text-neutral-600">Cena: {(it.priceCents/100).toFixed(2)} €</div>
            </div>
            <button onClick={() => buy(it.id)} className="px-3 py-1.5 rounded bg-black text-white text-sm">
              Kúpiť
            </button>
          </div>
        ))}
        {!loading && items.length === 0 && <p>Žiadne otvorené ponuky.</p>}
      </div>
    </div>
  );
}

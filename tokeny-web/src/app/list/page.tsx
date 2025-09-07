"use client";
import { useEffect, useState } from "react";

export default function ListPage() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("15.00");
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    fetch("/api/wallet/me").then(r => r.json()).then(d => {
      setTokens((d.tokens||[]).filter((t:any)=>t.status==="owned" && t.remainingMinutes===60));
    });
  }, []);

  const submit = async () => {
    setMsg(undefined);
    const priceCents = Math.round(parseFloat(price) * 100);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId, priceCents }),
    }).then(r => r.json());
    setMsg(`Zalistované (#${res.listing.id})`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Zalistovať token</h1>
      <div className="space-y-3 max-w-md">
        <label className="block">
          <span className="text-sm">Token</span>
          <select value={tokenId} onChange={e=>setTokenId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 bg-white">
            <option value="">-- vyber --</option>
            {tokens.map(t=>(
              <option key={t.id} value={t.id}>{t.id} (60 min)</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">Cena (€)</span>
          <input value={price} onChange={e=>setPrice(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <button disabled={!tokenId} onClick={submit}
          className="px-3 py-1.5 rounded bg-black text-white text-sm disabled:opacity-50">
          Zalistovať
        </button>
        {msg && <p className="text-green-700">{msg}</p>}
      </div>
    </div>
  );
}

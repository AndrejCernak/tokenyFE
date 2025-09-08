// src/lib/api.ts
import { auth } from "@clerk/nextjs/server";

const API = process.env.NEXT_PUBLIC_API_URL!;

// garantovane zoberie Clerk JWT pre backend
async function authHeader() {
  const { getToken } = await auth();  // ✅ server context
  const token = await getToken();
  if (!token) {
    throw new Error("Clerk getToken() vrátil null – si prihlásený?");
  }
  return { Authorization: `Bearer ${token}` };
}

// pomôcka: keď API odpovie chybou, ukáž detail
async function ensureOk(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API ${res.status} ${res.statusText}: ${text || "(no body)"}`
    );
  }
  return res;
}

export type Listing = {
  id: number;
  priceCents: number;
  tokenId: string;
  sellerId: string;
  createdAt: string;
};

export type Token = {
  id: string;
  remainingMinutes: number;
  status: "owned" | "reserved" | "listed" | "used";
  createdAt: string;
};

export async function getListings(): Promise<Listing[]> {
  const headers = await authHeader();
  const res = await fetch(`${API}/listings`, { headers, cache: "no-store" });
  await ensureOk(res);
  const data = await res.json();
  return data.items ?? data ?? [];
}

export async function getMyTokens(): Promise<Token[]> {
  const headers = await authHeader();
  const res = await fetch(`${API}/wallet/me`, { headers, cache: "no-store" });
  await ensureOk(res);
  const data = await res.json();
  return data.tokens ?? [];
}

export async function createListing(tokenId: string, priceCents: number) {
  const headers = {
    ...(await authHeader()),
    "Content-Type": "application/json",
  };
  const res = await fetch(`${API}/listings`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tokenId, priceCents }),
  });
  await ensureOk(res);
  return res.json();
}

export async function cancelListing(id: number) {
  const headers = await authHeader();
  const res = await fetch(`${API}/listings/${id}/cancel`, {
    method: "POST",
    headers,
  });
  await ensureOk(res);
  return res.json();
}

export async function createCheckoutAdmin(tokensCount: number) {
  const headers = {
    ...(await authHeader()),
    "Content-Type": "application/json",
  };
  const res = await fetch(`${API}/market/create-checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "ADMIN", tokensCount }),
  });
  await ensureOk(res);
  return res.json() as Promise<{ url: string }>;
}

export async function createCheckoutP2P(
  listingId: number,
  tokenId: string,
  sellerId: string
) {
  const headers = {
    ...(await authHeader()),
    "Content-Type": "application/json",
  };
  const res = await fetch(`${API}/market/create-checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "P2P", listingId, tokenId, sellerId }),
  });
  await ensureOk(res);
  return res.json() as Promise<{ url: string }>;
}

export function eur(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

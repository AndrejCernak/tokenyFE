import { auth } from "@clerk/nextjs/server";

export async function callBackend(path: string, init?: RequestInit) {
const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const { getToken } = await auth();
  const token = await getToken();

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");

  const res = await fetch(`${apiBase}${path}`, { ...init, headers, cache: "no-store" });

  // prečítaj telo vždy, aj pri chybe
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { message: text }; }

  if (!res.ok) {
    const err: any = new Error(json?.message || `Backend ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

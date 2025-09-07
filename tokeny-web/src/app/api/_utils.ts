import { auth } from "@clerk/nextjs/server";

export type BackendError = Error & { status?: number; body?: unknown };

export async function callBackend<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const { getToken } = await auth();
  const token = await getToken();

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body)
    headers.set("Content-Type", "application/json");

  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  // prečítaj telo vždy, aj pri chybe
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    let message = `Backend ${res.status}`;
    if (json && typeof json === "object" && "message" in json) {
      const m = (json as Record<string, unknown>).message;
      if (typeof m === "string") message = m;
    }
    const err = new Error(message) as BackendError;
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

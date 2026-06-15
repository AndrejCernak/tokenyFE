"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFrappeAuth } from "@/lib/auth";

// Web login (email + heslo) cez Frappe auth.login — rovnaký endpoint ako iOS.
export function LoginForm() {
  const { signIn } = useFrappeAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_FRAPPE_URL;
      const res = await fetch(
        `${base}/api/method/bcservices.api.auth.login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        }
      );
      const data = await res.json();
      const msg = data?.message;
      if (msg?.success && msg?.token) {
        signIn(msg.token, msg.full_name);
      } else {
        setError(msg?.error || "Nesprávny email alebo heslo.");
      }
    } catch {
      setError("Chyba pripojenia k serveru.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-sm bg-white border border-neutral-200 rounded-[28px] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Prihlásenie</CardTitle>
          <p className="text-xs text-neutral-400">Burza piatkových tokenov</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Heslo"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full rounded-xl">
              {loading ? "Prihlasujem…" : "Prihlásiť sa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

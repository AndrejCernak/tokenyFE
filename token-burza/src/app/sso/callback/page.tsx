"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

function CallbackInner() {
  const search = useSearchParams();
  const router = useRouter();
  const { setActive } = useClerk();

  useEffect(() => {
    const token = search.get("token");

    if (token) {
      // Nastaví session z exchangeable session tokenu
      setActive({ session: token })
        .then(() => {
          console.log("✅ Clerk session active via SSO callback");
          router.replace("/burza"); // kam presmerovať po úspechu
        })
        .catch((err) => {
          console.error("❌ Clerk setActive error:", err);
          router.replace("/"); // fallback pri chybe
        });
    }
  }, [search, router, setActive]);

  return <p>Prihlasujem…</p>;
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={<p>Načítavam…</p>}>
      <CallbackInner />
    </Suspense>
  );
}

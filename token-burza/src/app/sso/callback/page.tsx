"use client";

export const dynamic = "force-dynamic"; // ⬅️ vypne prerender, Vercel už nespadne

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  const search = useSearchParams();
  const router = useRouter();
  const { setActive } = useClerk();

  useEffect(() => {
    const run = async () => {
      const sessionId = search.get("sessionId");
      console.log("🔑 SSOCallbackPage sessionId =", sessionId);

      if (sessionId) {
        try {
          await setActive({ session: sessionId });
          console.log("✅ Clerk session activated");
          router.replace("/burza");
        } catch (err) {
          console.error("❌ SSO error", err);
          router.replace("/");
        }
      }
    };
    run();
  }, [search, router, setActive]);

  return <p>Prihlasujem…</p>;
}

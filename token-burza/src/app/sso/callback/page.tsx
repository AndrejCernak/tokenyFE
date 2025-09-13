"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

function CallbackInner() {
  const search = useSearchParams();
  const router = useRouter();
  const { setActive } = useClerk();

  useEffect(() => {
  const sessionId = search.get("sessionId");
  console.log("🔑 Callback got:", sessionId);

  if (sessionId) {
    setActive({ session: sessionId })
      .then(() => {
        console.log("✅ setActive success");
        router.replace("/burza");
      })
      .catch((err) => {
        console.error("❌ setActive failed:", err);
        router.replace("/");
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

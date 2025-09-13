"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

function CallbackInner() {
  const search = useSearchParams();
  const router = useRouter();
  const { setActive } = useClerk();

  useEffect(() => {
    const run = async () => {
      const sessionId = search.get("sessionId");
      if (sessionId) {
        try {
          await setActive({ session: sessionId });
          router.replace("/burza");
        } catch (err) {
          console.error("SSO error", err);
          router.replace("/");
        }
      }
    };
    run();
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

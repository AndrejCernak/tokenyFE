"use client";

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

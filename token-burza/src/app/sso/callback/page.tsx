'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFrappeAuth } from '@/lib/auth';

// iOS appka otvorí /sso/callback?token=<frappe-jwt>.
// Token uložíme (localStorage cez useFrappeAuth) a presmerujeme na burzu.
function SSOCallbackInner() {
  const { signIn } = useFrappeAuth();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = search.get('token');
    if (token) {
      signIn(token);
    }
    router.replace('/');
  }, [search, router, signIn]);

  return <p className="p-6 text-center">Prihlasujem…</p>;
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center">Načítavam…</p>}>
      <SSOCallbackInner />
    </Suspense>
  );
}

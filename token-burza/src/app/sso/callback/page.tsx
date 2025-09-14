'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs';

function SSOCallbackInner() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = search.get('token');
    if (!isLoaded || !signIn || !setActive || !token) return;

    (async () => {
      try {
        const res = await signIn.create({ strategy: 'ticket', ticket: token });
        if (res.status === 'complete' && res.createdSessionId) {
          await setActive({ session: res.createdSessionId });
          router.replace('/burza');
        } else {
          router.replace('/');
        }
      } catch (err) {
        console.error('SSO callback error:', err);
        router.replace('/');
      }
    })();
  }, [isLoaded, signIn, setActive, search, router]);

  return <p>Prihlasujem…</p>;
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={<p>Načítavam…</p>}>
      <SSOCallbackInner />
    </Suspense>
  );
}

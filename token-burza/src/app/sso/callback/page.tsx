'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs';

export default function SSOCallbackPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = search.get('token');
    if (!isLoaded || !signIn || !setActive || !token) return;

    (async () => {
      try {
        // Skonzumuj sign-in token (ticket)
        const res = await signIn.create({
          strategy: 'ticket',
          ticket: token,
        });

        if (res.status === 'complete' && res.createdSessionId) {
          await setActive({ session: res.createdSessionId });
          router.replace('/burza');
        } else {
          console.error('Sign-in not complete', res);
          router.replace('/');
        }
      } catch (e) {
        console.error('SSO callback error:', e);
        router.replace('/');
      }
    })();
  }, [isLoaded, signIn, setActive, search, router]);

  return <p>Prihlasujem…</p>;
}

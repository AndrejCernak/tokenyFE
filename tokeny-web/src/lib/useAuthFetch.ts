'use client';

import { useAuth } from '@clerk/nextjs';

export function useAuthFetch() {
  const { getToken, isSignedIn } = useAuth();

  return async (path: string, init?: RequestInit) => {
    if (!isSignedIn) throw new Error('Nie si prihlásený cez Clerk.');

    const token = await getToken({ template: 'integration_fallback' });
    if (!token) throw new Error('Clerk token je prázdny.');

    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return res;
  };
}

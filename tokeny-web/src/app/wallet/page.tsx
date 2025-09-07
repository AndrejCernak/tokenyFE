'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { useAuthFetch } from '@/lib/useAuthFetch';
import type { ApiWalletMeResponse } from '@/types/api';

export default function Wallet() {
  const { isSignedIn } = useAuth();
  const authFetch = useAuthFetch();
  const [me, setMe] = React.useState<ApiWalletMeResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!isSignedIn) return;
        const res = await authFetch('/api/wallet/me', { method: 'GET' });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`/api/wallet/me ${res.status} ${txt}`);
        }
        const json = (await res.json()) as ApiWalletMeResponse;
        if (mounted) setMe(json);
      } catch (e: unknown) {
        if (mounted) setError((e as Error)?.message ?? 'Neznáma chyba');
      }
    })();
    return () => { mounted = false; };
  }, [isSignedIn, authFetch]);

  if (!isSignedIn) return <div>Prosím prihlás sa.</div>;
  if (error) return <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!me) return <div>Načítavam…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h1>Moja peňaženka</h1>

      <div>
        <strong>Užívateľ:</strong> {me.user.email} ({me.user.role})
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div><strong>Owned:</strong> {me.wallet.owned}</div>
        <div><strong>Listed:</strong> {me.wallet.listed}</div>
        <div><strong>Reserved:</strong> {me.wallet.reserved}</div>
        <div><strong>Spent:</strong> {me.wallet.spent}</div>
      </div>

      <div><strong>Balance:</strong> {(me.balanceCents / 100).toFixed(2)} €</div>

      <h3>Tokeny (skrátený zoznam)</h3>
      <ul>
        {me.tokens.slice(0, 20).map(t => (
          <li key={t.id}>#{t.id} – {t.status}</li>
        ))}
      </ul>

      <details>
        <summary>Raw JSON</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(me, null, 2)}</pre>
      </details>
    </div>
  );
}

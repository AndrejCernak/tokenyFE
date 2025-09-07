'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { useAuthFetch } from '@/lib/useAuthFetch';
import type {
  ApiListing,
  ApiListingsResponse,
  CreateCheckoutRequest,
  CreateCheckoutResponse
} from '@/types/api';

function eur(cents: number) {
  return (cents / 100).toFixed(2) + ' €';
}

export default function MarketPage() {
  const { isSignedIn } = useAuth();
  const authFetch = useAuthFetch();

  const [listings, setListings] = React.useState<ApiListing[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Načítaj všetky otvorené listingy
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!isSignedIn) return;
        const res = await authFetch('/api/listings', { method: 'GET' });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`/api/listings ${res.status} ${txt}`);
        }
        const json = (await res.json()) as ApiListingsResponse;
        if (mounted) setListings(json);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Neznáma chyba');
      }
    })();
    return () => { mounted = false; };
  }, [isSignedIn, authFetch]);

  // Admin balík (demo nákup)
  const buyAdmin = async () => {
    try {
      setLoading(true);
      const body: CreateCheckoutRequest = { type: 'ADMIN' };
      const res = await authFetch('/api/market/create-checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`/api/market/create-checkout ${res.status} ${txt}`);
      }
      const ct = res.headers.get('content-type') || '';
      const data: CreateCheckoutResponse | null =
        ct.includes('application/json') ? await res.json() : null;

      if (data?.url) {
        window.location.href = data.url; // presmeruj na Stripe Checkout
      } else {
        alert('Server nevrátil URL pre checkout.');
      }
    } catch (e: any) {
      alert(e?.message ?? 'Chyba pri vytváraní checkoutu');
    } finally {
      setLoading(false);
    }
  };

  // P2P nákup konkrétneho inzerátu
  const buyListing = async (listingId: number) => {
    try {
      setLoading(true);
      const body: CreateCheckoutRequest = { type: 'P2P', listingId };
      const res = await authFetch('/api/market/create-checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`/api/market/create-checkout ${res.status} ${txt}`);
      }
      const data = (await res.json()) as CreateCheckoutResponse;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Server nevrátil URL pre checkout.');
      }
    } catch (e: any) {
      alert(e?.message ?? 'Chyba pri P2P checkoute');
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) return <div>Prosím prihlás sa.</div>;
  if (error) return <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h1>Market</h1>

      <button disabled={loading} onClick={buyAdmin}>
        {loading ? '…' : 'Kúpiť admin balík'}
      </button>

      <h2>Aktívne ponuky</h2>
      {listings.length === 0 && <div>Žiadne ponuky.</div>}
      <ul style={{ display: 'grid', gap: 8, padding: 0, listStyle: 'none' }}>
        {listings.map(l => (
          <li key={l.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div><strong>ID:</strong> {l.id}</div>
            <div><strong>Cena:</strong> {eur(l.priceCents)}</div>
            <div><strong>Status:</strong> {l.status}</div>
            <div><small>Vytvorené: {new Date(l.createdAt).toLocaleString()}</small></div>
            {l.status === 'open' && (
              <div style={{ marginTop: 8 }}>
                <button disabled={loading} onClick={() => buyListing(l.id)}>
                  Kúpiť tento listing
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <details>
        <summary>Raw JSON</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(listings, null, 2)}</pre>
      </details>
    </div>
  );
}

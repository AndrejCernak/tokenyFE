// ---- Enumy (match s Prismou / backendom) ----
export type Role = 'admin' | 'client';

export type TokenStatus = 'owned' | 'listed' | 'reserved' | 'spent';

export type ListingStatus = 'open' | 'filled' | 'canceled';

// ---- Základné entity ----
export interface ApiUser {
  id: string;
  email: string;
  role: Role;
}

// Zhrnutie tokenov vo wallete
export interface ApiTokenSummary {
  id: number;           // interné ID tokenu
  status: TokenStatus;  // owned | listed | reserved | spent
}

// ==== /api/wallet/me (GET) ====
export interface ApiWalletMeResponse {
  user: ApiUser;
  wallet: {
    owned: number;
    listed: number;
    reserved: number;
    spent: number;
  };
  balanceCents: number;           // ak nepoužívaš, môžeš ignorovať
  tokens: ApiTokenSummary[];      // skrátený zoznam tokenov (pre rýchly prehľad)
}

// ==== /api/listings (GET) ====
export interface ApiListing {
  id: number;
  userId: string;                 // predajca
  priceCents: number;             // cena v centoch
  status: ListingStatus;          // open | filled | canceled
  createdAt: string;              // ISO dátum
}

// Celá odpoveď je pole listingov:
export type ApiListingsResponse = ApiListing[];

// ==== /api/market/create-checkout (POST) ====
export type CreateCheckoutType = 'ADMIN' | 'P2P';

export interface CreateCheckoutRequest {
  type: CreateCheckoutType;       // 'ADMIN' na admin predaj, 'P2P' na P2P kúpu
  listingId?: number;             // povinné pri P2P nákupe
}

export interface CreateCheckoutResponse {
  url: string;                    // Stripe Checkout URL
}

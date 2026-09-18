// A product is the same object whether it came from Products search, a saved
// folder, or a picker inside a script generator. These helpers move it between
// screens as a route param so nobody has to search for it twice.

import type { ProductSearchResult, SavedProductItem } from '@/types/api';

type Loose = {
  external_id: string;
  title: string;
  region?: string | null;
  category?: string | null;
  price?: number | null;
  commission_rate?: number | null;
  day7_gmv?: number | null;
  total_units_sold?: number | null;
  cover_url?: string | null;
  cover?: string | null;
  image_url?: string | null;
  product_url?: string | null;
};

export function toSearchResult(x: Loose): ProductSearchResult {
  return {
    external_id: x.external_id,
    region: x.region ?? 'US',
    title: x.title,
    category: x.category ?? null,
    price: x.price ?? null,
    commission_rate: x.commission_rate ?? null,
    day7_gmv: x.day7_gmv ?? null,
    total_units_sold: x.total_units_sold ?? null,
    cover_url: x.cover_url ?? x.cover ?? x.image_url ?? null,
    product_url: x.product_url ?? null,
  };
}

export function fromSaved(s: SavedProductItem): ProductSearchResult {
  return toSearchResult({ ...s, cover_url: s.image_url ?? null });
}

export function productParam(p: ProductSearchResult): string {
  return JSON.stringify(p);
}

export function parseProductParam(s: string | string[] | undefined): ProductSearchResult | null {
  const raw = Array.isArray(s) ? s[0] : s;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.external_id === 'string' && typeof p.title === 'string') return toSearchResult(p);
  } catch {}
  return null;
}

/** The image for a product from any source (search `cover`, saved `image_url`, normalised `cover_url`). */
export function coverOf(p: { cover_url?: string | null; cover?: string | null; image_url?: string | null } | null | undefined): string | null {
  return p?.cover_url ?? p?.cover ?? p?.image_url ?? null;
}

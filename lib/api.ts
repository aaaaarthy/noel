// Accès à la base : uniquement les fonctions public.noel_* (voir supabase/schema.sql).
import { ApiError } from "./errors";
import { mockRpc } from "./mock";

export { ApiError };

export type Item = {
  id: string;
  title: string;
  url: string | null;
  image_url: string | null;
  price: number | null;
  currency: string;
  merchant: string | null;
  desire: number;
  note: string | null;
  created_at: string;
  reserved: boolean;
  reserved_by: string | null;
};

export type GiftList = {
  slug: string;
  title: string;
  owner_name: string;
  message: string | null;
  created_at: string;
  is_owner: boolean;
  items: Item[];
};

export type ItemInput = {
  title?: string | null;
  url?: string | null;
  image_url?: string | null;
  price?: number | null;
  currency?: string | null;
  merchant?: string | null;
  desire?: number;
  note?: string | null;
};

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (DEMO) return (await mockRpc(fn, args)) as T;
  if (!BASE || !KEY) throw new ApiError("Le site n'est pas encore relié à sa base de données.", 500);
  let res: Response;
  try {
    res = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Connexion impossible. Vérifie ton réseau et réessaie.", 0);
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = typeof body?.message === "string" && !/^(new row|null value|invalid input|violates)/i.test(body.message)
      ? body.message
      : "Ça n'a pas marché. Vérifie les champs et réessaie.";
    throw new ApiError(msg, res.status);
  }
  return body as T;
}

export const api = {
  createList: (title: string, ownerName: string, message: string) =>
    rpc<{ slug: string; edit_token: string }>("noel_create_list", { p_title: title, p_owner_name: ownerName, p_message: message }),
  getList: (slug: string, token?: string | null) =>
    rpc<GiftList>("noel_get_list", { p_slug: slug, p_token: token ?? null }),
  updateList: (slug: string, token: string, title: string, ownerName: string, message: string) =>
    rpc<void>("noel_update_list", { p_slug: slug, p_token: token, p_title: title, p_owner_name: ownerName, p_message: message }),
  addItem: (slug: string, token: string, item: ItemInput) =>
    rpc<string>("noel_add_item", { p_slug: slug, p_token: token, p_item: item }),
  updateItem: (slug: string, token: string, itemId: string, item: ItemInput) =>
    rpc<void>("noel_update_item", { p_slug: slug, p_token: token, p_item_id: itemId, p_item: item }),
  deleteItem: (slug: string, token: string, itemId: string) =>
    rpc<void>("noel_delete_item", { p_slug: slug, p_token: token, p_item_id: itemId }),
  reserve: (itemId: string, name: string) =>
    rpc<string>("noel_reserve_item", { p_item_id: itemId, p_name: name }),
  unreserve: (itemId: string, reserveToken: string) =>
    rpc<void>("noel_unreserve_item", { p_item_id: itemId, p_reserve_token: reserveToken }),
};

export type Scraped = {
  url: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  merchant: string | null;
  blocked: boolean;
};

export async function scrapeLink(url: string): Promise<Scraped> {
  let res: Response;
  try {
    res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new ApiError("Connexion impossible. Vérifie ton réseau et réessaie.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? "Impossible de lire ce lien.", res.status);
  return body as Scraped;
}

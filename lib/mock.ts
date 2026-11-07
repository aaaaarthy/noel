// Mode démo local (NEXT_PUBLIC_DEMO=1) : rejoue les fonctions SQL noel_* dans le navigateur,
// pour travailler le design sans base. Jamais utilisé en production.
import { ApiError } from "./errors";
import type { GiftList, Item, ItemInput } from "./api";

type ListRow = { slug: string; title: string; owner_name: string; message: string | null; edit_token: string; created_at: string };
type ItemRow = Omit<Item, "reserved" | "reserved_by"> & { list: string; reserved_by: string | null; reserve_token: string | null };
type DB = { lists: ListRow[]; items: ItemRow[] };

const KEY = "noel:demo-db";
const uid = () => crypto.randomUUID();

function load(): DB {
  if (typeof window === "undefined") throw new ApiError("Mode démo : chargement côté navigateur.", 503);
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "") as DB;
  } catch {
    return { lists: [], items: [] };
  }
}
const save = (db: DB) => window.localStorage.setItem(KEY, JSON.stringify(db));
const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function owner(db: DB, slug: unknown, token: unknown) {
  const list = db.lists.find(l => l.slug === slug && l.edit_token === token);
  if (!list) throw new ApiError("Ce lien d'édition n'est pas valide.", 403);
  return list;
}

function patch(row: ItemRow, input: ItemInput, partial: boolean) {
  const has = (k: keyof ItemInput) => !partial || k in input;
  if (has("title")) row.title = clean(input.title) ?? (partial ? row.title : "Idée cadeau");
  if (has("url")) row.url = clean(input.url);
  if (has("image_url")) row.image_url = clean(input.image_url);
  if (has("price")) row.price = input.price ?? null;
  if (has("currency")) row.currency = clean(input.currency) ?? "EUR";
  if (has("merchant")) row.merchant = clean(input.merchant);
  if (has("desire") && input.desire) row.desire = input.desire;
  if (has("note")) row.note = clean(input.note);
}

export async function mockRpc(fn: string, a: Record<string, unknown>): Promise<unknown> {
  await new Promise(r => setTimeout(r, 250));
  const db = load();
  switch (fn) {
    case "noel_create_list": {
      const base = String(a.p_title).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "liste";
      const list: ListRow = {
        slug: `${base}-${uid().slice(0, 5)}`, title: String(a.p_title), owner_name: String(a.p_owner_name),
        message: clean(a.p_message), edit_token: uid().replace(/-/g, ""), created_at: new Date().toISOString(),
      };
      db.lists.push(list);
      save(db);
      return { slug: list.slug, edit_token: list.edit_token };
    }
    case "noel_get_list": {
      const list = db.lists.find(l => l.slug === a.p_slug);
      if (!list) throw new ApiError("Cette liste n'existe pas (ou plus).", 404);
      const isOwner = !!a.p_token && a.p_token === list.edit_token;
      const items = db.items
        .filter(i => i.list === list.slug)
        .sort((x, y) => y.desire - x.desire || y.created_at.localeCompare(x.created_at))
        .map(({ list: _l, reserve_token: _t, reserved_by, ...rest }) => ({
          ...rest,
          reserved: isOwner ? false : reserved_by !== null,
          reserved_by: isOwner ? null : reserved_by,
        }));
      return { slug: list.slug, title: list.title, owner_name: list.owner_name, message: list.message, created_at: list.created_at, is_owner: isOwner, items } satisfies GiftList;
    }
    case "noel_update_list": {
      const list = owner(db, a.p_slug, a.p_token);
      list.title = String(a.p_title);
      list.owner_name = String(a.p_owner_name);
      list.message = clean(a.p_message);
      save(db);
      return null;
    }
    case "noel_add_item": {
      const list = owner(db, a.p_slug, a.p_token);
      const row: ItemRow = {
        id: uid(), list: list.slug, title: "Idée cadeau", url: null, image_url: null, price: null, currency: "EUR",
        merchant: null, desire: 3, note: null, created_at: new Date().toISOString(), reserved_by: null, reserve_token: null,
      };
      patch(row, a.p_item as ItemInput, false);
      db.items.push(row);
      save(db);
      return row.id;
    }
    case "noel_update_item": {
      const list = owner(db, a.p_slug, a.p_token);
      const row = db.items.find(i => i.id === a.p_item_id && i.list === list.slug);
      if (!row) throw new ApiError("Ce cadeau n'existe plus.", 404);
      patch(row, a.p_item as ItemInput, true);
      save(db);
      return null;
    }
    case "noel_delete_item": {
      const list = owner(db, a.p_slug, a.p_token);
      db.items = db.items.filter(i => !(i.id === a.p_item_id && i.list === list.slug));
      save(db);
      return null;
    }
    case "noel_reserve_item": {
      const row = db.items.find(i => i.id === a.p_item_id);
      if (!row) throw new ApiError("Ce cadeau n'existe plus.", 404);
      if (row.reserved_by) throw new ApiError("Quelqu'un vient de réserver ce cadeau.", 409);
      row.reserved_by = String(a.p_name).trim();
      row.reserve_token = uid();
      save(db);
      return row.reserve_token;
    }
    case "noel_unreserve_item": {
      const row = db.items.find(i => i.id === a.p_item_id && i.reserve_token === a.p_reserve_token);
      if (!row) throw new ApiError("Impossible d'annuler cette réservation depuis cet appareil.", 403);
      row.reserved_by = null;
      row.reserve_token = null;
      save(db);
      return null;
    }
  }
  throw new ApiError("Fonction inconnue.", 400);
}

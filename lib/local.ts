// Ce que ce navigateur retient : tes listes (avec leur lien secret) et tes réservations.

export type SavedList = { slug: string; token: string; title: string; owner: string; savedAt: number };

const LISTS = "noel:lists";
const RESERVATIONS = "noel:reservations";
const VISITOR = "noel:visitor";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible (navigation privée) : on continue sans */
  }
}

export const local = {
  lists: (): SavedList[] => read<SavedList[]>(LISTS, []).sort((a, b) => b.savedAt - a.savedAt),
  saveList(list: Omit<SavedList, "savedAt">) {
    const others = local.lists().filter(l => l.slug !== list.slug);
    write(LISTS, [{ ...list, savedAt: Date.now() }, ...others]);
  },
  forgetList(slug: string) {
    write(LISTS, local.lists().filter(l => l.slug !== slug));
  },
  tokenFor: (slug: string): string | null => local.lists().find(l => l.slug === slug)?.token ?? null,

  reservations: (): Record<string, string> => read<Record<string, string>>(RESERVATIONS, {}),
  saveReservation(itemId: string, token: string) {
    write(RESERVATIONS, { ...local.reservations(), [itemId]: token });
  },
  forgetReservation(itemId: string) {
    const r = local.reservations();
    delete r[itemId];
    write(RESERVATIONS, r);
  },

  visitorName: (): string => read<string>(VISITOR, ""),
  saveVisitorName: (name: string) => write(VISITOR, name),
};

export const DESIRE_LABELS = ["Pourquoi pas", "Sympa", "J'aimerais bien", "Très envie", "Rêve absolu"] as const;

export function formatPrice(price: number | null | undefined, currency = "EUR"): string | null {
  if (price === null || price === undefined) return null;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: price % 1 === 0 ? 0 : 2 }).format(price);
  } catch {
    return `${price.toFixed(2).replace(".", ",")} €`;
  }
}

/** "34,99", "34.99 €", "1 299" → 34.99 / 1299. Vide → null. */
export function parsePriceInput(raw: string): number | null | "invalid" {
  const s = raw.replace(/[\s €$£]/g, "").replace(",", ".");
  if (!s) return null;
  const v = Number(s);
  return Number.isFinite(v) && v >= 0 && v < 1_000_000 ? Math.round(v * 100) / 100 : "invalid";
}

/** Prochain 25 décembre, minuit à Paris. */
export function nextChristmas(now = new Date()): Date {
  const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(`${year}-12-25T00:00:00+01:00`);
}

/** Jours pleins avant Noël (comme le compte à rebours), -1 le jour de Noël. */
export function daysUntilChristmas(now = new Date()): number {
  const diff = nextChristmas(now).getTime() - now.getTime();
  return diff <= 0 ? -1 : Math.floor(diff / 86_400_000);
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function hostLabel(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

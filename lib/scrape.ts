// Récupère titre, prix, photo et marchand à partir du lien d'un produit.
// Ordre de confiance : données structurées (JSON-LD), balises meta (Open Graph),
// sélecteurs propres à Amazon, puis heuristiques. Tout est côté serveur.
import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import net from "node:net";

export type ScrapedProduct = {
  url: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  merchant: string | null;
  blocked: boolean;
};

// Un seul essai, en se présentant honnêtement. Si un site refuse les robots, on respecte
// son choix : la fiche est préremplie avec ce qu'on a et la personne complète à la main.
const USER_AGENT = "Mozilla/5.0 (compatible; ListeDeNoel/1.0; apercu de lien)";
const MAX_BYTES = 4_000_000;

const KNOWN_MERCHANTS: Record<string, string> = {
  amazon: "Amazon", amzn: "Amazon", fnac: "Fnac", lego: "LEGO", ikea: "IKEA", decathlon: "Decathlon",
  zalando: "Zalando", cdiscount: "Cdiscount", darty: "Darty", boulanger: "Boulanger", etsy: "Etsy",
  apple: "Apple", sephora: "Sephora", nocibe: "Nocibé", cultura: "Cultura", micromania: "Micromania",
  leroymerlin: "Leroy Merlin", maisonsdumonde: "Maisons du Monde", kingjouet: "King Jouet", carrefour: "Carrefour",
  laredoute: "La Redoute", galerieslafayette: "Galeries Lafayette", nike: "Nike", adidas: "adidas",
  uniqlo: "Uniqlo", zara: "Zara", hm: "H&M", rakuten: "Rakuten", vinted: "Vinted", leboncoin: "leboncoin",
  natureetdecouvertes: "Nature & Découvertes", oxybul: "Oxybul", joueclub: "JouéClub", smyths: "Smyths Toys",
  ldlc: "LDLC", rueducommerce: "Rue du Commerce", backmarket: "Back Market", ebay: "eBay", aliexpress: "AliExpress",
};

/* ---------- Sécurité : on ne va chercher que des pages publiques ---------- */

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertPublicUrl(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new ScrapeError("Ce lien doit commencer par http:// ou https://");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new ScrapeError("Ce lien ne mène pas à une boutique en ligne.");
  }
  if (net.isIP(host) && isPrivateIp(host)) throw new ScrapeError("Ce lien ne mène pas à une boutique en ligne.");
  let addrs: { address: string }[] = [];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new ScrapeError("Ce site est introuvable. Vérifie le lien.");
  }
  if (addrs.some(a => isPrivateIp(a.address))) throw new ScrapeError("Ce lien ne mène pas à une boutique en ligne.");
}

export class ScrapeError extends Error {}

/* ---------- Téléchargement de la page ---------- */

async function fetchHtml(start: URL): Promise<{ html: string; finalUrl: URL; status: number }> {
  let current = start;
  for (let hop = 0; hop < 6; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(type)) return { html: "", finalUrl: current, status: res.status };
    const buf = new Uint8Array(await res.arrayBuffer()).slice(0, MAX_BYTES);
    const charset = /charset=([\w-]+)/i.exec(type)?.[1]?.toLowerCase() ?? "utf-8";
    let html: string;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = new TextDecoder("utf-8").decode(buf);
    }
    return { html, finalUrl: current, status: res.status };
  }
  throw new ScrapeError("Ce lien redirige trop de fois.");
}

/* ---------- Petits utilitaires ---------- */

const clean = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Valeur structurée (JSON-LD, meta) : "32.79", "32,79", 32.79. */
function parseStructuredPrice(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? round2(raw) : null;
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\s  ]/g, "");
  if (/^\d+([.,]\d+)?$/.test(s)) return round2(parseFloat(s.replace(",", ".")));
  return parsePriceText(raw);
}

/** Prix écrit pour un humain : "1 299,99 €", "€1,299.99", "32,79". */
export function parsePriceText(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\s  ']/g, "");
  const m = /\d[\d.,]*/.exec(s);
  if (!m) return null;
  let n = m[0].replace(/[.,]+$/, "");
  const comma = n.lastIndexOf(","), dot = n.lastIndexOf(".");
  if (comma > -1 && dot > -1) {
    const dec = comma > dot ? "," : ".";
    n = n.split(dec === "," ? "." : ",").join("").replace(dec, ".");
  } else if (comma > -1 || dot > -1) {
    const sep = comma > -1 ? "," : ".";
    const parts = n.split(sep);
    const last = parts[parts.length - 1];
    n = last.length === 3 && parts.length >= 2 ? parts.join("") : parts.slice(0, -1).join("") + "." + last;
  }
  const v = parseFloat(n);
  return Number.isFinite(v) && v >= 0 && v < 1_000_000 ? round2(v) : null;
}

function currencyFromText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/€|EUR/i.test(raw)) return "EUR";
  if (/£|GBP/i.test(raw)) return "GBP";
  if (/CHF/i.test(raw)) return "CHF";
  if (/\$|USD/i.test(raw)) return "USD";
  return null;
}

function absolutize(src: string | null | undefined, base: URL): string | null {
  const s = clean(src);
  if (!s || s.startsWith("data:")) return null;
  try {
    const u = new URL(s.startsWith("//") ? `https:${s}` : s, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function merchantFrom(url: URL, siteName: string | null): string {
  const host = url.hostname.toLowerCase().replace(/^(www|m|shop|store|fr)\./, "");
  const label = host.split(".")[0].replace(/-/g, "");
  if (KNOWN_MERCHANTS[label]) return KNOWN_MERCHANTS[label];
  if (siteName && siteName.length <= 30) return siteName;
  const raw = host.split(".")[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/* ---------- JSON-LD ---------- */

type Json = Record<string, unknown>;

function collectProducts(node: unknown, out: Json[]) {
  if (Array.isArray(node)) return node.forEach(n => collectProducts(n, out));
  if (!node || typeof node !== "object") return;
  const o = node as Json;
  const types = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
  if (types.some(t => /^(Product|ProductGroup|IndividualProduct|ProductModel|Book|Vehicle)$/i.test(t))) out.push(o);
  if (o["@graph"]) collectProducts(o["@graph"], out);
  if (o.mainEntity) collectProducts(o.mainEntity, out);
}

function firstImage(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (typeof img === "object") return firstImage((img as Json).url ?? (img as Json).contentUrl);
  return null;
}

function offerPrice(offers: unknown): { price: number | null; currency: string | null } {
  const list = ([] as unknown[]).concat(offers ?? []);
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Json;
    const spec = ([] as unknown[]).concat(o.priceSpecification ?? [])[0] as Json | undefined;
    const price = parseStructuredPrice(o.price ?? o.lowPrice ?? spec?.price);
    if (price !== null) return { price, currency: clean(o.priceCurrency ?? spec?.priceCurrency) };
  }
  return { price: null, currency: null };
}

/* ---------- Extraction ---------- */

type Extracted = Omit<ScrapedProduct, "url" | "blocked"> & { siteName: string | null };

const AMAZON_PRICE_SELECTORS = [
  "#corePrice_feature_div .a-price .a-offscreen",
  "#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen",
  "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
  "#corePrice_desktop .a-price .a-offscreen",
  "#apex_desktop .a-price .a-offscreen",
  ".priceToPay .a-offscreen",
  "#tp_price_block_total_price_ww .a-offscreen",
  "#price_inside_buybox",
  "#newBuyBoxPrice",
  "#kindle-price",
  "#price",
  "#a-autoid-0-announce .a-color-price",
  ".a-price .a-offscreen",
];

function extract(html: string, base: URL): Extracted {
  const $ = cheerio.load(html);
  const meta = (...names: string[]) => {
    for (const n of names) {
      const v = clean($(`meta[property="${n}"]`).attr("content")) ?? clean($(`meta[name="${n}"]`).attr("content"));
      if (v) return v;
    }
    return null;
  };

  const products: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().replace(/[\u0000-\u001f]+/g, " ");
    try {
      collectProducts(JSON.parse(text), products);
    } catch {
      /* JSON-LD invalide : on ignore */
    }
  });
  const p = products[0];
  let ldPrice = p ? offerPrice(p.offers) : { price: null, currency: null };
  if (p && ldPrice.price === null && Array.isArray(p.hasVariant)) ldPrice = offerPrice((p.hasVariant[0] as Json)?.offers);

  const isAmazon = /(^|\.)amazon\./i.test(base.hostname);

  // Titre
  let title =
    (isAmazon ? clean($("#productTitle").text()) ?? clean($("#ebooksProductTitle").text()) : null) ??
    clean(p?.name) ??
    meta("og:title", "twitter:title") ??
    clean($("h1").first().text()) ??
    clean($("title").first().text());
  if (title && isAmazon) title = title.replace(/\s*:\s*Amazon\.[a-z.]+.*$/i, "").replace(/^Amazon\.[a-z.]+\s*:\s*/i, "");

  // Prix
  let price: number | null = null;
  let currency: string | null = null;
  if (isAmazon) {
    for (const sel of AMAZON_PRICE_SELECTORS) {
      const t = clean($(sel).first().text());
      const v = parsePriceText(t ?? undefined);
      if (v) {
        price = v;
        currency = currencyFromText(t);
        break;
      }
    }
    if (price === null) {
      const whole = clean($(".a-price-whole").first().text())?.replace(/[^\d]/g, "");
      const frac = clean($(".a-price-fraction").first().text())?.replace(/[^\d]/g, "");
      if (whole) price = parsePriceText(`${whole},${frac || "00"}`);
    }
  }
  if (price === null && ldPrice.price !== null) {
    price = ldPrice.price;
    currency = ldPrice.currency;
  }
  if (price === null) {
    const m = meta("product:price:amount", "og:price:amount", "twitter:data1");
    const itemprop = $('[itemprop="price"]').first();
    const raw = m ?? clean(itemprop.attr("content")) ?? clean(itemprop.text());
    price = m ? parseStructuredPrice(m) : parsePriceText(raw ?? undefined);
    currency = meta("product:price:currency", "og:price:currency") ?? clean($('[itemprop="priceCurrency"]').attr("content")) ?? currencyFromText(raw);
  }
  if (price === null) {
    // Dernier recours : premier élément "price" qui affiche un montant en euros.
    $('[class*="price" i], [data-testid*="price" i], [id*="price" i]').each((_, el) => {
      if (price !== null) return;
      const t = clean($(el).text());
      if (t && t.length < 40 && /€/.test(t)) {
        price = parsePriceText(t);
        currency = "EUR";
      }
    });
  }

  // Photo
  let image: string | null = null;
  if (isAmazon) {
    const landing = $("#landingImage, #imgBlkFront, #ebooksImgBlkFront, #main-image").first();
    image = clean(landing.attr("data-old-hires")) ?? null;
    if (!image) {
      try {
        const dyn = JSON.parse(landing.attr("data-a-dynamic-image") ?? "{}") as Record<string, [number, number]>;
        image = Object.entries(dyn).sort((a, b) => b[1][0] - a[1][0])[0]?.[0] ?? null;
      } catch {
        /* rien */
      }
    }
    image ??= clean(landing.attr("src"));
  }
  image ??=
    firstImage(p?.image) ??
    meta("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src") ??
    clean($('link[rel="image_src"]').attr("href")) ??
    clean($('[itemprop="image"]').first().attr("content") ?? $('[itemprop="image"]').first().attr("src"));

  return {
    title: title ? title.slice(0, 300) : null,
    price,
    currency: currency ? currency.toUpperCase().slice(0, 8) : price !== null ? "EUR" : null,
    image_url: absolutize(image, base),
    merchant: null,
    siteName: meta("og:site_name"),
  };
}

function looksBlocked(html: string, data: Extracted, base: URL): boolean {
  if (!html) return true;
  if (/captcha|validateCaptcha|robot check|Access Denied|cf-chl|challenge-platform/i.test(html.slice(0, 200_000)) && !data.price) return true;
  if (/(^|\.)amazon\./i.test(base.hostname) && !data.price && !/productTitle/.test(html)) return true;
  return !data.title && !data.image_url;
}

/** Titre lisible tiré de l'adresse (ex. amazon.fr/Lego-Orchidee/dp/…). */
function titleFromPath(u: URL): string | null {
  const seg = u.pathname.split("/").filter(Boolean);
  const dp = seg.findIndex(s => s === "dp" || s === "gp");
  const candidate = dp > 0 ? seg[dp - 1] : seg.sort((a, b) => b.length - a.length)[0];
  if (!candidate || candidate.length < 6 || /^[A-Z0-9]{10}$/.test(candidate)) return null;
  const t = decodeURIComponent(candidate).replace(/\.(html?|php|aspx?)$/i, "").replace(/[-_+]+/g, " ").replace(/\b\d{6,}\b/g, "").trim();
  return t.length >= 6 ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

function canonicalUrl(original: URL, final: URL): string {
  if (/(^|\.)amazon\./i.test(final.hostname)) {
    const asin = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i.exec(final.pathname)?.[1];
    if (asin) return `https://${final.hostname}/dp/${asin.toUpperCase()}`;
  }
  return original.toString();
}

export async function scrapeProduct(input: string): Promise<ScrapedProduct> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ScrapeError("Ce n'est pas un lien valide. Copie l'adresse complète de la page du produit.");
  }

  let data: Extracted = { title: null, price: null, currency: null, image_url: null, merchant: null, siteName: null };
  let finalUrl = url;
  let blocked = true;
  try {
    const page = await fetchHtml(url);
    finalUrl = page.finalUrl;
    data = extract(page.html, page.finalUrl);
    blocked = page.status >= 400 || looksBlocked(page.html, data, page.finalUrl);
  } catch (e) {
    if (e instanceof ScrapeError) throw e;
  }

  // Page refusée ou vide : on ne garde pas un titre générique ("Amazon.fr", "Access denied"…).
  if (blocked || (data.title && /^(amazon\.[a-z.]+|page introuvable|access denied|just a moment.*|attention required.*|robot check)$/i.test(data.title))) {
    if (blocked && data.price === null) data.title = null;
  }
  data.title ??= titleFromPath(finalUrl) ?? titleFromPath(url);

  return {
    url: canonicalUrl(url, finalUrl),
    title: data.title,
    price: data.price,
    currency: data.currency,
    image_url: blocked && data.price === null ? null : data.image_url,
    merchant: merchantFrom(finalUrl, data.siteName),
    blocked: blocked && data.price === null,
  };
}

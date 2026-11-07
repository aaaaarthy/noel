import { NextResponse } from "next/server";
import { scrapeProduct, ScrapeError } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: Request) {
  let url: unknown;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof url !== "string" || !url.trim() || url.length > 2048) {
    return NextResponse.json({ error: "Colle le lien d'un produit." }, { status: 400 });
  }
  try {
    const product = await scrapeProduct(url);
    return NextResponse.json(product, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof ScrapeError ? e.message : "Impossible de lire ce lien. Tu peux remplir le cadeau à la main.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

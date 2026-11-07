import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListView from "@/components/noel/list-view";
import { api, ApiError, DEMO, type GiftList } from "@/lib/api";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<GiftList | null> {
  try {
    return await api.getList(slug);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (DEMO) return { title: "Liste de Noël" };
  const list = await load((await params).slug);
  if (!list) return { title: "Liste introuvable · Liste de Noël" };
  return {
    title: `${list.title} · Liste de Noël`,
    description: `La liste de Noël de ${list.owner_name} : ${list.items.length} idée${list.items.length > 1 ? "s" : ""} cadeau.`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  // Mode démo : les données vivent dans le navigateur, la page se charge côté client.
  if (DEMO) return <ListView slug={slug} initial={null} />;
  const list = await load(slug);
  if (!list) notFound();
  // Le serveur n'envoie jamais les réservations : le navigateur les demande une fois qu'il sait
  // si c'est le propriétaire (qui ne doit rien voir) ou un proche.
  const neutral: GiftList = { ...list, items: list.items.map(i => ({ ...i, reserved: false, reserved_by: null })) };
  return <ListView slug={slug} initial={neutral} />;
}

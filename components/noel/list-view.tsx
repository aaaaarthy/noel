"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/arc/input/input";
import { AnimatedCounter } from "@/components/arc/animated-counter/animated-counter";
import { Rating } from "@/components/arc/rating/rating";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import Toast from "@/components/arc/toast/toast";
import { api, ApiError, scrapeLink, type GiftList, type Item, type ItemInput } from "@/lib/api";
import { DESIRE_LABELS, isHttpUrl } from "@/lib/format";
import { local } from "@/lib/local";
import { Footer, Header, Postmark, Waves, useDaysUntilChristmas } from "./bits";
import { ItemCard } from "./item-card";
import { ItemDialog } from "./item-dialog";
import { ListDialog, ReserveDialog } from "./small-dialogs";
import styles from "./noel.module.css";

type Role = "loading" | "owner" | "visitor";
type Sort = "envie" | "prix" | "recent";
type Editing = { item: Item | null; notice?: { title: string; text: string } | null } | null;

const SORTS = [
  { value: "envie", label: "Envie" },
  { value: "prix", label: "Prix" },
  { value: "recent", label: "Récents" },
];

function sortItems(items: Item[], sort: Sort) {
  const copy = [...items];
  const byDate = (a: Item, b: Item) => b.created_at.localeCompare(a.created_at);
  if (sort === "envie") return copy.sort((a, b) => b.desire - a.desire || byDate(a, b));
  if (sort === "recent") return copy.sort(byDate);
  return copy.sort((a, b) => (a.price === null ? 1 : b.price === null ? -1 : a.price - b.price));
}

export default function ListView({ slug, initial }: { slug: string; initial: GiftList | null }) {
  const [list, setList] = useState<GiftList | null>(initial);
  const [missing, setMissing] = useState(false);
  const [role, setRole] = useState<Role>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>("envie");
  const [filter, setFilter] = useState("tous");
  const [editing, setEditing] = useState<Editing>(null);
  const [reserving, setReserving] = useState<Item | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [toast, setToast] = useState<{ id: number; title: string; description?: string } | null>(null);
  const days = useDaysUntilChristmas();

  // Qui regarde ? Le lien secret (?k=…) ou celui gardé dans ce navigateur fait de toi le propriétaire.
  useEffect(() => {
    setOrigin(window.location.origin);
    setReservations(local.reservations());
    setVisitorName(local.visitorName());
    const fromUrl = new URLSearchParams(window.location.search).get("k");
    if (fromUrl) window.history.replaceState(null, "", window.location.pathname);
    const candidate = fromUrl ?? local.tokenFor(slug);
    let cancelled = false;
    (async () => {
      try {
        const fresh = await api.getList(slug, candidate);
        if (cancelled) return;
        setList(fresh);
        if (fresh.is_owner && candidate) {
          setToken(candidate);
          setRole("owner");
          local.saveList({ slug, token: candidate, title: fresh.title, owner: fresh.owner_name });
        } else {
          if (candidate) local.forgetList(slug);
          setRole("visitor");
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setMissing(true);
        setRole("visitor");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const refresh = useCallback(async () => {
    const fresh = await api.getList(slug, token);
    setList(fresh);
    return fresh;
  }, [slug, token]);

  const items = useMemo(() => {
    if (!list) return [];
    const sorted = sortItems(list.items, sort);
    return role === "visitor" && filter === "libres" ? sorted.filter(i => !i.reserved) : sorted;
  }, [list, sort, role, filter]);

  if (missing) {
    return (
      <>
        <Header />
        <main className={`page ${styles.listPage}`}>
          <div className={styles.emptyCard}>
            <EmptyState
              icon={<Gift aria-hidden="true" />}
              title="Cette liste n'existe pas"
              description="Le lien est peut-être incomplet. Demande-le à nouveau à la personne qui te l'a envoyé."
            />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!list) {
    return (
      <>
        <Header />
        <main className={`page ${styles.listPage}`} aria-busy="true">
          <div className={styles.emptyCard}><Skeleton lines={3} label="Chargement de la liste" /></div>
        </main>
      </>
    );
  }

  const current = list;

  /* ---------- Propriétaire ---------- */

  async function addFromLink(url: string, desire: number) {
    if (!token) return;
    const found = await scrapeLink(url);
    const id = await api.addItem(slug, token, {
      title: found.title, url: found.url, image_url: found.image_url, price: found.price,
      currency: found.currency, merchant: found.merchant, desire,
    });
    const fresh = await refresh();
    const added = fresh.items.find(i => i.id === id) ?? null;
    const shop = found.merchant ?? "Ce site";
    if (found.blocked) {
      setEditing({
        item: added,
        notice: { title: `${shop} n'a pas laissé lire sa page`, text: "Vérifie le nom, puis ajoute le prix et la photo." },
      });
    } else if (found.price === null || !found.image_url || !found.title) {
      const gaps = [found.price === null && "le prix", !found.image_url && "la photo", !found.title && "le nom"].filter(Boolean).join(" et ");
      setEditing({ item: added, notice: { title: "Il manque une info", text: `Je n'ai pas trouvé ${gaps} sur la page. Complète si tu veux.` } });
    }
  }

  async function saveItem(input: ItemInput) {
    if (!token) return;
    if (editing?.item) await api.updateItem(slug, token, editing.item.id, input);
    else await api.addItem(slug, token, input);
    await refresh();
    setEditing(null);
  }

  async function deleteItem() {
    if (!token || !editing?.item) return;
    await api.deleteItem(slug, token, editing.item.id);
    await refresh();
    setEditing(null);
  }

  async function changeDesire(item: Item, desire: number) {
    if (!token || desire === item.desire) return;
    setList(l => (l ? { ...l, items: l.items.map(i => (i.id === item.id ? { ...i, desire } : i)) } : l));
    try {
      await api.updateItem(slug, token, item.id, { desire });
    } catch {
      setToast({ id: Date.now(), title: "L'envie n'a pas été enregistrée", description: "Vérifie ta connexion, puis choisis à nouveau." });
      await refresh().catch(() => {});
    }
  }

  async function saveList(title: string, owner: string, message: string) {
    if (!token) return;
    await api.updateList(slug, token, title, owner, message);
    const fresh = await refresh();
    local.saveList({ slug, token, title: fresh.title, owner: fresh.owner_name });
    setEditingList(false);
  }

  /* ---------- Visiteur ---------- */

  async function reserve(name: string) {
    if (!reserving) return;
    const reserveToken = await api.reserve(reserving.id, name);
    local.saveReservation(reserving.id, reserveToken);
    local.saveVisitorName(name);
    setReservations(local.reservations());
    setVisitorName(name);
    await refresh().catch(() => {});
    setReserving(null);
  }

  async function unreserve(item: Item) {
    const reserveToken = reservations[item.id];
    if (!reserveToken) return;
    setBusyItem(item.id);
    try {
      await api.unreserve(item.id, reserveToken);
      local.forgetReservation(item.id);
      setReservations(local.reservations());
      await refresh();
    } catch (e) {
      setToast({ id: Date.now(), title: "Impossible d'annuler", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyItem(null);
    }
  }

  /* ---------- Affichage ---------- */

  const total = current.items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const free = current.items.filter(i => !i.reserved).length;
  const dreams = current.items.filter(i => i.desire === 5).length;
  const publicUrl = `${origin}/l/${slug}`;
  const editUrl = token ? `${publicUrl}?k=${token}` : "";
  const cardMode = role === "owner" ? "owner" : role === "visitor" ? "visitor" : "loading";
  const n = current.items.length;

  return (
    <>
      <Header />
      <main className={`page ${styles.listPage}`}>
        <section className={styles.intro} aria-labelledby="list-title">
          <div className={styles.introText}>
            <p className={styles.kicker}>Liste de Noël</p>
            <h1 id="list-title" className={`${styles.display} ${styles.listTitle}`}>{current.title}</h1>
            <p className={styles.byline}>Organisée par {current.owner_name}</p>
            {current.message ? <p className={styles.message}>{current.message}</p> : null}
          </div>
          <div className={styles.introAside}>
            <Waves className={styles.introWaves} />
            <Postmark
              className={styles.introPostmark}
              top="Noël dans"
              bottom="Paris · 25 déc."
              big={days === null ? "…" : String(Math.max(days, 0))}
              small={days === 1 ? "jour" : "jours"}
            />
            {role === "owner" ? (
              <Button variant="secondary" onClick={() => setEditingList(true)}>Modifier la liste</Button>
            ) : null}
          </div>
        </section>

        <div className={styles.tickets}>
          <div className={styles.ticket}>
            <span className={styles.ticketLabel}>Idées</span>
            <span className={styles.ticketValue}><AnimatedCounter value={n} /></span>
          </div>
          <div className={styles.ticket}>
            <span className={styles.ticketLabel}>Budget total</span>
            <span className={styles.ticketValue}><AnimatedCounter value={Math.round(total)} suffix={"\u00a0€"} /></span>
          </div>
          <div className={styles.ticket}>
            <span className={styles.ticketLabel}>{role === "visitor" ? "Encore libres" : "Rêves absolus"}</span>
            <span className={styles.ticketValue}><AnimatedCounter value={role === "visitor" ? free : dreams} /></span>
          </div>
        </div>

        {role === "owner" ? (
          <div className={styles.ownerRow}>
            <AddPanel onAdd={addFromLink} onManual={() => setEditing({ item: null })} />
            <section className={styles.panel} aria-labelledby="share-title">
              <h2 id="share-title" className={styles.panelTitle}>Partager la liste</h2>
              <div className={styles.shareItem}>
                <span className={styles.shareLabel} id="public-label">Lien pour tes proches</span>
                <div className={styles.shareRow}>
                  <span className={styles.shareUrl} aria-labelledby="public-label">{publicUrl}</span>
                  <CopyButton value={publicUrl} label="Copier" />
                </div>
              </div>
              <div className={styles.shareItem}>
                <span className={styles.shareLabel} id="edit-label">Ton lien secret pour modifier</span>
                <div className={styles.shareRow}>
                  <span className={styles.shareUrl} aria-labelledby="edit-label">{editUrl}</span>
                  <CopyButton value={editUrl} label="Copier" />
                </div>
                <p className={styles.hint}>Garde-le pour toi. En mode édition, tu ne vois pas qui offre quoi.</p>
              </div>
            </section>
          </div>
        ) : null}

        {n > 0 ? (
          <div className={styles.toolbar}>
            <SegmentedControl label="Trier les cadeaux" options={SORTS} value={sort} onValueChange={v => setSort(v as Sort)} />
            {role === "visitor" ? (
              <SegmentedControl
                label="Filtrer les cadeaux"
                options={[{ value: "tous", label: "Tous" }, { value: "libres", label: "Encore libres" }]}
                value={filter}
                onValueChange={setFilter}
              />
            ) : (
              <span className={styles.count}>{n} idée{n > 1 ? "s" : ""}</span>
            )}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className={styles.grid}>
            {items.map((item, index) => (
              <ItemCard
                key={item.id}
                index={index}
                item={item}
                mode={cardMode}
                mine={!!reservations[item.id]}
                busy={busyItem === item.id}
                onEdit={() => setEditing({ item })}
                onDesire={value => changeDesire(item, value)}
                onReserve={() => setReserving(item)}
                onUnreserve={() => unreserve(item)}
              />
            ))}
          </div>
        ) : role === "owner" ? (
          <div className={styles.emptyCard}><EmptyState
            icon={<Gift aria-hidden="true" />}
            title="Ta liste est vide"
            description="Colle le lien d'un produit dans « Ajouter un cadeau » : son nom, sa photo et son prix se remplissent tout seuls."
          /></div>
        ) : role === "visitor" ? (
          <div className={styles.emptyCard}><EmptyState
            icon={<Gift aria-hidden="true" />}
            title={n ? "Tout est réservé" : "Pas encore d'idées"}
            description={n ? "Chaque cadeau a déjà quelqu'un pour l'offrir." : `${current.owner_name} n'a encore rien ajouté. Repasse un peu plus tard.`}
            action={n ? <Button variant="secondary" onClick={() => setFilter("tous")}>Voir tous les cadeaux</Button> : undefined}
          /></div>
        ) : null}
      </main>
      <Footer />

      <ItemDialog
        open={!!editing}
        onOpenChange={open => !open && setEditing(null)}
        item={editing?.item ?? null}
        notice={editing?.notice}
        onSave={saveItem}
        onDelete={editing?.item ? deleteItem : undefined}
      />
      <ReserveDialog
        item={reserving}
        ownerName={current.owner_name}
        defaultName={visitorName}
        onOpenChange={open => !open && setReserving(null)}
        onReserve={reserve}
      />
      {role === "owner" ? <ListDialog open={editingList} list={current} onOpenChange={setEditingList} onSave={saveList} /> : null}

      <div className={styles.toastDock}>
        {toast ? <Toast key={toast.id} title={toast.title} description={toast.description} open onOpenChange={open => !open && setToast(null)} /> : null}
      </div>
    </>
  );
}

/* ---------- Ajout par lien ---------- */

function AddPanel({ onAdd, onManual }: { onAdd: (url: string, desire: number) => Promise<void>; onManual: () => void }) {
  const [url, setUrl] = useState("");
  const [desire, setDesire] = useState(3);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1800);
    return () => window.clearTimeout(t);
  }, [done]);

  async function add(value: string) {
    const link = value.trim();
    if (!isHttpUrl(link)) {
      setError("Colle l'adresse complète de la page du produit. Elle commence par https://");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onAdd(link, desire);
      setUrl("");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ce lien n'a pas pu être ajouté. Réessaie ou ajoute le cadeau sans lien.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="add-title">
      <h2 id="add-title" className={styles.panelTitle}>Ajouter un cadeau</h2>
      <form
        className={styles.dialogForm}
        onSubmit={event => {
          event.preventDefault();
          void add(url);
        }}
        noValidate
      >
        <Input
          ref={inputRef}
          id="add-link"
          label="Lien du produit"
          description={busy ? undefined : "Colle un lien : le nom, la photo et le prix se remplissent tout seuls."}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          disabled={busy}
          error={error ?? undefined}
          onChange={e => setUrl(e.target.value)}
          onPaste={event => {
            const pasted = event.clipboardData.getData("text").trim();
            if (!url.trim() && isHttpUrl(pasted)) {
              event.preventDefault();
              setUrl(pasted);
              void add(pasted);
            }
          }}
        />
        {busy ? <TextShimmer>Je lis la page du produit…</TextShimmer> : null}
        <div className={styles.addControls}>
          <Rating label="Niveau d'envie" value={desire} onChange={v => v >= 1 && setDesire(v)} allowClear={false} valueLabels={DESIRE_LABELS} />
          <div className={styles.addActions}>
            <Button type="button" variant="ghost" onClick={onManual}>Ajouter sans lien</Button>
            <Button className={styles.cta} type="submit" loading={busy}>{done ? "Ajouté" : "Ajouter le cadeau"}</Button>
          </div>
        </div>
      </form>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Countdown } from "@/components/arc/countdown/countdown";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { api } from "@/lib/api";
import { nextChristmas } from "@/lib/format";
import { local, type SavedList } from "@/lib/local";
import { Footer, Header, Postmark, Stamp, StampArt, Waves } from "./bits";
import styles from "./noel.module.css";

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("Noël 2026");
  const [owner, setOwner] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ title?: string; owner?: string; form?: string }>({});
  const [creating, setCreating] = useState(false);
  const [mine, setMine] = useState<SavedList[]>([]);
  const [target, setTarget] = useState<Date | null>(null);

  useEffect(() => {
    setMine(local.lists());
    setTarget(nextChristmas());
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      title: title.trim() ? undefined : "Donne un nom à ta liste, par exemple Noël 2026.",
      owner: owner.trim() ? undefined : "Indique ton prénom : il s'affiche sous le nom de la liste.",
    };
    setErrors(next);
    if (next.title || next.owner) return;
    setCreating(true);
    try {
      const { slug, edit_token } = await api.createList(title.trim(), owner.trim(), message.trim());
      local.saveList({ slug, token: edit_token, title: title.trim(), owner: owner.trim() });
      router.push(`/l/${slug}?k=${edit_token}`);
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : "La liste n'a pas pu être créée. Réessaie dans un instant." });
      setCreating(false);
    }
  }

  return (
    <>
      <Header />
      <main>
        <section className={`page ${styles.hero}`} aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title" className={`${styles.display} ${styles.heroTitle}`}>
              Ta liste de Noël, <em>en collant des liens.</em>
            </h1>
            <p className={styles.heroLead}>
              Colle le lien d&apos;un cadeau : son nom, sa photo et son prix se remplissent tout seuls. Note ton envie de 1 à 5, partage la liste, et tes proches réservent sans se marcher dessus.
            </p>
            <div className={`${styles.heroCountdown} ${styles.onPine}`}>
              {target ? <Countdown target={target} timeZone="Europe/Paris" units={["days", "hours", "minutes", "seconds"]} label="Temps avant Noël" /> : null}
            </div>
          </div>

          <div className={styles.collage} aria-hidden="true">
            <Stamp className={`${styles.collageGifts} ${styles.lifted}`}><StampArt kind="gifts" /></Stamp>
            <Stamp className={`${styles.collageTree} ${styles.lifted}`}><StampArt kind="tree" /></Stamp>
            <Stamp className={`${styles.collageSnow} ${styles.lifted}`}><StampArt kind="snow" /></Stamp>
            <Waves className={styles.collageWaves} />
            <Postmark className={styles.collagePostmark} top="Liste de Noël" bottom="Paris · 25 déc." big="26" small="Édition" />
          </div>
        </section>

        <div className={`page ${styles.homeSections}`}>
          <form className={styles.postcard} onSubmit={create} noValidate aria-labelledby="create-title">
            <div className={styles.postcardSide}>
              <h2 id="create-title" className={`${styles.display} ${styles.postcardTitle}`}>Crée ta liste</h2>
              <p className={styles.postcardLead}>Sans compte. Tu reçois un lien secret pour la modifier.</p>
              <Textarea
                id="new-message"
                label="Un mot pour tes proches"
                description="Facultatif. Il s'affiche en haut de la liste."
                placeholder="Voici ce qui me ferait plaisir. Merci, bisous !"
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={600}
                rows={4}
              />
            </div>
            <div className={styles.postcardRule} aria-hidden="true" />
            <div className={styles.postcardSide}>
              <Stamp className={`${styles.postcardStamp} ${styles.lifted}`}><StampArt kind="tree" /></Stamp>
              <Input id="new-title" label="Nom de la liste" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} error={errors.title} />
              <Input id="new-owner" label="Ton prénom" value={owner} onChange={e => setOwner(e.target.value)} maxLength={60} autoComplete="given-name" error={errors.owner} />
              {errors.form ? <p className={styles.error} role="alert">{errors.form}</p> : null}
              <div className={styles.formActions}>
                <Button className={styles.cta} type="submit" size="lg" loading={creating}>Créer ma liste</Button>
              </div>
            </div>
          </form>

          {mine.length ? (
            <section aria-labelledby="mine-title">
              <h2 id="mine-title" className={`${styles.display} ${styles.sectionTitle}`}>Tes listes</h2>
              <div className={styles.group}>
                {mine.map(l => (
                  <Link key={l.slug} href={`/l/${l.slug}`} className={styles.groupRow}>
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{l.title}</span>
                      <span className={styles.rowMeta}>Organisée par {l.owner}</span>
                    </span>
                    <ChevronRight className={styles.rowChevron} size={20} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="how-title">
            <h2 id="how-title" className={`${styles.display} ${styles.sectionTitle}`}>Comment ça marche</h2>
            <ol className={styles.steps}>
              {[
                ["Colle un lien", "Amazon, Fnac, IKEA ou une petite boutique : chaque lien devient un timbre avec photo, prix et boutique."],
                ["Note ton envie", "De « Pourquoi pas » à « Rêve absolu », pour que tes proches sachent ce qui compte le plus."],
                ["Partage la liste", "Tes proches réservent un cadeau. Ils voient ce qui est déjà pris, toi tu ne vois rien : la surprise reste entière."],
              ].map(([t, d], i) => (
                <li key={t} className={styles.lifted}>
                  <Stamp className={styles.stepStamp}>
                    <div className={styles.step}>
                      <span className={`${styles.display} ${styles.stepNum}`}>{i + 1}</span>
                      <span className={styles.stepTitle}>{t}</span>
                      <span className={styles.stepText}>{d}</span>
                    </div>
                  </Stamp>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

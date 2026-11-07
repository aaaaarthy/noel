"use client";

import { useState } from "react";
import { ExternalLink, Gift } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Rating } from "@/components/arc/rating/rating";
import type { Item } from "@/lib/api";
import { DESIRE_LABELS, formatPrice, hostLabel } from "@/lib/format";
import styles from "./noel.module.css";

export type CardMode = "owner" | "visitor" | "loading";

type Props = {
  item: Item;
  mode: CardMode;
  mine?: boolean;
  onEdit?: () => void;
  onDesire?: (value: number) => void;
  onReserve?: () => void;
  onUnreserve?: () => void;
  busy?: boolean;
};

export function ItemCard({ item, mode, mine, onEdit, onDesire, onReserve, onUnreserve, busy }: Props) {
  const [broken, setBroken] = useState(false);
  const price = formatPrice(item.price, item.currency);
  const shop = item.merchant ?? hostLabel(item.url);
  const reserved = mode === "visitor" && item.reserved;

  return (
    <article className={styles.card} data-reserved={reserved || undefined}>
      <div className={styles.photo}>
        {item.image_url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <Gift className={styles.placeholder} size={32} strokeWidth={1.75} aria-hidden="true" />
        )}
        {reserved ? (
          <div className={styles.photoBadge}>
            {mine ? <Badge tone="success" dot>Tu l&apos;offres</Badge> : <Badge dot>Réservé par {item.reserved_by}</Badge>}
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        {shop ? <span className={styles.merchant}>{shop}</span> : null}
        <h3 className={styles.title} title={item.title}>{item.title}</h3>
        {price ? <p className={styles.price}>{price}</p> : <p className={styles.noPrice}>Prix non renseigné</p>}
        <Rating
          className={styles.rating}
          label="Envie"
          size="sm"
          value={item.desire}
          readOnly={mode !== "owner"}
          allowClear={false}
          valueLabels={DESIRE_LABELS}
          onChange={value => value >= 1 && onDesire?.(value)}
        />
        {item.note ? <p className={styles.note}>{item.note}</p> : null}
      </div>

      <div className={styles.foot}>
        {item.url ? (
          <a className={styles.shopLink} href={item.url} target="_blank" rel="noopener noreferrer nofollow">
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{shop ? `Voir sur ${shop}` : "Voir le produit"}</span>
          </a>
        ) : <span />}

        {mode === "owner" ? (
          <Button variant="secondary" size="sm" onClick={onEdit} aria-label={`Modifier ${item.title}`}>Modifier</Button>
        ) : null}
        {mode === "visitor" && !item.reserved ? (
          <Button variant="secondary" size="sm" onClick={onReserve} loading={busy}>Je l&apos;offre</Button>
        ) : null}
        {mode === "visitor" && item.reserved && mine ? (
          <Button variant="ghost" size="sm" onClick={onUnreserve} loading={busy}>Annuler</Button>
        ) : null}
      </div>
    </article>
  );
}

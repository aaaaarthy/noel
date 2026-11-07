"use client";

import { useState, type CSSProperties } from "react";
import { ExternalLink, Gift } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Rating } from "@/components/arc/rating/rating";
import type { Item } from "@/lib/api";
import { DESIRE_LABELS, hostLabel, splitPrice, tintFor } from "@/lib/format";
import { Postmark, Stamp, Waves } from "./bits";
import styles from "./noel.module.css";

export type CardMode = "owner" | "visitor" | "loading";

type Props = {
  item: Item;
  index: number;
  mode: CardMode;
  mine?: boolean;
  onEdit?: () => void;
  onDesire?: (value: number) => void;
  onReserve?: () => void;
  onUnreserve?: () => void;
  busy?: boolean;
};

export function ItemCard({ item, index, mode, mine, onEdit, onDesire, onReserve, onUnreserve, busy }: Props) {
  const [broken, setBroken] = useState(false);
  const shop = item.merchant ?? hostLabel(item.url);
  const reserved = mode === "visitor" && item.reserved;
  const price = item.price !== null ? splitPrice(item.price, item.currency) : null;

  return (
    <div
      className={`${styles.stampItem} ${styles.lifted}`}
      data-reserved={reserved || undefined}
      style={{ "--i": index, "--tint": tintFor(item.id) } as CSSProperties}
    >
      <Stamp as="article">
        <div className={styles.plate}>
          {item.image_url && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          ) : (
            <Gift className={styles.placeholder} size={44} strokeWidth={1.5} aria-hidden="true" />
          )}
          {shop ? <span className={styles.plateLabel}>{shop}</span> : null}
          {price ? (
            <span className={styles.denom}>{price.units}<small>{price.rest}</small></span>
          ) : (
            <span className={styles.denomEmpty}>Prix non renseigné</span>
          )}
          {reserved ? (
            <>
              <Waves className={styles.postmarkWaves} />
              <Postmark className={styles.postmarkOverlay} top="Réservé" bottom={mine ? "par toi" : `par ${item.reserved_by}`} big="✓" />
            </>
          ) : null}
        </div>

        <div className={styles.caption}>
          <h3 className={styles.title} title={item.title}>{item.title}</h3>
          <Rating
            label="Envie"
            size="sm"
            value={item.desire}
            readOnly={mode !== "owner"}
            allowClear={false}
            valueLabels={DESIRE_LABELS}
            onChange={value => value >= 1 && onDesire?.(value)}
          />
          {item.note ? <p className={styles.note}>{item.note}</p> : null}
          {reserved ? <p className={styles.reservedBy}>{mine ? "Tu l'offres" : `Réservé par ${item.reserved_by}`}</p> : null}
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
            <Button className={styles.cta} size="sm" onClick={onReserve} loading={busy}>Je l&apos;offre</Button>
          ) : null}
          {mode === "visitor" && item.reserved && mine ? (
            <Button variant="ghost" size="sm" onClick={onUnreserve} loading={busy}>Annuler</Button>
          ) : null}
        </div>
      </Stamp>
    </div>
  );
}

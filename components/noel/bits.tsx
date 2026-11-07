"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { daysUntilChristmas } from "@/lib/format";
import styles from "./noel.module.css";

/** Jours avant Noël, lus après le premier rendu pour que serveur et navigateur affichent la même chose. */
export function useDaysUntilChristmas(): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => setDays(daysUntilChristmas()), []);
  return days;
}

/* ---------- Timbre : papier crème aux bords dentelés ---------- */

export function Stamp({ children, className, style, as: Tag = "div" }: { children: ReactNode; className?: string; style?: CSSProperties; as?: "div" | "article" }) {
  return <Tag className={[styles.stamp, className].filter(Boolean).join(" ")} style={style}>{children}</Tag>;
}

/* ---------- Cachet de la poste, avec un texte en cercle ---------- */

export function Postmark({ top, bottom, big, small, className }: { top: string; bottom: string; big: string; small?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id={`${id}t`} d="M 21 60 A 39 39 0 0 1 99 60" />
        <path id={`${id}b`} d="M 15 60 A 45 45 0 0 0 105 60" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <text className={styles.postmarkRing}>
        <textPath href={`#${id}t`} startOffset="50%" textAnchor="middle">{top}</textPath>
      </text>
      <text className={styles.postmarkRing}>
        <textPath href={`#${id}b`} startOffset="50%" textAnchor="middle">{bottom}</textPath>
      </text>
      <text className={styles.postmarkBig} x="60" y={small ? 66 : 70} textAnchor="middle">{big}</text>
      {small ? <text className={styles.postmarkSmall} x="60" y="82" textAnchor="middle">{small}</text> : null}
    </svg>
  );
}

/** Les ondulations d'oblitération qui accompagnent le cachet. */
export function Waves({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 60" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      {[8, 20, 32, 44, 56].map(y => (
        <path key={y} d={`M2 ${y} q 9.5 -7 19 0 t 19 0 t 19 0 t 19 0 t 19 0 t 19 0 t 19 0 t 19 0`} />
      ))}
    </svg>
  );
}

/* ---------- Illustrations des timbres décoratifs ---------- */

export function StampArt({ kind }: { kind: "gifts" | "tree" | "snow" }) {
  if (kind === "gifts") {
    return (
      <svg viewBox="0 0 120 150" className={styles.art} aria-hidden="true">
        <rect width="120" height="150" fill="var(--mustard)" />
        <text x="60" y="24" textAnchor="middle" className={styles.artLabel} fill="var(--paper)">Meilleurs vœux</text>
        <rect x="34" y="40" width="30" height="26" fill="var(--tomato)" />
        <rect x="46" y="40" width="6" height="26" fill="var(--paper)" />
        <path d="M49 40c-6-8-14-6-12-1s9 2 12 1zm0 0c6-8 14-6 12-1s-9 2-12 1z" fill="var(--paper)" />
        <rect x="22" y="66" width="44" height="30" fill="var(--sky)" />
        <rect x="40" y="66" width="7" height="30" fill="var(--paper)" />
        <rect x="66" y="58" width="34" height="38" fill="var(--pine-600)" />
        <rect x="80" y="58" width="6" height="38" fill="var(--mustard)" />
        <rect x="66" y="74" width="34" height="6" fill="var(--mustard)" />
        <rect x="16" y="96" width="40" height="34" fill="var(--orange)" />
        <rect x="16" y="109" width="40" height="7" fill="var(--paper)" />
        <rect x="56" y="96" width="50" height="34" fill="var(--tomato)" />
        <rect x="77" y="96" width="8" height="34" fill="var(--paper)" />
        <rect x="56" y="109" width="50" height="7" fill="var(--paper)" />
      </svg>
    );
  }
  if (kind === "tree") {
    return (
      <svg viewBox="0 0 120 150" className={styles.art} aria-hidden="true">
        <rect width="120" height="150" fill="var(--pine-600)" />
        <path d="M0 128 Q 40 116 70 124 T 120 120 V150 H0z" fill="var(--paper)" />
        <path d="M60 22 L84 62 H72 L92 94 H78 L98 126 H22 L42 94 H28 L48 62 H36z" fill="var(--pine-900)" />
        <path d="M44 70 Q 62 80 78 66 M38 100 Q 62 112 86 96" stroke="var(--paper)" strokeWidth="1.6" fill="none" strokeDasharray="1 4" strokeLinecap="round" />
        {[[52, 56, "var(--tomato)"], [70, 78, "var(--mustard)"], [48, 86, "var(--sky)"], [64, 104, "var(--tomato)"], [82, 112, "var(--mustard)"], [40, 116, "var(--orange)"]].map(([x, y, c]) => (
          <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="4" fill={c as string} />
        ))}
        <path d="M60 10l3 7 7 .6-5.4 4.6 1.7 7-6.3-3.8-6.3 3.8 1.7-7L50 17.6l7-.6z" fill="var(--mustard)" />
        <text x="12" y="146" className={styles.artNumber} fill="var(--tomato)">25</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 150" className={styles.art} aria-hidden="true">
      <rect width="120" height="150" fill="var(--sky)" />
      {[[14, 20], [30, 44], [98, 30], [104, 64], [18, 100], [90, 128], [40, 136], [70, 18]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="var(--paper)" />
      ))}
      <g transform="translate(60 84)" stroke="var(--paper)" strokeWidth="4" strokeLinecap="round" fill="none">
        {[0, 60, 120].map(a => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0 -38 V38" />
            <path d="M-9 -28 L0 -19 L9 -28 M-9 28 L0 19 L9 28" />
          </g>
        ))}
      </g>
      <text x="60" y="34" textAnchor="middle" className={styles.artYear} fill="var(--ink)">2026</text>
    </svg>
  );
}

/* ---------- En-tête et pied de page ---------- */

export function Header() {
  const days = useDaysUntilChristmas();
  return (
    <header className={styles.header}>
      <div className={`page ${styles.headerInner}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandStamp} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="10" rx="1" />
              <rect x="3" y="7" width="18" height="3.5" rx="1" />
              <path d="M12 7v13M12 7c-1.5-3-5-3.6-5-1.6S10.5 7 12 7zm0 0c1.5-3 5-3.6 5-1.6S13.5 7 12 7z" />
            </svg>
          </span>
          Liste de Noël
        </Link>
        <span className={styles.headerMeta}>
          {days === null ? "" : days < 0 ? "C'est Noël" : days === 0 ? "Noël demain" : `Noël dans ${days} jour${days > 1 ? "s" : ""}`}
        </span>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.footerInner}`}>
        <span>Liste de Noël, affranchie avec soin</span>
        <Link href="/">Créer une autre liste</Link>
      </div>
    </footer>
  );
}

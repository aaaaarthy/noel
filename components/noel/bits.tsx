"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { daysUntilChristmas } from "@/lib/format";
import styles from "./noel.module.css";

/** Jours avant Noël, lus après le premier rendu pour que serveur et navigateur affichent la même chose. */
export function useDaysUntilChristmas(): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => setDays(daysUntilChristmas()), []);
  return days;
}

export function Header() {
  const days = useDaysUntilChristmas();
  return (
    <header className={styles.header}>
      <div className={`page ${styles.headerInner}`}>
        <Link href="/" className={styles.brand}>
          <Gift size={20} strokeWidth={1.75} aria-hidden="true" />
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
        <span>Liste de Noël</span>
        <Link href="/">Créer une autre liste</Link>
      </div>
    </footer>
  );
}

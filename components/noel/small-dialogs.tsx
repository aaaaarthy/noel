"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import type { GiftList, Item } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import styles from "./noel.module.css";

/* ---------- Réserver un cadeau (visiteur) ---------- */

export function ReserveDialog({
  item, ownerName, defaultName, onOpenChange, onReserve,
}: {
  item: Item | null;
  ownerName: string;
  defaultName: string;
  onOpenChange: (open: boolean) => void;
  onReserve: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setName(defaultName);
      setError(null);
      setSaving(false);
    }
  }, [item, defaultName]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Indique ton prénom pour que les autres sachent que ce cadeau est pris.");
    setSaving(true);
    try {
      await onReserve(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "La réservation a échoué. Réessaie.");
      setSaving(false);
    }
  }

  const price = item ? formatPrice(item.price, item.currency) : null;

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={event => {
          event.preventDefault();
          nameRef.current?.focus();
        }}
        title="Je l'offre"
        description={item ? `${item.title}${price ? ` · ${price}` : ""}` : undefined}>
        <form className={styles.dialogForm} onSubmit={submit} noValidate>
          <p className={styles.muted}>
            Les autres visiteurs verront que ce cadeau est pris, avec ton prénom. {ownerName} ne verra rien.
          </p>
          <Input ref={nameRef} id="reserve-name" label="Ton prénom" value={name} onChange={e => setName(e.target.value)} maxLength={60} error={error ?? undefined} autoComplete="given-name" />
          <div className={styles.dialogActions}>
            <div className={styles.dialogActionsEnd}>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Annuler</Button>
              </DialogClose>
              <Button type="submit" loading={saving}>Réserver ce cadeau</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Modifier l'en-tête de la liste (propriétaire) ---------- */

export function ListDialog({
  open, list, onOpenChange, onSave,
}: {
  open: boolean;
  list: GiftList;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, owner: string, message: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(list.title);
  const [owner, setOwner] = useState(list.owner_name);
  const [message, setMessage] = useState(list.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(list.title);
    setOwner(list.owner_name);
    setMessage(list.message ?? "");
    setError(null);
    setSaving(false);
  }, [open, list]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !owner.trim()) return setError("Le nom de la liste et ton prénom sont obligatoires.");
    setSaving(true);
    try {
      await onSave(title.trim(), owner.trim(), message.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué. Réessaie.");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Modifier la liste">
        <form className={styles.dialogForm} onSubmit={submit} noValidate>
          <Input id="list-title" label="Nom de la liste" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} />
          <Input id="list-owner" label="Ton prénom" value={owner} onChange={e => setOwner(e.target.value)} maxLength={60} />
          <Textarea id="list-message" label="Un mot pour tes proches" value={message} onChange={e => setMessage(e.target.value)} maxLength={600} rows={3} />
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.dialogActions}>
            <div className={styles.dialogActionsEnd}>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Annuler</Button>
              </DialogClose>
              <Button type="submit" loading={saving}>Enregistrer la liste</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

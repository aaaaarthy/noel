"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { Rating } from "@/components/arc/rating/rating";
import { Textarea } from "@/components/arc/textarea/textarea";
import type { Item, ItemInput } from "@/lib/api";
import { DESIRE_LABELS, isHttpUrl, parsePriceInput } from "@/lib/format";
import { Gift } from "lucide-react";
import styles from "./noel.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  notice?: { title: string; text: string } | null;
  onSave: (input: ItemInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

type Errors = Partial<Record<"title" | "price" | "image_url" | "url" | "form", string>>;

export function ItemDialog({ open, onOpenChange, item, notice, onSave, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [url, setUrl] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [desire, setDesire] = useState(3);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const firstEmpty = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setPrice(item?.price != null ? String(item.price).replace(".", ",") : "");
    setImage(item?.image_url ?? "");
    setUrl(item?.url ?? "");
    setMerchant(item?.merchant ?? "");
    setNote(item?.note ?? "");
    setDesire(item?.desire ?? 3);
    setErrors({});
    setSaving(false);
  }, [open, item]);

  useEffect(() => setThumbBroken(false), [image]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    const parsedPrice = parsePriceInput(price);
    if (!title.trim()) next.title = "Donne un nom à ce cadeau.";
    if (parsedPrice === "invalid") next.price = "Écris un montant, par exemple 24,90.";
    if (image.trim() && !isHttpUrl(image)) next.image_url = "L'adresse de la photo doit commencer par https://";
    if (url.trim() && !isHttpUrl(url)) next.url = "Le lien doit commencer par https://";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        price: parsedPrice === "invalid" ? null : parsedPrice,
        image_url: image.trim() || null,
        url: url.trim() || null,
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        desire,
      });
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : "L'enregistrement a échoué. Réessaie." });
      setSaving(false);
    }
  }

  const showThumb = image.trim() && isHttpUrl(image) && !thumbBroken;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={event => {
          event.preventDefault();
          firstEmpty.current?.focus();
        }}
        title={item ? "Modifier le cadeau" : "Ajouter un cadeau"}
        description={item ? undefined : "Seul le nom est obligatoire."}
      >
        <form className={styles.dialogForm} onSubmit={submit} noValidate>
          {notice ? <Alert tone="warning" title={notice.title}>{notice.text}</Alert> : null}

          <Input ref={notice ? undefined : firstEmpty} id="item-title" label="Nom du cadeau" value={title} onChange={e => setTitle(e.target.value)} error={errors.title} maxLength={300} required />

          <div className={styles.twoCols}>
            <Input ref={notice ? firstEmpty : undefined} id="item-price" label="Prix (€)" inputMode="decimal" placeholder="24,90" value={price} onChange={e => setPrice(e.target.value)} error={errors.price} />
            <Input id="item-merchant" label="Boutique" placeholder="Amazon, Fnac…" value={merchant} onChange={e => setMerchant(e.target.value)} maxLength={80} />
          </div>

          <div className={styles.imageRow}>
            <div className={styles.thumb}>
              {showThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.trim()} alt="" referrerPolicy="no-referrer" onError={() => setThumbBroken(true)} />
              ) : (
                <Gift size={24} strokeWidth={1.75} aria-hidden="true" />
              )}
            </div>
            <Input
              id="item-image"
              label="Adresse de la photo"
              type="url"
              placeholder="https://…/photo.jpg"
              description="Sur la page du produit, fais un clic droit sur la photo, puis « Copier l'adresse de l'image »."
              value={image}
              onChange={e => setImage(e.target.value)}
              error={errors.image_url}
            />
          </div>

          <Input id="item-url" label="Lien pour l'acheter" type="url" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} error={errors.url} />

          <Rating label="Niveau d'envie" value={desire} onChange={v => v >= 1 && setDesire(v)} allowClear={false} valueLabels={DESIRE_LABELS} />

          <Textarea id="item-note" label="Précision (facultatif)" placeholder="Taille M, couleur bleu nuit…" value={note} onChange={e => setNote(e.target.value)} maxLength={400} rows={2} />

          {errors.form ? <p className={styles.error} role="alert">{errors.form}</p> : null}

          <div className={styles.dialogActions}>
            {item && onDelete ? (
              <ConfirmMorph label="Supprimer le cadeau" prompt="Supprimer ce cadeau ?" confirmLabel="Supprimer" onConfirm={onDelete} />
            ) : null}
            <div className={styles.dialogActionsEnd}>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Annuler</Button>
              </DialogClose>
              <Button type="submit" loading={saving}>{item ? "Enregistrer le cadeau" : "Ajouter le cadeau"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

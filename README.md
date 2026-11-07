# Liste de Noël

Crée une liste de Noël en collant des liens : le nom, la photo, le prix et la boutique se remplissent tout seuls. Chaque idée a un niveau d'envie de 1 à 5. On partage un lien public, les proches réservent un cadeau, et la personne qui a fait la liste ne voit pas qui offre quoi.

- Next.js 16 (App Router), composants [Arc](https://uiarc.dev) dans `components/arc/`
- Supabase pour les données : tables dans un schéma privé `noel`, accès uniquement par les fonctions `public.noel_*`
- Import des produits côté serveur dans `lib/scrape.ts` (JSON-LD, Open Graph, sélecteurs Amazon). Une seule requête par lien, sans contournement : si un site refuse les robots, la fiche s'ouvre pour être complétée à la main.

## Mise en route

1. Dans Supabase, ouvre le SQL Editor et exécute `supabase/schema.sql`.
2. Copie `.env.example` en `.env.local` et renseigne l'URL du projet et la clé publishable.
3. Lance le site :

```bash
pnpm install
pnpm dev
```

### Mode démo

Pour travailler l'interface sans base, mets `NEXT_PUBLIC_DEMO=1` dans `.env.local`. Les listes vivent alors dans le navigateur (localStorage).

## Comment marchent les droits

- Créer une liste renvoie un `edit_token` secret. Le lien `/l/<slug>?k=<token>` ouvre la liste en mode édition et le navigateur s'en souvient.
- Les visiteurs réservent avec leur prénom. Ils reçoivent un jeton qui leur permet d'annuler depuis le même appareil.
- `noel_get_list` ne renvoie jamais les réservations au propriétaire, et la page serveur ne les envoie à personne : le navigateur les demande une fois qu'il sait qui regarde.

## Déploiement

Sur Vercel, avec les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

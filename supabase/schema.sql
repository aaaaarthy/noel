-- Liste de Noël : schéma Supabase
-- À coller tel quel dans le SQL Editor du projet, puis "Run".
-- Les tables vivent dans un schéma privé "noel" (jamais exposé par l'API).
-- Le site n'y accède que par les fonctions public.noel_* ci-dessous,
-- qui vérifient le lien secret d'édition avant toute modification.

create schema if not exists noel;

create table if not exists noel.lists (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null check (char_length(title) between 1 and 80),
  owner_name  text not null check (char_length(owner_name) between 1 and 60),
  message     text check (message is null or char_length(message) <= 600),
  edit_token  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists noel.items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references noel.lists(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 300),
  url           text check (url is null or (char_length(url) <= 2048 and url ~* '^https?://')),
  image_url     text check (image_url is null or (char_length(image_url) <= 2048 and image_url ~* '^https?://')),
  price         numeric(10,2) check (price is null or price >= 0),
  currency      text not null default 'EUR' check (char_length(currency) <= 8),
  merchant      text check (merchant is null or char_length(merchant) <= 80),
  desire        smallint not null default 3 check (desire between 1 and 5),
  note          text check (note is null or char_length(note) <= 400),
  reserved_by   text check (reserved_by is null or char_length(reserved_by) <= 60),
  reserve_token text,
  reserved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists items_list_id_idx on noel.items(list_id);

alter table noel.lists enable row level security;
alter table noel.items enable row level security;
revoke all on schema noel from public;

-- Vérifie le lien secret d'édition et renvoie l'id de la liste.
create or replace function noel.owner_list_id(p_slug text, p_token text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_id uuid;
begin
  select l.id into v_id from noel.lists l
   where l.slug = p_slug and p_token is not null and l.edit_token = p_token;
  if v_id is null then
    raise exception 'Ce lien d''édition n''est pas valide.' using errcode = 'PT403';
  end if;
  return v_id;
end $$;

-- Créer une liste. Renvoie { slug, edit_token }.
create or replace function public.noel_create_list(p_title text, p_owner_name text, p_message text default null)
returns json
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_base  text;
  v_slug  text;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_try   int := 0;
begin
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'Donne un nom à ta liste.' using errcode = 'PT400';
  end if;
  if coalesce(btrim(p_owner_name), '') = '' then
    raise exception 'Indique ton prénom.' using errcode = 'PT400';
  end if;

  v_base := translate(lower(btrim(p_title)), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');
  v_base := replace(replace(v_base, 'œ', 'oe'), 'æ', 'ae');
  v_base := btrim(regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'), '-');
  v_base := btrim(left(v_base, 40), '-');
  if v_base = '' then v_base := 'liste'; end if;

  loop
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
    exit when not exists (select 1 from noel.lists where slug = v_slug);
    v_try := v_try + 1;
    if v_try > 10 then raise exception 'Réessaie dans un instant.'; end if;
  end loop;

  insert into noel.lists (slug, title, owner_name, message, edit_token)
  values (v_slug, left(btrim(p_title), 80), left(btrim(p_owner_name), 60),
          nullif(left(btrim(coalesce(p_message, '')), 600), ''), v_token);

  return json_build_object('slug', v_slug, 'edit_token', v_token);
end $$;

-- Lire une liste. Le propriétaire (bon jeton) ne voit pas les réservations : surprise.
create or replace function public.noel_get_list(p_slug text, p_token text default null)
returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_list  noel.lists;
  v_owner boolean;
begin
  select * into v_list from noel.lists where slug = p_slug;
  if not found then
    raise exception 'Cette liste n''existe pas (ou plus).' using errcode = 'PT404';
  end if;
  v_owner := p_token is not null and p_token = v_list.edit_token;

  return json_build_object(
    'slug', v_list.slug,
    'title', v_list.title,
    'owner_name', v_list.owner_name,
    'message', v_list.message,
    'created_at', v_list.created_at,
    'is_owner', v_owner,
    'items', coalesce((
      select json_agg(json_build_object(
        'id', i.id,
        'title', i.title,
        'url', i.url,
        'image_url', i.image_url,
        'price', i.price,
        'currency', i.currency,
        'merchant', i.merchant,
        'desire', i.desire,
        'note', i.note,
        'created_at', i.created_at,
        'reserved', case when v_owner then false else i.reserved_by is not null end,
        'reserved_by', case when v_owner then null else i.reserved_by end
      ) order by i.desire desc, i.created_at desc)
      from noel.items i where i.list_id = v_list.id
    ), '[]'::json)
  );
end $$;

-- Modifier l'en-tête d'une liste.
create or replace function public.noel_update_list(p_slug text, p_token text, p_title text, p_owner_name text, p_message text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_id uuid := noel.owner_list_id(p_slug, p_token);
begin
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_owner_name), '') = '' then
    raise exception 'Le nom de la liste et ton prénom sont obligatoires.' using errcode = 'PT400';
  end if;
  update noel.lists
     set title = left(btrim(p_title), 80),
         owner_name = left(btrim(p_owner_name), 60),
         message = nullif(left(btrim(coalesce(p_message, '')), 600), '')
   where id = v_id;
end $$;

-- Ajouter un cadeau. p_item = { title, url, image_url, price, currency, merchant, desire, note }.
create or replace function public.noel_add_item(p_slug text, p_token text, p_item jsonb)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_list_id uuid := noel.owner_list_id(p_slug, p_token);
  v_id uuid;
begin
  if (select count(*) from noel.items where list_id = v_list_id) >= 300 then
    raise exception 'Ta liste est pleine (300 idées max).' using errcode = 'PT400';
  end if;

  insert into noel.items (list_id, title, url, image_url, price, currency, merchant, desire, note)
  values (
    v_list_id,
    left(coalesce(nullif(btrim(p_item->>'title'), ''), 'Idée cadeau'), 300),
    nullif(btrim(p_item->>'url'), ''),
    nullif(btrim(p_item->>'image_url'), ''),
    nullif(btrim(p_item->>'price'), '')::numeric,
    coalesce(nullif(btrim(p_item->>'currency'), ''), 'EUR'),
    left(nullif(btrim(p_item->>'merchant'), ''), 80),
    coalesce(nullif(p_item->>'desire', '')::smallint, 3),
    left(nullif(btrim(p_item->>'note'), ''), 400)
  )
  returning id into v_id;
  return v_id;
end $$;

-- Modifier un cadeau. Seuls les champs présents dans p_item sont changés.
create or replace function public.noel_update_item(p_slug text, p_token text, p_item_id uuid, p_item jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_list_id uuid := noel.owner_list_id(p_slug, p_token);
begin
  update noel.items set
    title     = case when p_item ? 'title'     then left(coalesce(nullif(btrim(p_item->>'title'), ''), title), 300) else title end,
    url       = case when p_item ? 'url'       then nullif(btrim(p_item->>'url'), '') else url end,
    image_url = case when p_item ? 'image_url' then nullif(btrim(p_item->>'image_url'), '') else image_url end,
    price     = case when p_item ? 'price'     then nullif(btrim(p_item->>'price'), '')::numeric else price end,
    currency  = case when p_item ? 'currency'  then coalesce(nullif(btrim(p_item->>'currency'), ''), 'EUR') else currency end,
    merchant  = case when p_item ? 'merchant'  then left(nullif(btrim(p_item->>'merchant'), ''), 80) else merchant end,
    desire    = case when p_item ? 'desire'    then coalesce(nullif(p_item->>'desire', '')::smallint, desire) else desire end,
    note      = case when p_item ? 'note'      then left(nullif(btrim(p_item->>'note'), ''), 400) else note end
  where id = p_item_id and list_id = v_list_id;
  if not found then
    raise exception 'Ce cadeau n''existe plus.' using errcode = 'PT404';
  end if;
end $$;

-- Supprimer un cadeau.
create or replace function public.noel_delete_item(p_slug text, p_token text, p_item_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_list_id uuid := noel.owner_list_id(p_slug, p_token);
begin
  delete from noel.items where id = p_item_id and list_id = v_list_id;
end $$;

-- Réserver un cadeau (visiteur). Renvoie le jeton qui permet d'annuler.
create or replace function public.noel_reserve_item(p_item_id uuid, p_name text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Indique ton prénom pour réserver.' using errcode = 'PT400';
  end if;
  update noel.items
     set reserved_by = left(btrim(p_name), 60), reserve_token = v_token, reserved_at = now()
   where id = p_item_id and reserved_by is null
  returning id into v_id;
  if v_id is null then
    if exists (select 1 from noel.items where id = p_item_id) then
      raise exception 'Quelqu''un vient de réserver ce cadeau.' using errcode = 'PT409';
    end if;
    raise exception 'Ce cadeau n''existe plus.' using errcode = 'PT404';
  end if;
  return v_token;
end $$;

-- Annuler sa réservation (avec le jeton reçu en réservant).
create or replace function public.noel_unreserve_item(p_item_id uuid, p_reserve_token text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update noel.items
     set reserved_by = null, reserve_token = null, reserved_at = null
   where id = p_item_id and p_reserve_token is not null and reserve_token = p_reserve_token;
  if not found then
    raise exception 'Impossible d''annuler cette réservation depuis cet appareil.' using errcode = 'PT403';
  end if;
end $$;

-- Droits : seules les fonctions noel_* sont appelables par le site.
revoke execute on function noel.owner_list_id(text, text) from public;
revoke execute on function public.noel_create_list(text, text, text) from public;
revoke execute on function public.noel_get_list(text, text) from public;
revoke execute on function public.noel_update_list(text, text, text, text, text) from public;
revoke execute on function public.noel_add_item(text, text, jsonb) from public;
revoke execute on function public.noel_update_item(text, text, uuid, jsonb) from public;
revoke execute on function public.noel_delete_item(text, text, uuid) from public;
revoke execute on function public.noel_reserve_item(uuid, text) from public;
revoke execute on function public.noel_unreserve_item(uuid, text) from public;

grant execute on function public.noel_create_list(text, text, text) to anon, authenticated;
grant execute on function public.noel_get_list(text, text) to anon, authenticated;
grant execute on function public.noel_update_list(text, text, text, text, text) to anon, authenticated;
grant execute on function public.noel_add_item(text, text, jsonb) to anon, authenticated;
grant execute on function public.noel_update_item(text, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.noel_delete_item(text, text, uuid) to anon, authenticated;
grant execute on function public.noel_reserve_item(uuid, text) to anon, authenticated;
grant execute on function public.noel_unreserve_item(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

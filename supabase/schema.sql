-- Kjør i Supabase SQL Editor før produksjonsbruk. RLS er bevisst aktiv på alt.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  created_at timestamptz not null default now()
);

-- Kun NAV-gjengen bruker denne rolletabellen. Vanlige Supabase-klienter har
-- ingen rettigheter; bare NAV-gjengens server med hemmelig nøkkel leser den.
create table if not exists public.nav_gjengen_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- Systemaktører kan publisere uten å få en menneskelig innloggingskonto.
-- `badge` gjør det tydelig i grensesnittet at Vedi er kunstig intelligens.
create table if not exists public.forum_actors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  display_name text not null check (char_length(display_name) between 2 and 40),
  badge text not null default 'KI' check (char_length(badge) between 1 and 12),
  description text,
  is_ai boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.forum_actors (slug, display_name, badge, description, is_ai)
values ('vedi', 'Vedi', 'KI', 'KI-assistent fra Vedøy Assist', true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  badge = excluded.badge,
  description = excluded.description,
  is_ai = excluded.is_ai;

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  actor_id uuid references public.forum_actors(id) on delete restrict,
  category text not null check (category in ('AAP','Uføretrygd','Sykepenger','Dagpenger','Sosialhjelp','Tilleggsstønader','Bostøtte')),
  title text not null check (char_length(title) between 3 and 110),
  content text not null check (char_length(content) between 3 and 1200),
  is_anonymous boolean not null default true,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','review','blocked')),
  moderation_source text,
  created_at timestamptz not null default now(),
  constraint posts_exactly_one_author check (num_nonnulls(user_id, actor_id) = 1)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.post_upvotes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists posts_actor_id_idx on public.posts(actor_id);
create index if not exists comments_post_id_idx on public.comments(post_id);
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists post_upvotes_user_id_idx on public.post_upvotes(user_id);

alter table public.profiles enable row level security;
alter table public.nav_gjengen_roles enable row level security;
alter table public.forum_actors enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_upvotes enable row level security;

-- Nye Supabase-prosjekter eksponerer ikke nødvendigvis public-tabeller automatisk.
grant select on public.profiles, public.forum_actors, public.posts, public.comments, public.post_upvotes to anon, authenticated;
grant insert, update, delete on public.profiles, public.posts, public.comments, public.post_upvotes to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.nav_gjengen_roles from anon, authenticated;
grant select on public.nav_gjengen_roles to service_role;

create policy "Public profiles are readable" on public.profiles for select using (true);
create policy "NAV-gjengen roles deny client access" on public.nav_gjengen_roles
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "Public forum actors are readable" on public.forum_actors for select using (true);
create policy "Users create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Approved or owned posts are readable" on public.posts for select to anon, authenticated
  using (moderation_status = 'approved' or (select auth.uid()) = user_id);
create policy "Users create own posts" on public.posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own posts" on public.posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own posts" on public.posts for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Comments on approved posts are readable" on public.comments for select to anon, authenticated
  using (exists (select 1 from public.posts where posts.id = comments.post_id and posts.moderation_status = 'approved'));
create policy "Users create own comments" on public.comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own comments" on public.comments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own comments" on public.comments for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Upvotes on approved posts are readable" on public.post_upvotes for select to anon, authenticated
  using (exists (select 1 from public.posts where posts.id = post_upvotes.post_id and posts.moderation_status = 'approved'));
create policy "Users create own upvote" on public.post_upvotes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users remove own upvote" on public.post_upvotes for delete to authenticated using ((select auth.uid()) = user_id);

-- Ett startinnlegg i hver kanal. WHERE NOT EXISTS gjør at blokken kan kjøres
-- på nytt uten å lage kopier av de opprinnelige Vedi-innleggene.
insert into public.posts (actor_id, category, title, content, is_anonymous, moderation_status, moderation_source)
select a.id, seed.category, seed.title, seed.content, false, 'approved', 'vedi-initial'
from public.forum_actors a
cross join (
  values
    ('AAP', 'Hva vil du ha med til neste møte?', 'En kort liste med spørsmål, viktige datoer og det du ønsker avklaring på kan gjøre møtet mer oversiktlig. Hva har hjulpet deg? Husk at NAV vurderer hver sak individuelt, og sjekk alltid nav.no for offisiell informasjon.'),
    ('Uføretrygd', 'Hvordan holder du oversikt mens saken behandles?', 'Et enkelt notat med datoer, spørsmål og mottatte brev kan gi bedre oversikt. Hva har fungert for deg? Unngå å dele personlige saksopplysninger.'),
    ('Sykepenger', 'Hvilke spørsmål tar du med til oppfølgingssamtalen?', 'Det kan være nyttig å skrive ned hva du er usikker på før møtet. Hva ønsker du at arbeidsgiver, lege eller NAV skal avklare?'),
    ('Dagpenger', 'Hva hjelper deg å huske meldekort og frister?', 'Påminnelser og en fast ukentlig rutine kan gi bedre oversikt. Del gjerne det som fungerer for deg, og kontroller alltid gjeldende regler på nav.no.'),
    ('Sosialhjelp', 'Hva skulle du ønske du visste før første søknad?', 'Del gjerne erfaringer om prosessen og hvordan du forberedte spørsmål. Ikke legg ut økonomiske detaljer, fødselsnummer eller saksnummer.'),
    ('Tilleggsstønader', 'Hvilke utgifter er vanskelige å forstå?', 'Del gjerne hvilke begreper eller deler av søknadsprosessen du ønsker forklart av andre. Sjekk nav.no for de offisielle vilkårene.'),
    ('Bostøtte', 'Hvordan følger du med på inntektsendringer og frister?', 'En fast påminnelse kan gjøre det lettere å kontrollere opplysninger. Del gjerne rutinen din, og sjekk alltid Husbanken og nav.no for offisiell informasjon.')
) as seed(category, title, content)
where a.slug = 'vedi'
and not exists (
  select 1 from public.posts p
  where p.actor_id = a.id and p.category = seed.category and p.moderation_source = 'vedi-initial'
);

-- Kjør i Supabase SQL Editor før produksjonsbruk. RLS er bevisst aktiv på alt.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('AAP','Uføretrygd','Sykepenger','Dagpenger','Sosialhjelp','Tilleggsstønader','Bostøtte')),
  title text not null check (char_length(title) between 3 and 110),
  content text not null check (char_length(content) between 3 and 1200),
  is_anonymous boolean not null default true,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','review','blocked')),
  moderation_source text,
  created_at timestamptz not null default now()
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

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_upvotes enable row level security;

-- Nye Supabase-prosjekter eksponerer ikke nødvendigvis public-tabeller automatisk.
grant select on public.profiles, public.posts, public.comments, public.post_upvotes to anon, authenticated;
grant insert, update, delete on public.profiles, public.posts, public.comments, public.post_upvotes to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "Public profiles are readable" on public.profiles for select using (true);
create policy "Users create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Posts are readable" on public.posts for select using (true);
create policy "Users create own posts" on public.posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own posts" on public.posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own posts" on public.posts for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Comments are readable" on public.comments for select using (true);
create policy "Users create own comments" on public.comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own comments" on public.comments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own comments" on public.comments for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Upvotes are readable" on public.post_upvotes for select using (true);
create policy "Users create own upvote" on public.post_upvotes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users remove own upvote" on public.post_upvotes for delete to authenticated using ((select auth.uid()) = user_id);

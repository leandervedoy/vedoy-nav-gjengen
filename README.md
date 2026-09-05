# NAV-gjengen

En responsiv frontend-demo for et anonymt forum om ytelser og rettigheter. Åpne `index.html` i en nettleser for å teste den. `tailwind.css` gir Tailwind-laget og de rolige motion-animasjonene.

## Dette virker i demoen

- Filtrer innlegg på ytelse og sorter på nyeste eller mest hjelpsomme.
- Opprett innlegg med overskrift, tekst og påkrevd tema.
- Trykk «Hjalp meg», åpne kommentarfelt og legg til kommentarer.
- Mobilvennlig layout og synlig ansvarsfraskrivelse.

All data lever kun i nettleserens minne. Innlogging er en visuell demo; den gir ikke tilgang til et ekte brukerområde.

## Vedøy-konto og samtykke

NAV-gjengen bruker Supabase-prosjektet **Vedoy** som OAuth 2.1-leverandør. Sett `VEDOY_OAUTH_ISSUER`, `VEDOY_OAUTH_CLIENT_ID`, `APP_URL` og en tilfeldig `NAV_GJENGEN_SESSION_SECRET` på serveren. Flyten bruker Authorization Code med PKCE, og callbacken henter identiteten fra Supabase sitt UserInfo-endepunkt. Passord og tilgangstoken lagres aldri i NAV-gjengens nettleserkode eller sesjonscookie.

Vilkårene i `vilkar.html` er et utkast. Fyll ut juridisk virksomhetsnavn, kontaktadresse, databehandlere og lagringstider, og få teksten kvalitetssikret før lansering.

## Supabase på Vercel

Legg inn `SUPABASE_URL` og `SUPABASE_PUBLISHABLE_KEY` i Vercel for Production. Ikke legg `SUPABASE_SERVICE_ROLE_KEY` i klientkode eller i en `NEXT_PUBLIC_`-variabel. Kjør først `supabase/schema.sql` i Supabase SQL Editor, ellers bruker forsiden demo-innlegg. `GET /api/health` viser bare om nødvendig offentlig Supabase-konfigurasjon finnes; den viser aldri nøkkelverdier.

## Anonym visning og Vedi-moderering

Innloggede brukere kan publisere med visningsnavnet «Anonym bruker». Konto-ID beholdes internt; dette er pseudonym publisering, ikke full anonymitet overfor tjenesten. `POST /api/moderate` kjører alltid et lokalt sikkerhetsfilter. Sett `VEDI_MODERATION_URL` og eventuelt `VEDI_API_KEY` server-side i Vercel for å aktivere Vedi som et ekstra vurderingslag. Før aktivering må Vedis databehandling, lagring, modelltrening, databehandleravtale og klagekanal dokumenteres.

## Anbefalt Supabase-backend

Bruk **Supabase Auth** med anonyme eller e-postbaserte kontoer, og lagre bare et valgt brukernavn i en offentlig profil. Ikke legg inn service-role-nøkler i frontend.

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  created_at timestamptz not null default now()
);

create table posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('AAP','Uføretrygd','Sykepenger','Dagpenger','Sosialhjelp','Tilleggsstønader','Bostøtte')),
  title text not null check (char_length(title) between 3 and 110),
  content text not null check (char_length(content) between 3 and 1200),
  created_at timestamptz not null default now()
);

create table comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create table post_upvotes (
  post_id bigint references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
```

Aktiver Row Level Security (RLS): alle kan lese `posts` og `comments`; kun innlogget bruker kan opprette egne innlegg/kommentarer; kun eieren kan endre eller slette sitt innhold. Tell likes med `post_upvotes` i stedet for et redigerbart `upvotes`-felt. Legg inn rapportering, modereringskø, hastighetsbegrensning og server-side innholdsfiltrering før lansering.

For en trend-feed henter du innlegg nyere enn sju dager og sorterer på en server-beregnet score (likes og kommentarer). Følgede temaer kan ligge i en tabell `user_topics(user_id, category, primary key(user_id, category))`.

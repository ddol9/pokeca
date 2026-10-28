-- 확장 아트 아카이브 릴리스 1 스키마.
-- 접근 경계(eng D6): 모든 테이블은 RLS를 켜고 anon/authenticated 정책을 두지 않는다.
-- 앱 서버만 service role로 읽고 쓴다. 함수도 service_role에게만 실행 권한을 준다.

create extension if not exists pg_trgm with schema extensions;

-- 카드 -----------------------------------------------------------------------

create table public.sets (
  code text primary key,
  name_ko text not null,
  released_on date
);

-- 정본 키는 한글판 인쇄본 (set_code, collector_number).
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  set_code text not null references public.sets (code),
  collector_number text not null,
  name_ko text not null,
  rarity text,
  illustrator text,
  created_at timestamptz not null default now(),
  unique (set_code, collector_number)
);

create index cards_name_ko_trgm on public.cards using gin (name_ko extensions.gin_trgm_ops);

-- 같은 그림의 일본판·영문판.
create table public.card_aliases (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  lang text not null check (lang in ('ja', 'en')),
  set_code text not null,
  collector_number text not null,
  name text,
  unique (lang, set_code, collector_number)
);

create index card_aliases_card_id on public.card_aliases (card_id);
create index card_aliases_key on public.card_aliases (set_code, collector_number);
create index card_aliases_name_trgm on public.card_aliases using gin (name extensions.gin_trgm_ops);

-- MVP에서는 format 라벨로만 참조한다.
create table public.spec_profiles (
  code text primary key check (code in ('9pocket', 'psa', 'brg')),
  name_ko text not null,
  width_mm numeric,
  height_mm numeric
);

insert into public.spec_profiles (code, name_ko) values
  ('9pocket', '9포켓'),
  ('psa', 'PSA'),
  ('brg', 'BRG');

-- 작품 -----------------------------------------------------------------------

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id),
  artist_name text not null,
  format text not null references public.spec_profiles (code),
  source_url text,
  source_visibility text check (source_visibility in ('public', 'members_only')),
  consent_level text not null check (consent_level in ('link_only', 'hosted')),
  thumbnail_ok boolean not null default false,
  status text not null default 'active' check (status in ('active', 'hidden', 'withdrawn')),
  files_purged boolean not null default false,
  upload_id uuid unique,
  link_status text not null default 'unchecked'
    check (link_status in ('unchecked', 'ok', 'deleted', 'no_access', 'suspect')),
  link_checked_at timestamptz,
  print_size_verified boolean not null default false,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- 링크만 허락한 작품은 연결할 원본 글이 있어야 한다.
  constraint link_only_needs_source check (consent_level = 'hosted' or source_url is not null),
  constraint visibility_with_source check ((source_url is null) = (source_visibility is null))
);

create index artworks_card_status on public.artworks (card_id, status);

create table public.artwork_files (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  kind text not null check (kind in ('original', 'thumbnail')),
  path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  unique (artwork_id, kind)
);

-- 상태·허락 변경 이력. lib/artworks의 setStatus/setConsent만 쓴다.
create table public.consent_events (
  id bigint generated always as identity primary key,
  artwork_id uuid not null references public.artworks (id),
  kind text not null check (kind in ('created', 'status', 'consent')),
  before jsonb,
  after jsonb not null,
  reason text,
  evidence_path text,
  actor text,
  created_at timestamptz not null default now()
);

create index consent_events_artwork on public.consent_events (artwork_id, created_at);

-- 수요·측정 -------------------------------------------------------------------

-- 방문자가 누른 "찾기 요청". 같은 방문자는 카드·규격당 한 번.
create table public.requests (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards (id),
  format text not null references public.spec_profiles (code),
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (card_id, format, visitor_id)
);

-- 카드는 있으나 해당 규격 active 도안이 0개였던 방문.
create table public.card_demand (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards (id),
  format text references public.spec_profiles (code),
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);

create index card_demand_card on public.card_demand (card_id);

-- 카드를 찾지 못한 검색.
create table public.search_misses (
  id bigint generated always as identity primary key,
  query text not null,
  parsed jsonb,
  visitor_id uuid,
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('visit', 'search', 'download', 'source_click', 'request')),
  visitor_id uuid,
  card_id uuid references public.cards (id),
  artwork_id uuid references public.artworks (id),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index events_type_created on public.events (type, created_at);
create index events_visitor on public.events (visitor_id, created_at);

-- 신고 -----------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid references public.artworks (id),
  source_url text,
  reason text not null check (reason in ('rights_holder', 'suspected_theft', 'other')),
  contact text,
  message text,
  status text not null default 'open' check (status in ('open', 'resolved', 'no_target')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_has_target check (artwork_id is not null or source_url is not null)
);

create index reports_status on public.reports (status, created_at);

-- 어드민 허용 목록 ---------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- RLS: 켜고 정책은 두지 않는다 ---------------------------------------------------------

alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.card_aliases enable row level security;
alter table public.spec_profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.artwork_files enable row level security;
alter table public.consent_events enable row level security;
alter table public.requests enable row level security;
alter table public.card_demand enable row level security;
alter table public.search_misses enable row level security;
alter table public.events enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;

-- 저장소 버킷 ------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('artworks', 'artworks', false, 104857600, array['image/png', 'image/jpeg', 'application/pdf']),
  ('consent-evidence', 'consent-evidence', false, 20971520, array['image/png', 'image/jpeg', 'application/pdf']);

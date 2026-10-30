-- 작가 계정.
-- 누구나 가입할 수 있고, 어드민이 승인한 작가만 도안을 올린다. 올린 도안은 바로 공개한다.
-- 로그인은 카카오·구글뿐이다. 처음 로그인하면 auth 계정이 생기고, 작가 신청 폼을 내야 이 표에 들어간다.
-- lib/artists.ts만 이 표를 쓴다.
-- 작가가 올린 작품은 artworks.artist_id로 계정에 묶이고, 공개 작가 페이지(/artists/[handle])에 모인다.

create table public.artists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 작가 페이지 주소. 영문 소문자·숫자·밑줄.
  handle text not null unique check (handle ~ '^[a-z0-9_]{2,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  email text, -- 소셜 계정의 이메일. 카카오는 비즈 앱이 아니면 주지 않는다.
  provider text not null, -- kakao | google
  intro text check (intro is null or char_length(intro) <= 300),
  link_url text check (link_url is null or link_url ~ '^https?://'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now()
);

create index artists_status on public.artists (status, created_at);

alter table public.artists enable row level security;

-- 계정을 지워도 작품과 이력은 남긴다(작품 이름은 artist_name에 있다).
alter table public.artworks
  add column artist_id uuid references public.artists (user_id) on delete set null;

create index artworks_artist on public.artworks (artist_id, status, created_at);

create or replace function public.artwork_create(p_artwork jsonb, p_files jsonb, p_actor text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_artwork ->> 'id')::uuid;
begin
  -- 업로드 확정 재시도는 같은 id로 들어온다(멱등).
  if exists (select 1 from public.artworks where id = v_id) then
    return v_id;
  end if;

  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'original') then
    raise exception 'original_required';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'thumbnail') then
    raise exception 'thumbnail_required';
  end if;

  insert into public.artworks (
    id, upload_id, card_id, artist_name, artist_id, format, source_url, source_visibility,
    print_size_verified, consented_at
  ) values (
    v_id, v_id,
    (p_artwork ->> 'card_id')::uuid,
    p_artwork ->> 'artist_name',
    nullif(p_artwork ->> 'artist_id', '')::uuid,
    p_artwork ->> 'format',
    nullif(p_artwork ->> 'source_url', ''),
    nullif(p_artwork ->> 'source_visibility', ''),
    coalesce((p_artwork ->> 'print_size_verified')::boolean, false),
    coalesce((p_artwork ->> 'consented_at')::timestamptz, now())
  );

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes)
  select v_id, f ->> 'kind', f ->> 'path', f ->> 'mime_type', (f ->> 'size_bytes')::bigint
  from jsonb_array_elements(p_files) f;

  insert into public.consent_events (artwork_id, kind, before, after, evidence_path, actor)
  values (
    v_id, 'created', null, jsonb_build_object('status', 'active'),
    nullif(p_artwork ->> 'evidence_path', ''),
    p_actor
  );

  return v_id;
end;
$$;

revoke execute on function public.artwork_create(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.artwork_create(jsonb, jsonb, text) to service_role;

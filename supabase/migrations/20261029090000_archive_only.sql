-- 보관 전용 아카이브로 전환.
-- 링크만 모으지 않고 도안 파일을 사이트에 보관한다. 모든 작품은 원본과 미리보기 파일을 가진다.
--   - consent_level(link_only/hosted), thumbnail_ok 구분을 없앤다. 등록 = 보관·미리보기·다운로드 허락.
--   - 원본 글 주소는 출처 표시용(선택)이다.
--   - 허락 변경(하향)은 없다. 내리고 싶으면 숨김 또는 철회. 허락 근거는 artwork_add_evidence로 덧붙인다.
-- 미리보기(kind = thumbnail)는 서버가 원본에서 만든다(lib/preview). PDF 원본은 어드민이 직접 올린다.

-- 링크 전용이거나 파일이 빠진 공개·숨김 작품이 남아 있으면 전환하지 않는다(배포 전이라 없어야 한다).
do $$
begin
  if exists (
    select 1 from public.artworks a
    where a.status <> 'withdrawn'
      and (
        a.consent_level <> 'hosted'
        or not exists (select 1 from public.artwork_files f where f.artwork_id = a.id and f.kind = 'original')
        or not exists (select 1 from public.artwork_files f where f.artwork_id = a.id and f.kind = 'thumbnail')
      )
  ) then
    raise exception 'archive_only: link-only or file-less artworks exist; withdraw them first';
  end if;
end;
$$;

drop function public.artwork_set_consent(uuid, text, boolean, text, text, text);

alter table public.artworks
  drop constraint link_only_needs_source,
  drop column consent_level,
  drop column thumbnail_ok;

-- 미리보기는 webp로 만든다.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
where id = 'artworks';

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
    id, upload_id, card_id, artist_name, format, source_url, source_visibility,
    print_size_verified, consented_at
  ) values (
    v_id, v_id,
    (p_artwork ->> 'card_id')::uuid,
    p_artwork ->> 'artist_name',
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

-- 허락 근거(DM 캡처 등)를 나중에 덧붙인다. 올린 파일이 기록 없이 정리 작업에 지워지지 않게 이벤트로 남긴다.
create function public.artwork_add_evidence(p_id uuid, p_reason text, p_actor text, p_evidence_path text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.artworks where id = p_id for update;
  if v_status is null then
    raise exception 'not_found';
  end if;
  if v_status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if nullif(p_evidence_path, '') is null then
    raise exception 'evidence_required';
  end if;
  insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
  values (p_id, 'consent', null, jsonb_build_object('evidence', true), p_reason, p_evidence_path, p_actor);
end;
$$;

revoke execute on function public.artwork_add_evidence(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.artwork_add_evidence(uuid, text, text, text) to service_role;

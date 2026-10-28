-- 작품 생성·상태·허락 변경 (eng D5, D9, D10).
-- 상태와 허락은 이 함수들로만 바뀌고, 같은 트랜잭션에서 consent_events를 남긴다.
-- 파일 삭제는 DB가 커밋된 뒤 lib/artworks가 한다. 함수는 지울 경로만 돌려준다(DB가 기준).
--
--             set_status(hidden)            set_status(withdrawn)
--   active ─────────────────────> hidden ─────────────────────> withdrawn (복구 없음)
--     ^  <──── set_status(active) ───┘                            │ 모든 파일 삭제 대상
--     └───────────────── set_status(withdrawn) ──────────────────┘
--   set_consent: hosted → link_only  ⇒ 원본 삭제 대상
--                thumbnail_ok → false ⇒ 썸네일 삭제 대상

-- 오류는 'P0001' + 짧은 코드 문자열로 낸다. lib/artworks가 코드를 화면 문구로 바꾼다.

create function public.artwork_create(p_artwork jsonb, p_files jsonb, p_actor text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_artwork ->> 'id')::uuid;
  v_consent text := p_artwork ->> 'consent_level';
  v_thumb boolean := coalesce((p_artwork ->> 'thumbnail_ok')::boolean, false);
begin
  -- 업로드 확정 재시도는 같은 id로 들어온다(멱등).
  if exists (select 1 from public.artworks where id = v_id) then
    return v_id;
  end if;

  if v_consent = 'hosted' and not exists (
    select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'original'
  ) then
    raise exception 'hosted_needs_original';
  end if;
  if v_thumb and not exists (
    select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'thumbnail'
  ) then
    raise exception 'thumbnail_needs_file';
  end if;

  insert into public.artworks (
    id, upload_id, card_id, artist_name, format, source_url, source_visibility,
    consent_level, thumbnail_ok, print_size_verified, consented_at
  ) values (
    v_id, v_id,
    (p_artwork ->> 'card_id')::uuid,
    p_artwork ->> 'artist_name',
    p_artwork ->> 'format',
    nullif(p_artwork ->> 'source_url', ''),
    nullif(p_artwork ->> 'source_visibility', ''),
    v_consent,
    v_thumb,
    coalesce((p_artwork ->> 'print_size_verified')::boolean, false),
    coalesce((p_artwork ->> 'consented_at')::timestamptz, now())
  );

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes)
  select v_id, f ->> 'kind', f ->> 'path', f ->> 'mime_type', (f ->> 'size_bytes')::bigint
  from jsonb_array_elements(p_files) f;

  insert into public.consent_events (artwork_id, kind, before, after, evidence_path, actor)
  values (
    v_id, 'created', null,
    jsonb_build_object('status', 'active', 'consent_level', v_consent, 'thumbnail_ok', v_thumb),
    nullif(p_artwork ->> 'evidence_path', ''),
    p_actor
  );

  return v_id;
end;
$$;

create function public.artwork_set_status(p_id uuid, p_to text, p_reason text, p_actor text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_from text;
  v_purge text[] := '{}';
begin
  select status into v_from from public.artworks where id = p_id for update;
  if v_from is null then
    raise exception 'not_found';
  end if;
  if v_from = p_to then
    return jsonb_build_object('changed', false, 'purge_paths', to_jsonb(v_purge));
  end if;
  if v_from = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if p_to not in ('active', 'hidden', 'withdrawn') then
    raise exception 'invalid_status';
  end if;

  update public.artworks
  set status = p_to,
      files_purged = case when p_to = 'withdrawn' then false else files_purged end
  where id = p_id;

  if p_to = 'withdrawn' then
    select coalesce(array_agg(path), '{}') into v_purge
    from public.artwork_files where artwork_id = p_id;
    if cardinality(v_purge) = 0 then
      update public.artworks set files_purged = true where id = p_id;
    end if;
  end if;

  insert into public.consent_events (artwork_id, kind, before, after, reason, actor)
  values (p_id, 'status', jsonb_build_object('status', v_from), jsonb_build_object('status', p_to),
          p_reason, p_actor);

  return jsonb_build_object('changed', true, 'purge_paths', to_jsonb(v_purge));
end;
$$;

create function public.artwork_set_consent(
  p_id uuid,
  p_consent_level text,
  p_thumbnail_ok boolean,
  p_reason text,
  p_actor text,
  p_evidence_path text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v public.artworks;
  v_purge text[] := '{}';
begin
  select * into v from public.artworks where id = p_id for update;
  if v.id is null then
    raise exception 'not_found';
  end if;
  if v.status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;
  if v.consent_level = p_consent_level and v.thumbnail_ok = p_thumbnail_ok then
    return jsonb_build_object('changed', false, 'purge_paths', to_jsonb(v_purge));
  end if;
  if p_consent_level = 'link_only' and v.source_url is null then
    raise exception 'link_only_needs_source';
  end if;
  -- 상향은 파일이 이미 붙어 있을 때만. 파일 없이 "다운로드 가능"이 되지 않게 한다.
  if p_consent_level = 'hosted' and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'original'
  ) then
    raise exception 'hosted_needs_original';
  end if;
  if p_thumbnail_ok and not exists (
    select 1 from public.artwork_files where artwork_id = p_id and kind = 'thumbnail'
  ) then
    raise exception 'thumbnail_needs_file';
  end if;

  if v.consent_level = 'hosted' and p_consent_level = 'link_only' then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'original');
  end if;
  if v.thumbnail_ok and not p_thumbnail_ok then
    v_purge := v_purge || array(
      select path from public.artwork_files where artwork_id = p_id and kind = 'thumbnail');
  end if;

  update public.artworks
  set consent_level = p_consent_level, thumbnail_ok = p_thumbnail_ok, consented_at = now()
  where id = p_id;

  insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
  values (
    p_id, 'consent',
    jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
    jsonb_build_object('consent_level', p_consent_level, 'thumbnail_ok', p_thumbnail_ok),
    p_reason, nullif(p_evidence_path, ''), p_actor
  );

  return jsonb_build_object('changed', true, 'purge_paths', to_jsonb(v_purge));
end;
$$;

-- 기존 작품에 파일을 붙이거나 바꾼다. 바뀐 파일의 이전 경로를 돌려준다(삭제 대상).
create function public.artwork_attach_file(
  p_id uuid, p_kind text, p_path text, p_mime_type text, p_size_bytes bigint
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_old text;
begin
  select status into v_status from public.artworks where id = p_id for update;
  if v_status is null then
    raise exception 'not_found';
  end if;
  if v_status = 'withdrawn' then
    raise exception 'withdrawn_is_final';
  end if;

  select path into v_old from public.artwork_files where artwork_id = p_id and kind = p_kind;
  if v_old = p_path then
    return jsonb_build_object('purge_paths', '[]'::jsonb);
  end if;

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes)
  values (p_id, p_kind, p_path, p_mime_type, p_size_bytes)
  on conflict (artwork_id, kind) do update
    set path = excluded.path, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
        created_at = now();

  return jsonb_build_object(
    'purge_paths', case when v_old is null then '[]'::jsonb else jsonb_build_array(v_old) end);
end;
$$;

-- 저장소에서 실제로 지운 뒤 호출한다. 철회 작품의 파일이 모두 사라지면 files_purged = true.
create function public.artwork_files_removed(p_paths text[])
returns void
language sql
set search_path = ''
as $$
  delete from public.artwork_files where path = any (p_paths);
  update public.artworks a
  set files_purged = true
  where a.status = 'withdrawn' and not a.files_purged
    and not exists (select 1 from public.artwork_files f where f.artwork_id = a.id);
$$;

revoke execute on function public.artwork_create(jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.artwork_set_status(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.artwork_set_consent(uuid, text, boolean, text, text, text) from public, anon, authenticated;
revoke execute on function public.artwork_attach_file(uuid, text, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.artwork_files_removed(text[]) from public, anon, authenticated;
grant execute on function public.artwork_create(jsonb, jsonb, text) to service_role;
grant execute on function public.artwork_set_status(uuid, text, text, text) to service_role;
grant execute on function public.artwork_set_consent(uuid, text, boolean, text, text, text) to service_role;
grant execute on function public.artwork_attach_file(uuid, text, text, text, bigint) to service_role;
grant execute on function public.artwork_files_removed(text[]) to service_role;

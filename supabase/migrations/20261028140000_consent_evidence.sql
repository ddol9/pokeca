-- 허락 근거 업로드 (설계 R3).
-- 허락 변경 없이 근거 파일만 붙여도 consent_events에 남긴다. 그러지 않으면 올린 파일이
-- 기록 없이 정리 작업에 지워진다.
-- create or replace는 기존 권한(revoke/grant)을 유지한다.

create or replace function public.artwork_set_consent(
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
    -- 허락은 그대로지만 근거 파일을 새로 붙였다면 기록만 남긴다(before = after).
    if nullif(p_evidence_path, '') is not null then
      insert into public.consent_events (artwork_id, kind, before, after, reason, evidence_path, actor)
      values (
        p_id, 'consent',
        jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
        jsonb_build_object('consent_level', v.consent_level, 'thumbnail_ok', v.thumbnail_ok),
        p_reason, p_evidence_path, p_actor
      );
    end if;
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

  -- 하향된 파일은 같은 트랜잭션에서 추적을 끊는다. 커밋 뒤 저장소 삭제가 실패해도
  -- 정리 작업이 "행 없는 파일"로 보고 다시 지운다.
  delete from public.artwork_files where path = any (v_purge);

  return jsonb_build_object('changed', true, 'purge_paths', to_jsonb(v_purge));
end;
$$;

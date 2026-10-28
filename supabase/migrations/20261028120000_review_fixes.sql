-- 머지 전 리뷰 수정.
-- 1. 허락 하향 시 파일 행을 바로 지운다(저장소 삭제 실패 시 정리 작업이 다시 지울 수 있게).
-- 2. 신고 한도와 자동 숨김이 동시 요청에도 지켜지도록 잠금을 건다.
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

create or replace function public.report_submit(p_report jsonb, p_ip_hash text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_artwork uuid := nullif(p_report ->> 'artwork_id', '')::uuid;
  v_id uuid;
  v_ranges int := 0;
begin
  -- 같은 대역의 동시 신고가 한도를 함께 통과하지 않게, 같은 작품의 동시 신고가 자동 숨김을 놓치지 않게 잠근다.
  perform pg_advisory_xact_lock(hashtext('report_ip:' || p_ip_hash));
  if v_artwork is not null then
    perform pg_advisory_xact_lock(hashtext('report_artwork:' || v_artwork::text));
  end if;
  if (select count(*) from public.report_throttle
      where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;
  if v_artwork is not null and not exists (select 1 from public.artworks where id = v_artwork) then
    raise exception 'not_found';
  end if;

  insert into public.reports (artwork_id, source_url, reason, contact, message)
  values (
    v_artwork,
    nullif(p_report ->> 'source_url', ''),
    p_report ->> 'reason',
    nullif(p_report ->> 'contact', ''),
    nullif(p_report ->> 'message', '')
  )
  returning id into v_id;

  insert into public.report_throttle (ip_hash, artwork_id) values (p_ip_hash, v_artwork);

  if v_artwork is not null then
    select count(distinct ip_hash) into v_ranges from public.report_throttle
    where artwork_id = v_artwork and created_at > now() - interval '24 hours';
  end if;

  return jsonb_build_object('id', v_id, 'auto_hide', v_ranges >= 3);
end;
$$;

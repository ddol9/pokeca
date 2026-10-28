-- 찾기 요청·신고·링크 점검 (design 5A·14A, eng E5·E6·E7).

-- 신고 남용 방지 카운터. IP 대역(IPv4 /24, IPv6 /48)의 HMAC만 저장하고 24시간 뒤 정리 작업이 지운다.
-- reports·events에는 IP를 쓰지 않는다 (설계 "신고 흐름").
create table public.report_throttle (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  artwork_id uuid references public.artworks (id),
  created_at timestamptz not null default now()
);

create index report_throttle_hash on public.report_throttle (ip_hash, created_at);
create index report_throttle_artwork on public.report_throttle (artwork_id, created_at);
alter table public.report_throttle enable row level security;

-- 신고 저장. 하루 5건 한도를 넘으면 rate_limited.
-- 같은 작품에 24시간 안에 서로 다른 대역 3곳이 신고하면 auto_hide = true를 돌려준다.
-- 숨김은 lib/reports가 setStatus 경로로 한다(상태 변경 경로를 하나로 유지).
create function public.report_submit(p_report jsonb, p_ip_hash text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_artwork uuid := nullif(p_report ->> 'artwork_id', '')::uuid;
  v_id uuid;
  v_ranges int := 0;
begin
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

-- 찾기 요청. 같은 방문자·카드·규격은 한 번만 센다.
create function public.request_create(p_card uuid, p_format text, p_visitor uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_inserted int;
begin
  insert into public.requests (card_id, format, visitor_id)
  values (p_card, p_format, p_visitor)
  on conflict (card_id, format, visitor_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    insert into public.events (type, visitor_id, card_id, payload)
    values ('request', p_visitor, p_card, jsonb_build_object('format', p_format));
  end if;
  return v_inserted > 0;
end;
$$;

-- 규격별 요청 상태. 대기 수는 3명 이상일 때만 숫자로 준다 (design 5A).
create function public.card_request_state(p_card uuid, p_visitor uuid)
returns table (format text, requested boolean, waiting int)
language sql
stable
set search_path = ''
as $$
  select s.code,
         exists (select 1 from public.requests r
                 where r.card_id = p_card and r.format = s.code and r.visitor_id = p_visitor),
         case when n.c >= 3 then n.c::int end
  from public.spec_profiles s
  cross join lateral (
    select count(*) as c from public.requests r where r.card_id = p_card and r.format = s.code
  ) n
  order by s.code
$$;

-- 홈 "최근 도안이 등록된 카드" (design 3A).
create function public.recent_artwork_cards(p_limit int)
returns table (set_code text, collector_number text, name_ko text, latest timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.set_code, c.collector_number, c.name_ko, max(a.created_at)
  from public.artworks a
  join public.cards c on c.id = a.card_id
  where a.status = 'active'
  group by c.id
  order by 4 desc
  limit p_limit
$$;

-- 수동 링크 점검 기록 (eng E6).
create function public.artwork_set_link_status(p_id uuid, p_status text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_status not in ('ok', 'deleted', 'no_access', 'suspect') then
    raise exception 'invalid_link_status';
  end if;
  update public.artworks set link_status = p_status, link_checked_at = now() where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke execute on function public.report_submit(jsonb, text) from public, anon, authenticated;
revoke execute on function public.request_create(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.card_request_state(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.recent_artwork_cards(int) from public, anon, authenticated;
revoke execute on function public.artwork_set_link_status(uuid, text) from public, anon, authenticated;
grant execute on function public.report_submit(jsonb, text) to service_role;
grant execute on function public.request_create(uuid, text, uuid) to service_role;
grant execute on function public.card_request_state(uuid, uuid) to service_role;
grant execute on function public.recent_artwork_cards(int) to service_role;
grant execute on function public.artwork_set_link_status(uuid, text) to service_role;

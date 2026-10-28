-- 카드 검색 (eng D7). lib/search.parseQuery가 정규화한 값을 받아 정확 매칭한다.

-- "001" → "1", "tg01" → "TG1". lib/search.normalizeNumber와 같은 규칙.
create function public.normalize_collector_number(token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(substring(token from '^([A-Za-z]*)'), ''))
      || coalesce(nullif(ltrim(substring(token from '(\d+)$'), '0'), ''), '0')
$$;

-- 세트 코드는 대소문자를 구분하지 않는다("MEW" = "mew").
create index cards_number_norm on public.cards (
  lower(set_code),
  public.normalize_collector_number(split_part(collector_number, '/', 1))
);
create index card_aliases_number_norm on public.card_aliases (
  lower(set_code),
  public.normalize_collector_number(split_part(collector_number, '/', 1))
);

-- 검색 결과 한 줄: 정본 카드 + 공개 도안 수 + 어떤 별칭으로 맞았는지.
create type public.card_hit as (
  card_id uuid,
  set_code text,
  collector_number text,
  name_ko text,
  rarity text,
  set_name text,
  released_on date,
  artwork_count int,
  alias_lang text,
  alias_set_code text,
  alias_number text
);

-- p_set이 null이면 번호만으로 찾는다.
create function public.search_cards_by_number(p_set text, p_number text, p_total text)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id, null::text as alias_lang, null::text as alias_set_code,
           null::text as alias_number
    from public.cards c
    where (p_set is null or lower(c.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(c.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(c.collector_number, '/', 2)) = p_total)
    union all
    select a.card_id, a.lang, a.set_code, a.collector_number
    from public.card_aliases a
    where (p_set is null or lower(a.set_code) = lower(p_set))
      and public.normalize_collector_number(split_part(a.collector_number, '/', 1)) = p_number
      and (p_total is null
           or public.normalize_collector_number(split_part(a.collector_number, '/', 2)) = p_total)
  ),
  -- 같은 카드가 정본과 별칭으로 둘 다 맞으면 정본 쪽을 남긴다.
  best as (
    select distinct on (card_id) *
    from matched
    order by card_id, alias_lang nulls first
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         b.alias_lang, b.alias_set_code, b.alias_number
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, s.released_on desc nulls last, c.collector_number
  limit 50
$$;

-- 한글 이름 또는 별칭 이름 부분 검색.
create function public.search_cards_by_name(p_text text)
returns setof public.card_hit
language sql
stable
set search_path = ''
as $$
  with matched as (
    select c.id as card_id,
           extensions.similarity(c.name_ko, p_text) as score
    from public.cards c
    where c.name_ko operator(extensions.%) p_text or c.name_ko ilike '%' || p_text || '%'
    union all
    select a.card_id, extensions.similarity(a.name, p_text)
    from public.card_aliases a
    where a.name operator(extensions.%) p_text or a.name ilike '%' || p_text || '%'
  ),
  best as (
    select card_id, max(score) as score from matched group by card_id
  )
  select c.id, c.set_code, c.collector_number, c.name_ko, c.rarity, s.name_ko, s.released_on,
         (select count(*)::int from public.artworks w
           where w.card_id = c.id and w.status = 'active'),
         null::text, null::text, null::text
  from best b
  join public.cards c on c.id = b.card_id
  join public.sets s on s.code = c.set_code
  order by 8 desc, b.score desc, s.released_on desc nulls last, c.collector_number
  limit 50
$$;

revoke execute on function public.normalize_collector_number(text) from public, anon, authenticated;
revoke execute on function public.search_cards_by_number(text, text, text) from public, anon, authenticated;
revoke execute on function public.search_cards_by_name(text) from public, anon, authenticated;
grant execute on function public.normalize_collector_number(text) to service_role;
grant execute on function public.search_cards_by_number(text, text, text) to service_role;
grant execute on function public.search_cards_by_name(text) to service_role;

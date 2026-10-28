-- 카드 시드 CSV 가져오기 (설계 "카드 식별"). lib/card-import가 검사한 행을 받아 한 트랜잭션으로 넣는다.
--   - 카드는 (set_code, collector_number)로 upsert한다. 다시 돌려도 같은 결과(멱등).
--   - CSV에 있는 카드의 별칭은 파일 내용으로 바꾼다(별칭은 이 경로로만 들어온다).
--   - 문제가 하나라도 있으면 아무것도 쓰지 않고 errors를 돌려준다.
--   - p_dry_run이면 검사와 집계만 하고 쓰지 않는다.

create function public.cards_import(p_sets jsonb, p_cards jsonb, p_dry_run boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_errors jsonb;
  v_inserted int;
  v_updated int;
  v_aliases int;
begin
  create temp table import_cards on commit drop as
  select (c ->> 'line')::int as line,
         c ->> 'set_code' as set_code,
         c ->> 'collector_number' as collector_number,
         c ->> 'name_ko' as name_ko,
         c ->> 'rarity' as rarity,
         c ->> 'illustrator' as illustrator,
         coalesce(c -> 'aliases', '[]'::jsonb) as aliases
  from jsonb_array_elements(p_cards) c;

  create temp table import_aliases on commit drop as
  select ic.line, ic.set_code as card_set, ic.collector_number as card_number,
         a ->> 'lang' as lang, a ->> 'set_code' as set_code,
         a ->> 'collector_number' as collector_number, a ->> 'name' as name
  from import_cards ic, jsonb_array_elements(ic.aliases) a;

  -- 1. DB에도 없고 파일에서도 이름을 주지 않은 세트
  -- 2. 이미 다른 카드에 붙어 있는 별칭(같은 언어·세트·번호)
  select coalesce(jsonb_agg(e order by (e ->> 'line')::int), '[]'::jsonb) into v_errors
  from (
    select jsonb_build_object(
             'line', ic.line,
             'message', format('세트 %s가 DB에 없어요. set_name_ko 컬럼으로 세트 이름을 함께 주세요.', ic.set_code)) as e
    from import_cards ic
    where not exists (select 1 from public.sets s where s.code = ic.set_code)
      and not exists (select 1 from jsonb_array_elements(p_sets) ps where ps ->> 'code' = ic.set_code)
    union all
    select jsonb_build_object(
             'line', ia.line,
             'message', format('별칭 %s %s %s가 이미 다른 카드(%s %s)에 붙어 있어요.',
                               ia.lang, ia.set_code, ia.collector_number, c.set_code, c.collector_number))
    from import_aliases ia
    join public.card_aliases a
      on a.lang = ia.lang and lower(a.set_code) = lower(ia.set_code) and a.collector_number = ia.collector_number
    join public.cards c on c.id = a.card_id
    -- 주인 카드도 이번 파일에 있으면 그 별칭은 어차피 바뀌므로 충돌이 아니다.
    where not exists (
      select 1 from import_cards o where o.set_code = c.set_code and o.collector_number = c.collector_number)
  ) problems;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', v_errors);
  end if;

  select count(*) filter (where c.id is null), count(*) filter (where c.id is not null)
  into v_inserted, v_updated
  from import_cards ic
  left join public.cards c on c.set_code = ic.set_code and c.collector_number = ic.collector_number;
  select count(*) into v_aliases from import_aliases;

  if p_dry_run then
    return jsonb_build_object('ok', true, 'dry_run', true,
      'inserted', v_inserted, 'updated', v_updated, 'aliases', v_aliases);
  end if;

  insert into public.sets (code, name_ko)
  select ps ->> 'code', ps ->> 'name_ko' from jsonb_array_elements(p_sets) ps
  on conflict (code) do update set name_ko = excluded.name_ko;

  insert into public.cards (set_code, collector_number, name_ko, rarity, illustrator)
  select set_code, collector_number, name_ko, rarity, illustrator from import_cards
  on conflict (set_code, collector_number) do update
    set name_ko = excluded.name_ko, rarity = excluded.rarity, illustrator = excluded.illustrator;

  delete from public.card_aliases a
  using public.cards c, import_cards ic
  where a.card_id = c.id and c.set_code = ic.set_code and c.collector_number = ic.collector_number;

  insert into public.card_aliases (card_id, lang, set_code, collector_number, name)
  select c.id, ia.lang, ia.set_code, ia.collector_number, ia.name
  from import_aliases ia
  join public.cards c on c.set_code = ia.card_set and c.collector_number = ia.card_number;

  return jsonb_build_object('ok', true, 'dry_run', false,
    'inserted', v_inserted, 'updated', v_updated, 'aliases', v_aliases);
end;
$$;

revoke execute on function public.cards_import(jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.cards_import(jsonb, jsonb, boolean) to service_role;

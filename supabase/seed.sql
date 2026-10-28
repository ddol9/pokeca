-- 로컬 개발·테스트용 최소 시드. 실제 카드 목록은 CSV 임포트로 넣는다.
insert into public.sets (code, name_ko, released_on) values
  ('sv2a', '포켓몬 카드 151', '2023-06-16');

insert into public.cards (set_code, collector_number, name_ko, rarity, illustrator) values
  ('sv2a', '201/165', '리자몽 ex', 'SAR', 'Mitsuhiro Arita'),
  ('sv2a', '205/165', '뮤 ex', 'SAR', 'Mitsuhiro Arita');

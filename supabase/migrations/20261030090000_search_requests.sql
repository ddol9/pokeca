-- 검색 결과 없음 화면의 "이 번호로 찾기 요청" (design 6A). 지나가며 남는 검색 실패와 구분한다.
alter table public.search_misses add column requested boolean not null default false;

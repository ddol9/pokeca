# 확장 아트 아카이브

카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브. 설계는 `docs/designs/extended-art-archive-mvp.md`, 디자인 토큰은 `DESIGN.md`.

## 로컬 실행

필요: Node 22, Docker.

```bash
npm install
npm run db:start                 # 로컬 Supabase (마이그레이션·시드 자동 적용)
cp .env.example .env.local       # 값은 `npx supabase status -o env`에서 복사
npm run dev
npm run demo:seed                # (선택) 로컬 DB에 데모 도안 5개
```

도안은 모두 사이트에 보관한다. 원본(PNG·JPEG·PDF)을 올리면 서버가 PNG·JPEG에서 webp 미리보기를 만든다. PDF 원본은 미리보기 이미지를 같이 올린다.

## 테스트

```bash
npm test          # Vitest: 단위 + 로컬 Supabase 통합 테스트
npm run test:e2e  # Playwright: 데스크톱·모바일, axe 접근성 검사
```

GitHub Actions(`.github/workflows/test.yml`)가 push·PR마다 lint, 타입 검사, 두 테스트를 돌린다.

## 접근 규칙

- 모든 테이블은 RLS를 켜고 정책을 두지 않는다. 데이터는 서버에서 `lib/supabase/server.ts`의 `db()`로만 읽고 쓴다.
- 새 테이블이나 함수를 만들면 `tests/integration/access-boundary.test.ts`가 RLS 누락과 공개 실행 권한을 잡아낸다.

## 카드 넣기 (CSV)

```bash
npm run cards:import -- cards.csv          # 검사만: 몇 장이 새로 들어가고 갱신되는지 보여 준다
npm run cards:import -- cards.csv --apply  # 실제로 넣는다
```

- 컬럼: `set_code, collector_number, name_ko, rarity, illustrator, alias_set_code_ja, alias_number_ja, name_ja, alias_set_code_en, alias_number_en, name_en`. 앞의 셋만 필수이고 순서는 자유다.
- DB에 없는 세트는 `set_name_ko` 컬럼에 세트 이름을 같이 준다.
- 같은 카드(`set_code` + `collector_number`)는 갱신되고, 그 카드의 별칭은 파일 내용으로 바뀐다. 여러 번 돌려도 결과가 같다.
- 오류가 하나라도 있으면 줄 번호와 함께 보여 주고 아무것도 넣지 않는다.
- 운영 DB에 넣을 때는 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`를 운영 값으로 주고 실행한다(출력 첫 줄의 "대상"을 확인).

## 어드민 계정 만들기

공개 가입은 꺼져 있다. 어드민은 아래 순서로 직접 만든다.

1. Supabase 대시보드 → Authentication → Users → "Add user"로 이메일·비밀번호 계정을 만든다(Email 제공자는 켜 두고, "Allow new users to sign up"은 끈다).
2. SQL 편집기에서 허용 목록에 넣는다: `insert into admins (user_id, email) select id, email from auth.users where email = '<이메일>';`
3. `/admin/login`으로 로그인한다.

## 배포 환경 변수

`.env.example`의 값 전부. 특히 `CRON_SECRET`(정리 작업 인증)과 `REPORT_HASH_SECRET`(신고 IP 대역 해시)은 임의의 긴 문자열로 넣는다.

신고 알림 메일은 Resend로 보낸다. Resend에서 보내는 도메인을 인증하고 `RESEND_API_KEY`, `REPORT_NOTIFY_TO`(받는 주소), `REPORT_NOTIFY_FROM`(인증한 도메인의 주소)을 넣는다. 셋 중 하나라도 비면 메일 없이 서버 로그에만 남고, 신고 저장에는 영향이 없다.

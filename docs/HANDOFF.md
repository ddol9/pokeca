# 인수인계: 지금 상태와 다음 할 일

2026-10-30 기준. 이어서 작업할 사람이 처음 읽는 문서다. 제품 설계는 `docs/designs/extended-art-archive-mvp.md`, 디자인 토큰은 `DESIGN.md`, 로컬 실행·설정 절차는 `README.md`에 있다.

## 한 줄 요약

카드 번호(예: `sv2a 201/165`)로 포켓몬 카드 확장 아트 도안을 찾고 받는 비영리 아카이브. Next.js 16 + Supabase. 기능은 로컬에서 다 돌아가고, **아직 배포하지 않았다.**

## 화면 전체 보기

`docs/designs/screen-map/index.html`을 브라우저로 열면 방문자·작가·어드민의 화면 흐름과 모든 화면의 데스크톱(1280px)·모바일(375px) 캡처가 있다. 화면을 바꾸면 캡처도 다시 찍는다(아래 "화면 지도 다시 찍기").

| 누구 | 경로 |
|---|---|
| 방문자 | `/` 홈 · `/search?q=` 검색 · `/cards/[set]/[number]` 카드 페이지(도안 목록, 크게 보기, 다운로드, 신고) · `/artists/[handle]` 작가 페이지 · `/takedown` 권리자 내림 요청 |
| 작가 | `/artist/login`(구글) → `/artist/signup` 신청 → 어드민 승인 → `/artist` 내 도안 · `/artist/new` 올리기 |
| 어드민 | `/admin/login`(이메일) · `/admin/artworks` 도안 · `/admin/artworks/new` 등록 · `/admin/artists` 작가 승인 · `/admin/reports` 신고 |

## 지금까지 머지된 PR

모두 `main`에 들어가 있다(2026-10-30). 새 작업은 `main`에서 브랜치를 따서 PR로 올린다.

| PR | 내용 |
|---|---|
| #1~#8 | MVP, CSV 카드 넣기, 신고 메일, 머리글 검색, 허락 근거 파일, PSA·BRG 치수, 보관 아카이브 전환 |
| #9 | 작가 계정: 구글 로그인, 어드민 승인, 작가 페이지 |
| #10 | 디자인 문서 대비 빠진 화면(검색 요청·로딩·오류, 모바일 검색, 카드 실루엣), 화면 지도, 어드민·작가 화면의 `Date.now()` 오류 수정 |
| #11 | 공식 사이트 카드 수집 스크립트, 일본판 별칭 스크립트, 한글판 카드 1,430장 CSV(`data/`), 이 문서 |

## 다음 할 일 (우선순위 순)

1. **카드 데이터:** 로컬 DB에는 넣어 봤다(2026-10-30, 1,430장 · 별칭 1,357개, 검색 확인). 각자 로컬에는 `npm run cards:import -- data/cards-kr.csv --apply`로 넣는다. 운영 DB는 배포 뒤 같은 명령을 운영 키로. 자세한 건 `data/README.md`.
2. **배포** (아래 체크리스트). 아직 아무것도 하지 않았다.
3. **카드 데이터 다듬기:** 일본판 별칭 못 붙인 73장(`data/cards-kr-alias-review.csv`), 영문판 별칭, 2023년 이전 카드.
4. **카카오 로그인:** 카카오 앱을 개인 비즈 앱으로 전환(본인인증, 무료)한 뒤 이메일 동의항목을 켜고 `supabase/config.toml`에서 카카오를 켠다. 앱·키는 만들어 두었다. 절차는 README "카카오·구글 로그인 설정".
5. **신고 알림 메일:** Resend 도메인 인증 + 키. 없으면 서버 로그로만 남고 다른 기능엔 영향 없다.
6. `TODOS.md`의 남은 항목.

## 배포 체크리스트

계정 로그인, 비밀번호·키 입력, 약관 동의는 담당자가 직접 한다.

- [ ] Supabase 운영 프로젝트 만들기 → `npx supabase link` → `npx supabase db push`로 마이그레이션 적용
- [ ] Supabase → Authentication → Sign In / Providers: Google 켜고 클라이언트 ID·시크릿 입력. "Allow new users to sign up" 켬(소셜 가입용. 계정만으로는 권한이 없다)
- [ ] Supabase → URL Configuration → Redirect URLs에 `https://<사이트>/artist/callback`
- [ ] Google Cloud Console: OAuth 클라이언트의 승인된 리디렉션 URI에 `https://<프로젝트>.supabase.co/auth/v1/callback`. 동의 화면을 **게시**(테스트 모드면 테스트 사용자만 로그인됨)
- [ ] Vercel 환경 변수: `.env.example` 전부. `CRON_SECRET`, `REPORT_HASH_SECRET`은 임의의 긴 문자열. `SUPABASE_DB_URL`은 넣지 않는다(테스트 전용)
- [ ] 어드민 계정 만들기(README "어드민 계정 만들기")
- [ ] 카드 데이터 넣기(`data/README.md`)
- [ ] 정리 작업 Cron은 `vercel.json`에 있다(매일 18:00 UTC)

## 알아 둘 함정

- **Next.js 16은 우리가 아는 Next와 다르다.** 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽는다(`AGENTS.md`). `cacheComponents`가 켜져 있다.
  - 요청 때만 해야 하는 일(세션 확인 등)은 `await connection()`(`next/server`)을 먼저 부른다. 안 그러면 미리 렌더 중 `Date.now()` 오류가 난다. `lib/supabase/auth.ts` 참고. 통합 테스트에서는 `next/server`의 `connection`을 mock한다(`tests/integration/consent-evidence.test.ts`).
  - 에러 경계 props는 `{ error, retry }`.
- **테스트는 시드 DB 기준이다.** `supabase/seed.sql`의 카드 2장과 테스트용 영문 별칭(MEW 199/165)을 전제로 한다. 실제 카드 데이터를 넣은 로컬 DB에서는 검색·가져오기 테스트 8개가 실패하니, 테스트 전에 `npm run db:reset`을 하고 끝나면 카드 데이터를 다시 넣는다. CI는 매번 새 DB라 상관없다.
- **카드 가져오기는 별칭을 파일 내용으로 바꾼다.** 이미 있는 카드를 다시 넣으면 그 카드의 별칭은 CSV에 있는 것만 남는다. 별칭을 DB에서 손으로 고치지 말고 CSV를 고쳐서 다시 넣는다.
- **같은 번호가 두 카드에 걸릴 수 있다.** 한글판과 일본판 번호가 어긋난 카드(예: `SV1S 100/078`은 한글판 지니어이면서 일본판 모란의 번호)는 검색하면 바로 가지 않고 후보 2장을 보여 준다. 의도된 동작이다.
- **데이터 접근:** 모든 테이블은 RLS를 켜고 정책이 없다. 서버에서 `lib/supabase/server.ts`의 `db()`로만 읽고 쓴다. 새 테이블·함수는 `tests/integration/access-boundary.test.ts`가 검사한다. 함수 실행 권한은 `service_role`에만 준다.
- **방문자 쿠키:** 카드 페이지는 서버에서 방문자 쿠키를 읽지 않는다(캐시 때문). 방문자별 상태는 클라이언트가 마운트 뒤 API로 가져온다.
- **로컬 주소:** `127.0.0.1`로 열었으면 끝까지 `127.0.0.1`. 로그인 콜백이 브라우저가 연 Host로 돌아오게 해 두었다.
- **공식 카드 사이트:** 없는 번호에 500을 낸다. 수집 스크립트의 판단 규칙은 `data/README.md`.

## 테스트

```bash
npm run lint && npm run typecheck
npm test            # Vitest 99개: 단위 + 로컬 Supabase 통합 (npm run db:start 필요)
npm run test:e2e    # Playwright 78개 통과·16개 건너뜀: 데스크톱·모바일, axe 접근성
```

- e2e 도우미는 `tests/e2e/db.ts`: `sql`, `ensureUser`, `sessionCookies`(어드민), `socialSessionCookies`(작가), `clearArtworks`, `clearArtists`.
- 건너뛰는 16개는 어드민·작가·API 테스트의 모바일 실행이다(데스크톱에서 한 번만 돈다).
- CI: `.github/workflows/test.yml`이 push·PR마다 전부 돌린다.

## 화면 지도 다시 찍기

1. `npm run db:reset && npm run demo:seed` (데모 작가 `byeolbit`과 도안)
2. 임시 Playwright 스펙에서 `sessionCookies`·`socialSessionCookies`로 로그인 상태를 만들고 각 경로를 1280px·375px로 찍는다. 찍기 전에 `page.addStyleTag({ content: "nextjs-portal{display:none}" })`로 개발 오버레이를 숨긴다.
3. `docs/designs/screen-map/img/`에 webp로 저장하고 `index.html`을 고친다.

## 코드 습관

- 주석·문서·화면 문구는 한국어. 주석은 "왜"만 짧게.
- 스타일은 CSS Modules + `app/globals.css` 토큰(`--color-*`, `--space`, `--touch`, `--radius`). hex를 직접 쓰지 않는다.
- 커밋 메시지는 영어 `feat:`/`fix:`/`test:`/`docs:`, PR 설명은 한국어.

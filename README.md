# 확장 아트 아카이브

카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브. 설계는 `docs/designs/extended-art-archive-mvp.md`, 디자인 토큰은 `DESIGN.md`.

## 로컬 실행

필요: Node 22, Docker.

```bash
npm install
npm run db:start                 # 로컬 Supabase (마이그레이션·시드 자동 적용)
cp .env.example .env.local       # 값은 `npx supabase status -o env`에서 복사
npm run dev
```

## 테스트

```bash
npm test          # Vitest: 단위 + 로컬 Supabase 통합 테스트
npm run test:e2e  # Playwright: 데스크톱·모바일, axe 접근성 검사
```

GitHub Actions(`.github/workflows/test.yml`)가 push·PR마다 lint, 타입 검사, 두 테스트를 돌린다.

## 접근 규칙

- 모든 테이블은 RLS를 켜고 정책을 두지 않는다. 데이터는 서버에서 `lib/supabase/server.ts`의 `db()`로만 읽고 쓴다.
- 새 테이블이나 함수를 만들면 `tests/integration/access-boundary.test.ts`가 RLS 누락과 공개 실행 권한을 잡아낸다.

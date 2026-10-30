# TODOS

전체 우선순위는 `docs/HANDOFF.md`의 "다음 할 일".

## Deploy

### 첫 배포

- **What:** Supabase 운영 프로젝트, Google 로그인 공급자, Vercel 환경 변수, 어드민 계정, 카드 데이터.
- **Context:** 체크리스트는 `docs/HANDOFF.md`의 "배포 체크리스트". 2026-10-30 기준 아무것도 하지 않았다.

### 카카오 로그인 켜기

- **What:** 카카오 앱을 개인 비즈 앱으로 전환하고 이메일 동의항목을 켠 뒤 `supabase/config.toml`과 Supabase 대시보드에서 카카오를 켠다.
- **Why:** Supabase가 카카오에 이메일을 항상 요청해서 비즈 앱이 아니면 KOE205로 막힌다.

### 신고 알림 메일

- **What:** Resend 도메인 인증, `RESEND_API_KEY`·`REPORT_NOTIFY_TO`·`REPORT_NOTIFY_FROM`.

## Data

### 일본판 별칭 73장 확인

- **What:** `data/cards-kr-alias-review.csv`의 카드에 일본판 번호를 찾아 `data/cards-kr.csv`에 채운다.
- **Context:** SVI·M6a 등은 TCGdex 일본어에 세트가 생기면 `npm run cards:aliases-ja`를 다시 돌리면 된다. 나머지는 번호가 어긋났는데 같은 일러스트레이터 카드가 여러 장이라 자동으로 못 정한 것.

### 영문판 별칭

- **What:** `alias_*_en` 채우기. 국제판은 세트 구성·번호가 달라(151 = MEW) 매칭 규칙부터 정한다.

### 2023년 이전 카드

- **What:** 소드실드 이전 세트가 필요한지 정하고, 필요하면 `npm run cards:fetch -- --years 2020-2022`.

## Design

### 시각 목업 생성과 승인

- **What:** gstack 디자이너에 OpenAI 키를 설정한 뒤 `/design-shotgun`으로 홈, 카드 상세(데스크톱·모바일) 목업을 만들어 승인한다.
- **Why:** 디자인 결정(작업대 방향, 위계, 토큰, 모바일 배치)이 글로만 있어 구현자마다 해석이 달라질 수 있다.
- **Pros:** 화면 코드 전에 실제 모습을 확인하고 고칠 수 있다.
- **Cons:** OpenAI 이미지 생성 비용과 키 설정이 필요하다.
- **Context:** 2026-10-28 `/plan-design-review`에서 목업 생성이 "No OpenAI API key found"로 실패해 텍스트 리뷰로 진행했다. 기준 문서는 `docs/designs/extended-art-archive-mvp.md`의 "Design decisions"와 `DESIGN.md`.
- **Depends on / blocked by:** `~/.claude/skills/gstack/design/dist/design setup` (OpenAI 키). 화면 구현(eng T2) 시작 전에 하는 것이 좋다.

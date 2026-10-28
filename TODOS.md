# TODOS

## Design

### 시각 목업 생성과 승인

- **What:** gstack 디자이너에 OpenAI 키를 설정한 뒤 `/design-shotgun`으로 홈, 카드 상세(데스크톱·모바일) 목업을 만들어 승인한다.
- **Why:** 디자인 결정(작업대 방향, 위계, 토큰, 모바일 배치)이 글로만 있어 구현자마다 해석이 달라질 수 있다.
- **Pros:** 화면 코드 전에 실제 모습을 확인하고 고칠 수 있다.
- **Cons:** OpenAI 이미지 생성 비용과 키 설정이 필요하다.
- **Context:** 2026-10-28 `/plan-design-review`에서 목업 생성이 "No OpenAI API key found"로 실패해 텍스트 리뷰로 진행했다. 기준 문서는 `docs/designs/extended-art-archive-mvp.md`의 "Design decisions"와 `DESIGN.md`.
- **Depends on / blocked by:** `~/.claude/skills/gstack/design/dist/design setup` (OpenAI 키). 화면 구현(eng T2) 시작 전에 하는 것이 좋다.

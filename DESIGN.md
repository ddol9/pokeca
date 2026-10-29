---
name: 확장 아트 아카이브
direction: 수집가의 작업대 (plan-design-review D4, 2026-10-28)
colors:
  page: "#E9EDF1"        # 차가운 PVC 회색, 페이지 배경
  surface: "#F7F9FB"     # 작품 미리보기·입력창 바탕
  ink: "#1C2430"         # 본문·제목 (surface 대비 14.8:1)
  muted: "#5B6675"       # 보조 텍스트·흐린 칩 (surface 5.52:1, page 4.95:1)
  rule: "#C9D1DA"        # 구분선 1px
  action: "#2445A8"      # 바인더 군청: 주 행동·선택 상태·포커스 (흰 글자 8.43:1)
  demand: "#F4C430"      # 인덱스 탭 노랑: 찾기 요청 영역만
  demand-ink: "#3A2E00"  # demand 위 글자 (8.14:1)
  link: "#4F6D8A"        # 외부 링크 (5.12:1)
  link-visited: "#6B4F8A" # 방문한 외부 링크 (6.4:1)
  disabled: "#8A939E"    # 비활성 텍스트 전용 (본문 사용 금지, 2.95:1)
typography:
  body: "Pretendard Variable, 400/500, 16px, line-height 1.6"
  display: "Wanted Sans 700 — 워드마크와 페이지 제목에만"
  number: "Pretendard Variable 600, font-feature-settings: 'tnum', 카드 번호 40px(데스크톱) / 28px(모바일)"
  scale: [14, 16, 20, 28, 40]
  min-body: 16px   # 14px는 칩·메타 라벨에만, muted 이상 대비
spacing:
  unit: 8px
  page-gutter: { desktop: 32px, mobile: 16px }
  max-width: 1200px
rounded:
  md: 4px          # 타일·칩·버튼·입력창 공통. 알약 모양 금지
elevation:
  hover: "0 2px 8px rgba(28,36,48,.10)"  # 그리드 타일 hover만. 그 외 그림자 없음
---

# DESIGN.md — 확장 아트 아카이브

방향은 **수집가의 작업대**다. 카드 번호가 화면의 기준점이고, 작품이 주인공이며, 인터페이스는 테두리 상자 대신 글자 크기·간격·구분선으로 위계를 만든다. 색은 카드 수집 물건(PVC 슬리브, 바인더 커버, 인덱스 탭)에서 가져왔다.

## 규칙

- 모든 색은 CSS 변수로 정의한다(`--color-page`, `--color-action` …). 화면 코드에 hex를 직접 쓰지 않는다.
- 본문은 16px 이상. 보조 정보는 `muted` 이상 대비를 쓴다. `disabled`는 비활성 요소에만.
- 테두리 상자는 작품 그리드 타일과 입력창에만. 카드 정보·섹션은 상자로 감싸지 않는다.
- 군청(`action`)은 주 행동(다운로드), 선택된 필터 칩, 포커스 링에만. 노랑(`demand`)은 찾기 요청 영역에만.
- 다운로드는 채운 `action` 버튼. 작가 원본 글(출처)은 보조 텍스트 링크 + `link` 색 + ↗, 방문 후 `link-visited`. 둘의 무게를 구분한다.
- 도안 타일의 미리보기를 누르면 크게 보기 대화상자가 열린다(데스크톱: 그림 왼쪽·정보 오른쪽, 모바일: 위아래).
- 브라우저 기본값을 테마한다: 텍스트 선택색 `action` 20% 틴트, 포커스 링 2px `action` + 2px 오프셋, 링크 밑줄 오프셋 3px, 숫자 `tnum`.
- 모션은 타일 hover(위로 2px, 150ms ease-out)와 요청 완료 문구 전환 하나뿐. 규격 필터 전환에 모양 변형 모션 없음.
- 그림자는 그리드 타일 hover 하나만. 다른 장식 그림자·그라데이션·아이콘 원형 배지 없음.

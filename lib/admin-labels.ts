// 어드민 화면 표시 문구. 서버·브라우저 공용.
export const STATUS_LABEL = { active: "공개", hidden: "숨김", withdrawn: "철회" } as const;
export const LINK_LABEL = {
  unchecked: "미점검",
  ok: "정상",
  deleted: "삭제됨",
  no_access: "권한 없음",
  suspect: "의심",
} as const;
export const REASON_LABEL = {
  rights_holder: "권리자·본인 요청",
  suspected_theft: "도용 의심",
  other: "기타",
} as const;

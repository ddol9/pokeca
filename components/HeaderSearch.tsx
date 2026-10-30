"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SearchForm } from "./SearchForm";
import styles from "./HeaderSearch.module.css";

// 홈은 큰 검색창이 주인공이고, 어드민·작가 화면은 같은 라벨의 카드 고르기 폼이 있어서 머리글 검색을 숨긴다.
export function HeaderSearch() {
  const pathname = usePathname();
  const studio = pathname === "/artist" || pathname.startsWith("/artist/");
  if (pathname === "/" || pathname.startsWith("/admin") || studio) return null;
  // 다른 화면으로 가면 펼친 검색창을 닫는다.
  return <Collapsible key={pathname} />;
}

// 모바일(<640px)에서는 ⌕ 버튼을 눌러야 전체 폭 입력창이 펼쳐진다 (design 9A). 넓은 화면에서는 항상 보인다.
function Collapsible() {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.querySelector("input")?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls="header-search"
        onClick={() => setOpen((v) => !v)}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M12.5 12.5 17 17" strokeLinecap="round" />
        </svg>
        <span className="visually-hidden">카드 검색 {open ? "닫기" : "열기"}</span>
      </button>
      <div id="header-search" ref={panel} className={open ? styles.open : styles.panel}>
        <SearchForm size="header" />
      </div>
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { SearchForm } from "./SearchForm";

// 홈은 큰 검색창이 주인공이고, 어드민은 같은 라벨의 카드 고르기 폼이 있어서 머리글 검색을 숨긴다.
export function HeaderSearch() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/admin")) return null;
  return <SearchForm size="header" />;
}

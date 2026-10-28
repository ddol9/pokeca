"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FORMAT_INFO, FORMATS, type Format } from "@/lib/formats";
import { errorMessage, uploadFile } from "./upload";
import styles from "@/app/admin/admin.module.css";

// 작품 등록 (design 11A): 카드 찾기 → 규격 → 원본 글 → 허락 3단계 → 파일.
// 작품 ID는 폼을 열 때 만든다. 저장이 중간에 실패해 다시 눌러도 같은 작품이 된다(서버 멱등).

type Card = { cardId: string; label: string; name: string; setName: string };
type Uploaded = { file: File; uploadId: string };

export function NewArtworkForm() {
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [cards, setCards] = useState<Card[] | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploaded = useRef<Partial<Record<"original" | "thumbnail" | "evidence", Uploaded>>>({});

  async function findCards(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/cards?q=${encodeURIComponent(q)}`);
      const hits: Card[] = res.ok ? await res.json() : [];
      setCards(hits);
      if (hits.length === 1) setCard(hits[0]);
    } finally {
      setSearching(false);
    }
  }

  async function upload(kind: "original" | "thumbnail" | "evidence", file: File | null) {
    if (!file || file.size === 0) return undefined;
    const prev = uploaded.current[kind];
    if (prev && prev.file === file) return prev.uploadId;
    setSaving({ original: "원본 올리는 중…", thumbnail: "썸네일 올리는 중…", evidence: "허락 근거 올리는 중…" }[kind]);
    const uploadId = await uploadFile(kind, file);
    uploaded.current[kind] = { file, uploadId };
    return uploadId;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (!card) return setError("카드를 먼저 골라 주세요.");
    const hosted = form.get("hosted") === "on";
    const thumbnailOk = form.get("thumbnailOk") === "on";
    const linkOk = form.get("linkOk") === "on";
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    if (!hosted && !linkOk) return setError("링크 공유나 파일 보관 중 하나는 허락받아야 등록할 수 있어요.");
    if (sourceUrl && !linkOk) return setError("원본 글 주소를 넣었다면 링크 공유 허락에 체크해 주세요.");

    try {
      const original = hosted ? await upload("original", form.get("original") as File | null) : undefined;
      const thumbnail = thumbnailOk ? await upload("thumbnail", form.get("thumbnail") as File | null) : undefined;
      const evidence = await upload("evidence", form.get("evidence") as File | null);
      setSaving("저장 중…");
      const res = await fetch("/api/admin/artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          cardId: card.cardId,
          artistName: form.get("artistName"),
          format: form.get("format"),
          sourceUrl: sourceUrl || null,
          sourceVisibility: sourceUrl ? form.get("sourceVisibility") : null,
          consentLevel: hosted ? "hosted" : "link_only",
          thumbnailOk,
          printSizeVerified: form.get("printSizeVerified") === "on",
          uploads: { original, thumbnail, evidence },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.code ?? "failed");
      router.push(`/admin/artworks/${body.id}`);
    } catch (e) {
      setError(errorMessage(e instanceof Error ? e.message : ""));
      setSaving(null);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fieldset}>
        <legend>1. 카드</legend>
        <div className={styles.row}>
          <label className="visually-hidden" htmlFor="card-q">
            카드 번호 또는 이름
          </label>
          <input
            id="card-q"
            className={`${styles.input} ${styles.short}`}
            placeholder="sv2a 201/165"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                findCards(e.currentTarget.value);
              }
            }}
          />
          <button
            type="button"
            className={styles.secondary}
            disabled={searching}
            onClick={(e) => findCards((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
          >
            {searching ? "찾는 중…" : "카드 찾기"}
          </button>
        </div>
        {cards && cards.length === 0 && <p className={styles.muted}>맞는 카드가 없어요.</p>}
        {cards && cards.length > 0 && (
          <ul className={styles.candidates} aria-label="카드 후보">
            {cards.map((c) => (
              <li key={c.cardId}>
                <button
                  type="button"
                  className={styles.candidateButton}
                  aria-pressed={card?.cardId === c.cardId}
                  onClick={() => setCard(c)}
                >
                  <strong>{c.label}</strong> {c.name} <span className={styles.muted}>· {c.setName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {card && (
          <p role="status">
            선택한 카드: <strong>{card.label}</strong> {card.name}
          </p>
        )}
      </fieldset>

      <label className={styles.field}>
        <span>작가 이름(닉네임)</span>
        <input name="artistName" required maxLength={80} className={styles.input} />
      </label>

      <fieldset className={styles.fieldset}>
        <legend>2. 규격</legend>
        <div className={styles.row}>
          {FORMATS.map((f: Format, i) => (
            <label key={f} className={styles.check}>
              <input type="radio" name="format" value={f} required defaultChecked={i === 0} />
              {FORMAT_INFO[f].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>3. 원본 글</legend>
        <label className={styles.field}>
          <span>원본 글 주소</span>
          <span>아티스트가 파일만 보내 줬다면 비워 두세요.</span>
          <input name="sourceUrl" type="url" placeholder="https://cafe.naver.com/…" className={styles.input} />
        </label>
        <div className={styles.row}>
          <label className={styles.check}>
            <input type="radio" name="sourceVisibility" value="public" defaultChecked />
            누구나 볼 수 있음
          </label>
          <label className={styles.check}>
            <input type="radio" name="sourceVisibility" value="members_only" />
            카페 회원 전용
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>4. 아티스트 허락 (받은 것만 체크)</legend>
        <label className={styles.check}>
          <input type="checkbox" name="linkOk" defaultChecked />
          원본 글 링크 공유
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="thumbnailOk" />
          썸네일 표시
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="hosted" />
          파일 보관·다운로드
        </label>
        <label className={styles.field}>
          <span>허락 근거 (선택)</span>
          <span>아티스트 DM 캡처 등. PNG·JPEG·PDF, 20 MB까지. 어드민만 볼 수 있어요.</span>
          <input name="evidence" type="file" accept="image/png,image/jpeg,application/pdf" />
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>5. 파일</legend>
        <label className={styles.field}>
          <span>원본 파일 (파일 보관 허락 시 필수)</span>
          <span>PNG·JPEG·PDF, 100 MB까지</span>
          <input name="original" type="file" accept="image/png,image/jpeg,application/pdf" />
        </label>
        <label className={styles.field}>
          <span>썸네일 파일 (썸네일 허락 시 필수)</span>
          <span>PNG·JPEG</span>
          <input name="thumbnail" type="file" accept="image/png,image/jpeg" />
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="printSizeVerified" />
          파일 치수를 직접 확인함 (방문자에게 인쇄 치수를 안내)
        </label>
      </fieldset>

      <div role="status">
        {error && <p className={styles.error}>{error}</p>}
        {saving && <p className={styles.ok}>{saving}</p>}
      </div>
      <div>
        <button type="submit" className={styles.primary} disabled={!!saving}>
          등록
        </button>
      </div>
    </form>
  );
}

// 로컬 화면 확인용 데모 도안. 로컬 DB에만 쓴다: npm run demo:seed
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error(`로컬 DB에서만 실행하세요: ${url}`);
const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

// 규격별 바깥 크기(px)와 실제 카드가 들어갈 투명 창.
const LAYOUT = {
  "9pocket": { w: 1890, h: 2640, hole: { left: 630, top: 880, width: 630, height: 880 } },
  psa: { w: 800, h: 1350, hole: { left: 90, top: 330, width: 620, height: 880 } },
  brg: { w: 800, h: 1350, hole: { left: 90, top: 330, width: 620, height: 880 } },
} as const;

async function art(format: keyof typeof LAYOUT, hue: number): Promise<Buffer> {
  const { w, h, hole } = LAYOUT[format];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,35%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    ${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 137) % w}" cy="${(i * 211) % h}" r="${60 + (i % 5) * 40}" fill="hsla(${(hue + i * 20) % 360},80%,75%,0.35)"/>`).join("")}
  </svg>`;
  const hole_ = await sharp({ create: { width: hole.width, height: hole.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  return sharp(Buffer.from(svg)).composite([{ input: hole_, left: hole.left, top: hole.top, blend: "dest-out" }]).png().toBuffer();
}

const DEMO = [
  { number: "201/165", artist: "별빛도안", format: "9pocket", hue: 20, source: "https://cafe.naver.com/pokeca/101" },
  { number: "201/165", artist: "불꽃공방", format: "psa", hue: 0, source: null },
  { number: "201/165", artist: "리자몽러버", format: "brg", hue: 30, source: "https://cafe.naver.com/pokeca/102" },
  { number: "201/165", artist: "새벽작업실", format: "9pocket", hue: 260, source: null },
  { number: "205/165", artist: "숲속도안", format: "9pocket", hue: 120, source: null },
] as const;

for (const d of DEMO) {
  const { data: card } = await db.from("cards").select("id").eq("set_code", "sv2a").eq("collector_number", d.number).single();
  const id = crypto.randomUUID();
  const original = await art(d.format, d.hue);
  const preview = await sharp(original).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const files = [
    { kind: "original", bytes: original, mime: "image/png" },
    { kind: "thumbnail", bytes: preview, mime: "image/webp" },
  ];
  for (const f of files) {
    const { error } = await db.storage.from("artworks").upload(`artworks/${id}/${f.kind}-demo`, f.bytes, { contentType: f.mime });
    if (error) throw error;
  }
  const { error } = await db.rpc("artwork_create", {
    p_artwork: {
      id, card_id: card!.id, artist_name: d.artist, format: d.format,
      source_url: d.source, source_visibility: d.source ? "public" : null, print_size_verified: true,
    },
    p_files: files.map((f) => ({ kind: f.kind, path: `artworks/${id}/${f.kind}-demo`, mime_type: f.mime, size_bytes: f.bytes.length })),
    p_actor: "demo",
  });
  if (error) throw error;
  console.log("demo", d.number, d.format, `@${d.artist}`);
}

// Друге фото «на дверях» для товарів, у яких на сайті лише одне фото (вінки, гірлянди).
// Це не ШІ-генерація: справжнє фото товару вирізається з білого фону й накладається
// на намальовані двері в реальному масштабі (полотно дверей ≈ 0,9 м).
// Результат — feeds/photos/*.jpg, після збірки доступний як /feeds/photos/*.jpg (лише для фідів).
import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SIZE = 1200;
const WREATH_DOOR = { x: 300, y: 110, w: 600, h: 1000 }; // полотно дверей, px
const GARLAND_DOOR = { x: 300, y: 330, w: 600, h: 780 };
const PX_PER_M = WREATH_DOOR.w / 0.9;

const doorSvg = (DOOR) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece7df"/><stop offset="1" stop-color="#ddd5c9"/></linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3721"/><stop offset=".5" stop-color="#6d4529"/><stop offset="1" stop-color="#55331e"/></linearGradient>
  <radialGradient id="light" cx=".3" cy=".15" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></radialGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9cf8a"/><stop offset="1" stop-color="#a07a35"/></linearGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
</defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#wall)"/>
<rect y="1110" width="${SIZE}" height="90" fill="#b8a48c"/>
<rect y="1106" width="${SIZE}" height="8" fill="#f3efe8"/>
<rect x="${DOOR.x - 38}" y="${DOOR.y - 38}" width="${DOOR.w + 76}" height="${DOOR.h + 38}" fill="#000" opacity=".18" filter="url(#soft)"/>
<rect x="${DOOR.x - 34}" y="${DOOR.y - 34}" width="${DOOR.w + 68}" height="${DOOR.h + 34}" fill="#f6f3ee"/>
<rect x="${DOOR.x}" y="${DOOR.y}" width="${DOOR.w}" height="${DOOR.h}" fill="url(#wood)"/>
${Array.from({ length: 14 }, (_, i) => `<line x1="${DOOR.x + 20 + i * 41}" y1="${DOOR.y}" x2="${DOOR.x + 24 + i * 41}" y2="${DOOR.y + DOOR.h}" stroke="#3e2615" stroke-opacity=".18" stroke-width="2"/>`).join("")}
${[[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]].map(([c, r]) => {
  const k = DOOR.h / 1000, pw = 225, ph = [250, 330, 250][r] * k, px = DOOR.x + 60 + c * (pw + 30), py = DOOR.y + (60 + [0, 280, 640][r]) * k;
  return `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="none" stroke="#3a2313" stroke-opacity=".55" stroke-width="6"/><rect x="${px + 6}" y="${py + 6}" width="${pw - 12}" height="${ph - 12}" fill="none" stroke="#a8764c" stroke-opacity=".35" stroke-width="3"/>`;
}).join("")}
<rect x="${DOOR.x}" y="${DOOR.y}" width="${DOOR.w}" height="${DOOR.h}" fill="url(#light)"/>
<rect x="${DOOR.x + DOOR.w - 80}" y="${DOOR.y + DOOR.h - 510}" width="26" height="110" rx="10" fill="url(#brass)"/>
<rect x="${DOOR.x + DOOR.w - 112}" y="${DOOR.y + DOOR.h - 470}" width="70" height="16" rx="8" fill="url(#brass)"/>
</svg>`;

// Вирізання білого фону: заливка від країв (і від центру для кільця вінка),
// тож білий «сніг» усередині гілок не зникає.
async function cutout(buffer, { fillCenter, snowy }) {
  const trimmed = await sharp(buffer).flatten({ background: "#fff" }).trim({ threshold: 18 }).toBuffer();
  const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const white = (i) => data[i * 4] > 232 && data[i * 4 + 1] > 232 && data[i * 4 + 2] > 232;
  const bg = new Uint8Array(w * h), stack = [];
  const seed = (x, y) => { const i = y * w + x; if (!bg[i] && white(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  if (fillCenter) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) seed((w >> 1) + dx, (h >> 1) + dy);
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) seed(x - 1, y); if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1); if (y < h - 1) seed(x, y + 1);
  }
  for (let i = 0; i < w * h; i++) {
    if (snowy) { data[i * 4 + 3] = bg[i] ? 0 : 255; continue; }
    const m = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    data[i * 4 + 3] = m >= 245 ? 0 : m <= 215 ? 255 : Math.round(((245 - m) / 30) * 255);
  }
  // м'який край, щоб не було «пилки»
  const alpha = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).extractChannel(3).blur(1.2).raw().toBuffer();
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = alpha[i];
  return { data, w, h };
}

async function shadowOf({ data, w, h }, blur) {
  const s = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) s[i * 4 + 3] = Math.round(data[i * 4 + 3] * 0.3);
  return sharp(s, { raw: { width: w, height: h, channels: 4 } }).blur(blur).png().toBuffer();
}

export async function makeDoorPhoto(buffer, { kind, sizeMeters, snowy }) {
  const isWreath = kind === "wreaths";
  const DOOR = isWreath ? WREATH_DOOR : GARLAND_DOOR;
  let cut = await cutout(buffer, { fillCenter: isWreath, snowy });
  let img = sharp(cut.data, { raw: { width: cut.w, height: cut.h, channels: 4 } });
  if (!isWreath) img = img.rotate(90, { background: { r: 0, g: 0, b: 0, alpha: 0 } }); // гірлянда горизонтально над дверима
  // реальний масштаб: діаметр вінка або довжина гірлянди (гірлянду обмежуємо шириною кадру)
  const targetW = isWreath
    ? Math.round(Math.min(Math.max(sizeMeters || 0.5, 0.3), 0.85) * PX_PER_M)
    : SIZE - 160; // 2,5 м ширші за кадр — показуємо над дверима на всю ширину
  let png = await img.resize({ width: targetW }).png().toBuffer();
  let meta = await sharp(png).metadata();
  const raw = await sharp(png).ensureAlpha().raw().toBuffer();
  if (!isWreath) {
    // на фото постачальника гірлянда обрізана краєм кадру (після повороту — праворуч): м'яко гасимо цей кінець
    const fade = 140;
    for (let y = 0; y < meta.height; y++)
      for (let x = meta.width - fade; x < meta.width; x++) {
        const i = (y * meta.width + x) * 4 + 3;
        raw[i] = Math.round(raw[i] * ((meta.width - x) / fade) ** 1.5);
      }
    png = await sharp(raw, { raw: { width: meta.width, height: meta.height, channels: 4 } }).png().toBuffer();
  }
  const shadow = await shadowOf({ data: raw, w: meta.width, h: meta.height }, 12);
  const left = Math.round(SIZE / 2 - meta.width / 2);
  const top = isWreath ? DOOR.y + 130 : DOOR.y - 34 - Math.round(meta.height * 0.6);
  const layers = [];
  if (isWreath) {
    // стрічка, на якій висить вінок
    const ribbon = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect x="${SIZE / 2 - 9}" y="${DOOR.y}" width="18" height="${top - DOOR.y + 40}" fill="#9d1830"/><rect x="${SIZE / 2 - 9}" y="${DOOR.y}" width="6" height="${top - DOOR.y + 40}" fill="#c43a50" opacity=".6"/></svg>`;
    layers.push({ input: Buffer.from(ribbon), left: 0, top: 0 });
  }
  layers.push({ input: shadow, left: left + 8, top: top + 14 }, { input: png, left, top: Math.max(top, 0) });
  return sharp(Buffer.from(doorSvg(DOOR))).composite(layers).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export const doorFileName = (imageUrl, p) =>
  (imageUrl.match(/production\/([0-9a-f]{12,})/)?.[1] || "img").slice(0, 16) + "-" + String(p.sizeMeters ?? "x").replace(".", "_") + "m-door.jpg";

// Для кожного товару з одним фото (вінки/гірлянди) гарантує файл і повертає ім'я.
export async function ensureDoorPhotos(items, dirUrl) {
  await mkdir(dirUrl, { recursive: true });
  const result = new Map(), cache = new Map();
  for (const p of items) {
    if (p.images?.length !== 1 || !["wreaths", "decor"].includes(p.category)) continue;
    const name = doorFileName(p.images[0], p), file = new URL(name, dirUrl);
    try { await access(file); } catch {
      if (!cache.has(p.images[0])) {
        const res = await fetch(p.images[0], { signal: AbortSignal.timeout(20000) });
        if (!res.ok) { console.warn("Фото недоступне:", p.images[0]); continue; }
        cache.set(p.images[0], Buffer.from(await res.arrayBuffer()));
      }
      await sharp(await makeDoorPhoto(cache.get(p.images[0]), { kind: p.category, sizeMeters: p.sizeMeters, snowy: /засніж/i.test(p.name) })).toFile(fileURLToPath(file));
    }
    result.set(p.id, name);
  }
  return result;
}

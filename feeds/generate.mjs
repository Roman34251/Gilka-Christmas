// Генератор статичних товарних фідів (Rozetka, Epicentr, Monomarket) з Sanity.
// Запуск: npm run feeds  → оновлює feeds/rozetka.xml, epicentr.xml, monomarket.xml
// Під час `npm run build` файли копіюються в dist/assets/feeds і віддаються як /feeds/*.xml
import { readFile, writeFile } from "node:fs/promises";
import { categoryId } from "../catalog.mjs";

const dir = new URL("./", import.meta.url);
const config = JSON.parse(await readFile(new URL("config.json", dir), "utf8"));

// ---------- допоміжні ----------
export const esc = (v) =>
  String(v ?? "")
    // керуючі символи заборонені в XML (дозволені таб, LF, CR)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const cdata = (html) => "<![CDATA[" + String(html).replace(/\]\]>/g, "]]]]><![CDATA[>").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") + "]]>";
export const price = (n) => String(Math.round(n * 100) / 100);
export const offerId = (p) => String(p.id).replace(/[^A-Za-z0-9]/g, "");
export function feedDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
const HIDDEN_SPECS = new Set(["Постачальник", "Наявність у постачальника"]);
const spec = (p, label) => p.specifications?.find((s) => s.label === label)?.value;
export const brandOf = (p) => spec(p, "Виробник") || spec(p, "Постачальник") || config.defaultBrand;
export const paramsOf = (p) =>
  (p.specifications || []).filter((s) => s.label && s.value && !HIDDEN_SPECS.has(s.label));
const paragraphs = (text) =>
  String(text || "").split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
export const htmlDescription = (p, withSpecs = false) => {
  const paras = paragraphs(p.detail);
  let html = (paras.length ? paras : [p.name]).map((t) => "<p>" + esc(t).replace(/\n/g, "<br>") + "</p>").join("");
  if (withSpecs && paramsOf(p).length)
    html += "<ul>" + paramsOf(p).map((s) => `<li>${esc(s.label)}: ${esc(s.value)}</li>`).join("") + "</ul>";
  return html;
};
export const productPage = (p) =>
  config.siteUrl ? config.siteUrl.replace(/\/$/, "") + "/product/" + encodeURIComponent(p.slug || p.id) : "";
const photos = (p, max) => (p.images || []).filter((u) => /^https:\/\//.test(u)).slice(0, max);

// Назва для Monomarket: без CAPS, лапок і тире, ≤ 100 символів, у кінці вендор-код.
export function monoTitle(p) {
  let t = p.name
    .replace(/[«»„“”"]/g, "")
    .replace(/\s+[—–-]\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/,\s+/g, " ")
    .replace(/[\p{Script=Cyrillic}]{3,}/gu, (w) =>
      w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w)
    .replace(/\s+/g, " ").trim();
  const code = p.sku || offerId(p);
  if (!t.includes(code)) t += ` (${code})`;
  return t.length <= 100 ? t : t.slice(0, 100 - code.length - 4).trim() + ` (${code})`;
}

// ---------- завантаження з Sanity ----------
export async function loadFromSanity() {
  let projectId = process.env.SANITY_PROJECT_ID, dataset = process.env.SANITY_DATASET || "production";
  if (!projectId) {
    try {
      const env = await readFile(new URL("../.env", import.meta.url), "utf8");
      projectId = env.match(/^SANITY_PROJECT_ID=(.+)$/m)?.[1]?.trim();
      dataset = env.match(/^SANITY_DATASET=(.+)$/m)?.[1]?.trim() || dataset;
    } catch {}
  }
  if (!projectId) throw new Error("Не задано SANITY_PROJECT_ID");
  const url = new URL(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
  url.searchParams.set("query",
    '*[_type == "product" && defined(price) && defined(name)] | order(name) {"id": _id, "slug": slug.current, name, modelCode, modelName, sizeMeters, sizeLabel, category, price, oldPrice, detail, sku, available, specifications, "images": gallery[].asset->url}');
  url.searchParams.set("perspective", "published");
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("Sanity: HTTP " + res.status);
  const { result } = await res.json();
  if (!Array.isArray(result)) throw new Error("Sanity: неправильна відповідь");
  return result
    .filter((p) => typeof p.name === "string" && Number.isFinite(p.price) && p.price > 0)
    .map((p) => ({ ...p, category: categoryId(p.category), available: p.available !== false,
      images: (p.images || []).filter((u) => typeof u === "string") }));
}

// ---------- Rozetka ----------
export function rozetkaFeed(items, now = new Date()) {
  const used = [...new Set(items.map((p) => p.category))];
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', `<yml_catalog date="${feedDate(now)}">`, "<shop>",
    `<name>${esc(config.shopName)}</name>`, `<company>${esc(config.company)}</company>`,
    ...(config.siteUrl ? [`<url>${esc(config.siteUrl)}</url>`] : []),
    '<currencies><currency id="UAH" rate="1"/></currencies>', "<categories>",
    ...used.map((c) => `<category id="${config.categories[c].id}">${esc(config.categories[c].name)}</category>`),
    "</categories>", "<offers>"];
  for (const p of items) {
    const pics = photos(p, 15);
    if (!pics.length) continue;
    const old = p.oldPrice > p.price ? p.oldPrice : null;
    const brand = brandOf(p);
    out.push(`<offer id="${offerId(p)}" available="${p.available}">`,
      ...(productPage(p) ? [`<url>${esc(productPage(p))}</url>`] : []),
      `<price>${price(p.price)}</price>`,
      ...(old ? [`<price_old>${price(old)}</price_old>`] : []),
      "<currencyId>UAH</currencyId>", `<categoryId>${config.categories[p.category].id}</categoryId>`,
      ...pics.map((u) => `<picture>${esc(u)}</picture>`),
      `<vendor>${esc(brand)}</vendor>`,
      ...(p.sku ? [`<article>${esc(p.sku)}</article>`] : []),
      `<stock_quantity>${p.available ? config.stockQuantity : 0}</stock_quantity>`,
      `<name>${esc(p.name)}</name>`, `<name_ua>${esc(p.name)}</name_ua>`,
      `<description>${cdata(htmlDescription(p, true))}</description>`,
      `<description_ua>${cdata(htmlDescription(p, true))}</description_ua>`,
      "<state>new</state>",
      ...paramsOf(p).map((s) => `<param name="${esc(s.label)}">${esc(s.value)}</param>`),
      "</offer>");
  }
  out.push("</offers>", "</shop>", "</yml_catalog>");
  return out.join("\n") + "\n";
}

// ---------- Epicentr (формат шаблону «template з характеристиками») ----------
export function epicentrFeed(items, now = new Date()) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', `<yml_catalog date="${feedDate(now)}">`, "<offers>"];
  for (const p of items) {
    const pics = photos(p, 10);
    if (!pics.length) continue;
    const cat = config.epicentr.categories[p.category];
    const code = cat?.code ? ` code="${esc(cat.code)}"` : "";
    const old = p.oldPrice > p.price ? p.oldPrice : null;
    out.push(`<offer id="${offerId(p)}" available="${p.available}">`,
      `<price>${price(p.price)}</price>`,
      ...(old ? [`<price_old>${price(old)}</price_old>`] : []),
      `<category${code}>${esc(cat?.name || config.categories[p.category].name)}</category>`,
      `<attribute_set${code}>${esc(cat?.name || config.categories[p.category].name)}</attribute_set>`,
      `<name lang="ua">${esc(p.name)}</name>`,
      ...pics.map((u) => `<picture>${esc(u)}</picture>`),
      `<description lang="ua">${esc(htmlDescription(p, true))}</description>`,
      `<vendor>${esc(brandOf(p))}</vendor>`,
      '<param name="Міра виміру" paramcode="measure" valuecode="measure_pcs">шт.</param>',
      '<param name="Мінімальна кратність товару" paramcode="ratio">1</param>',
      ...(p.sku ? [`<param name="Артикул">${esc(p.sku)}</param>`] : []),
      ...paramsOf(p).map((s) => `<param name="${esc(s.label)}">${esc(s.value)}</param>`),
      "</offer>");
  }
  out.push("</offers>", "</yml_catalog>");
  return out.join("\n") + "\n";
}

// ---------- Monomarket (тільки товари в наявності, без цін) ----------
export function monomarketFeed(items) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', "<Market>", "<offers>"];
  for (const p of items.filter((x) => x.available)) {
    const pics = photos(p, 10);
    if (!pics.length) continue;
    const id = offerId(p);
    const paras = paragraphs(p.detail);
    const desc = "<h5>Опис</h5><br>" + (paras.length ? paras : [p.name]).map((t) => "<p>" + esc(t).replace(/\n/g, "<br>") + "</p>").join("") +
      (paramsOf(p).length ? "<h5>Характеристики</h5><br><ul>" + paramsOf(p).map((s) => `<li>${esc(s.label)}: ${esc(s.value)}</li>`).join("") + "</ul>" : "");
    out.push("<offer>", `<id>${id}</id>`, `<code>${id}</code>`,
      `<vendor_code>${esc(p.sku || id)}</vendor_code>`, `<title>${esc(monoTitle(p))}</title>`,
      ...(p.barcode ? [`<barcode>${esc(p.barcode)}</barcode>`] : []),
      `<category>${esc(config.monomarket.categories[p.category] || config.categories[p.category].name)}</category>`,
      `<brand>${esc(brandOf(p))}</brand>`, "<availability>Є в наявності</availability>",
      `<description>${cdata(desc)}</description>`,
      "<image_link>", ...pics.map((u) => `<picture>${esc(u)}</picture>`), "</image_link>",
      "<tags>", ...paramsOf(p).map((s) => `<param name="${esc(s.label)}">${esc(s.value)}</param>`), "</tags>",
      "</offer>");
  }
  out.push("</offers>", "</Market>");
  return out.join("\n") + "\n";
}

// ---------- запуск ----------
if (process.argv[1]?.endsWith("generate.mjs")) {
  const items = await loadFromSanity();
  const files = { "rozetka.xml": rozetkaFeed(items), "epicentr.xml": epicentrFeed(items), "monomarket.xml": monomarketFeed(items) };
  for (const [name, xml] of Object.entries(files)) await writeFile(new URL(name, dir), xml, "utf8");
  const inStock = items.filter((p) => p.available).length;
  console.log(`Товарів у Sanity: ${items.length}, в наявності: ${inStock}`);
  console.log("Записано: " + Object.keys(files).map((n) => "feeds/" + n).join(", "));
  if (!config.epicentr.categories.trees?.code) console.warn("УВАГА: у feeds/config.json не вказано коди категорій Епіцентру (epicentr.categories.*.code).");
  const noBarcode = items.filter((p) => p.available && !p.barcode).length;
  if (noBarcode) console.warn(`УВАГА: Monomarket вимагає штрихкод (barcode), його немає у ${noBarcode} товарів.`);
  const tooLong = items.filter((p) => p.available && monoTitle(p).length > 100).length;
  if (tooLong) console.warn(`УВАГА: ${tooLong} назв для Monomarket довші за 100 символів.`);
}

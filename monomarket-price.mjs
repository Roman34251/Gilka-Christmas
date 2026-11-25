// Прайс-лист для Monomarket: окремий закритий endpoint /api/monomarket-price.
// Ціна = ціна товару + доставка (для ялинок за розміром). На сайті доставка не показується:
// її беремо окремим запитом до Sanity, а публічний каталог (/api/products) цих даних не отримує.
import config from "./feeds/config.json" with { type: "json" };
import { categoryId } from "./catalog.mjs";

// Таблиця доставки за замовчуванням: перший рядок, у якого maxMeters >= розмір ялинки.
// Її можна змінити без деплою — документи «Доставка для Monomarket» (deliveryTier) у Sanity Studio.
export const DEFAULT_TIERS = [
  { maxMeters: 1.5, price: 300 },
  { maxMeters: 1.8, price: 500 },
  { maxMeters: 2, price: 600 },
  { maxMeters: 2.1, price: 700 },
  { maxMeters: 2.2, price: 700 },
  { maxMeters: 2.3, price: 1000 },
  { maxMeters: 2.5, price: 1300 },
  { maxMeters: 3, price: 1500 },
  { category: "wreaths", price: 200 },
];

export const offerId = (p) => String(p.id).replace(/[^A-Za-z0-9]/g, "");

// Рядок таблиці без категорії — для ялинок (старі документи). Рядок без maxMeters — фіксована
// доставка для всієї категорії (напр. вінки +200). Категорії без рядків — без доставки.
export function deliveryFor(product, tiers = DEFAULT_TIERS) {
  const cat = categoryId(product.category);
  const own = tiers.filter((t) => (t.category || "trees") === cat);
  if (!own.length) return 0;
  if (own.some((t) => !Number.isFinite(t.price) || t.price < 0 ||
      (t.maxMeters != null && !(Number.isFinite(t.maxMeters) && t.maxMeters > 0))))
    throw new Error("Invalid delivery tier");
  const flat = own.find((t) => t.maxMeters == null);
  if (flat) return flat.price;
  const size = Number(product.sizeMeters);
  if (!Number.isFinite(size) || size <= 0) throw new Error("Missing size for delivery");
  const tier = [...own].sort((a, b) => a.maxMeters - b.maxMeters).find((t) => size <= t.maxMeters);
  if (!tier) throw new Error("No delivery tier for size");
  return tier.price;
}

// Monomarket вимагає цілу ціну в гривнях. Ціни в базі залишаються з копійками.
const withDelivery = (price, delivery) =>
  Math.round((Math.round(price * 100) + Math.round(delivery * 100)) / 100);

export function renderPriceList(
  items,
  tiers = DEFAULT_TIERS,
  env = {},
  now = new Date(),
) {
  const cfg = config.monomarket.price;
  // склад відправки в кабінеті Monomarket; блок warehouses передається завжди
  const warehouseId = String(env.MONOMARKET_WAREHOUSE_ID || cfg.warehouseId || "10002");
  // Товар, для якого не можна визначити доставку (немає розміру або вищий за таблицю), не потрапляє
  // в прайс — Monomarket вимкне лише його. Раніше така помилка валила весь прайс (503).
  const priced = [];
  for (const p of items) {
    try { priced.push([p, deliveryFor(p, tiers)]); }
    catch (e) { console.error("Monomarket price: пропущено", p.id, e.message); }
  }
  return {
    updatedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    total: priced.length,
    data: priced.map(([p, delivery]) => {
      const stock = p.available ? config.stockQuantity : 0;
      // Знижка лише для ялинок і лише в Monomarket: нова ціна = ціна з доставкою мінус відсоток,
      // old_price = колишня ціна (або вища стара ціна з бази, якщо вона є).
      const base = withDelivery(p.price, delivery);
      const own = p.oldPrice > p.price ? withDelivery(p.oldPrice, delivery) : null;
      const pct = categoryId(p.category) === "trees" ? Number(cfg.treeDiscountPercent) || 0 : 0;
      const price = pct > 0 ? Math.round(base * (1 - pct / 100)) : base;
      const oldPrice = pct > 0 ? Math.max(own ?? 0, base) : own;
      return {
        code: offerId(p),
        price,
        old_price: oldPrice > price ? oldPrice : null,
        availability: !!p.available,
        stock,
        warehouses: [{ id: warehouseId, stock }],
        warranty_type: cfg.warrantyType,
        warranty_period: cfg.warrantyMonths,
        max_pay_in_parts: cfg.maxPayInParts,
        days_to_dispatch: cfg.daysToDispatch,
        manufacture: null,
      };
    }),
  };
}

function safeEqual(a, b) {
  const x = String(a || ""),
    y = String(b || "");
  if (!x.length || !y.length) return false;
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    diff |= x.charCodeAt(i % x.length) ^ y.charCodeAt(i % y.length);
  return diff === 0;
}

// Bearer-токен (секрет MONOMARKET_FEED_TOKEN). Без нього endpoint віддає 503.
export const MONOMARKET_IPS = new Set([
  "13.53.52.37", "16.16.42.238", "13.50.222.109", "16.171.78.185",
  "13.48.150.45", "185.13.251.125", "95.109.141.57", "94.232.209.34", "176.36.20.82",
]);

export function authorize(request, env) {
  // Cloudflare встановлює цей заголовок з адреси з'єднання, а не від клієнта.
  // Список: офіційна довідка Monomarket, «Вимоги до прайс-листа» (16.11.2026).
  if (MONOMARKET_IPS.has(request.headers.get("cf-connecting-ip"))) return { ok: true };
  if (!env.MONOMARKET_FEED_TOKEN) return { ok: false, status: 503 };
  const bearer = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const query = new URL(request.url).searchParams.get("token") || "";
  if (
    !safeEqual(bearer, env.MONOMARKET_FEED_TOKEN) &&
    !safeEqual(query, env.MONOMARKET_FEED_TOKEN)
  )
    return { ok: false, status: 401 };
  return { ok: true };
}

async function sanity(env, query) {
  const url = new URL(
    `https://${env.SANITY_PROJECT_ID}.api.sanity.io/v2025-02-19/data/query/${env.SANITY_DATASET || "production"}`,
  );
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Sanity " + res.status);
  const { result } = await res.json();
  if (!Array.isArray(result)) throw new Error("Invalid Sanity response");
  return result;
}

export async function monomarketPriceApi(request, env) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  };
  const auth = authorize(request, env);
  if (!auth.ok) return new Response(null, { status: auth.status, headers });
  try {
    if (!env.SANITY_PROJECT_ID) throw new Error("No Sanity");
    const [products, tierDocs] = await Promise.all([
      sanity(
        env,
        '*[_type == "product" && defined(price) && defined(name)] | order(name) {"id": _id, category, sizeMeters, price, oldPrice, available}',
      ),
      sanity(
        env,
        '*[_type == "deliveryTier" && defined(price)]{category, maxMeters, price}',
      ),
    ]);
    const items = products
      .filter((p) => Number.isFinite(p.price) && p.price > 0)
      .map((p) => ({ ...p, available: p.available !== false }));
    if (!items.length) throw new Error("Empty");
    const tiers = tierDocs.length ? tierDocs : DEFAULT_TIERS;
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify(renderPriceList(items, tiers, env)),
      { headers },
    );
  } catch (error) {
    // 5xx змушує Monomarket повторити спробу; порожній список він прочитав би як «усе зникло»
    console.error("Monomarket price failed:", error.message);
    return new Response(JSON.stringify({ error: "source unavailable" }), {
      status: 503,
      headers,
    });
  }
}

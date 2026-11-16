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
];

export const offerId = (p) => String(p.id).replace(/[^A-Za-z0-9]/g, "");

export function deliveryFor(product, tiers = DEFAULT_TIERS) {
  if (categoryId(product.category) !== "trees") return 0;
  const size = Number(product.sizeMeters);
  if (!Number.isFinite(size) || size <= 0) throw new Error("Missing tree size");
  const sorted = [...tiers].sort((a, b) => a.maxMeters - b.maxMeters);
  if (
    sorted.some(
      (t) =>
        !Number.isFinite(t.maxMeters) ||
        t.maxMeters <= 0 ||
        !Number.isFinite(t.price) ||
        t.price < 0,
    )
  )
    throw new Error("Invalid delivery tier");
  const tier = sorted.find((t) => size <= t.maxMeters);
  if (!tier) throw new Error("No delivery tier for tree size");
  return tier.price;
}

const withDelivery = (price, delivery) =>
  (Math.round(price * 100) + Math.round(delivery * 100)) / 100;

export function renderPriceList(
  items,
  tiers = DEFAULT_TIERS,
  env = {},
  now = new Date(),
) {
  const cfg = config.monomarket.price;
  const warehouseId = env.MONOMARKET_WAREHOUSE_ID || cfg.warehouseId;
  return {
    updatedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    total: items.length,
    data: items.map((p) => {
      const delivery = deliveryFor(p, tiers);
      const stock = p.available ? config.stockQuantity : 0;
      return {
        code: offerId(p),
        price: withDelivery(p.price, delivery),
        old_price:
          p.oldPrice > p.price ? withDelivery(p.oldPrice, delivery) : null,
        availability: !!p.available,
        stock,
        warehouses: warehouseId ? [{ id: warehouseId, stock }] : [],
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
export function authorize(request, env) {
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
        '*[_type == "deliveryTier" && defined(maxMeters) && defined(price)]{maxMeters, price}',
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

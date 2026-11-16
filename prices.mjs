import { offerId } from "./monomarket-price.mjs";

// Загальні роздрібні ціни з бази: націнка вже врахована, доставки немає.
export async function pricesApi(request, env, loadProducts) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  };
  try {
    if (!env.SANITY_PROJECT_ID) throw new Error("No catalogue source");
    const products = await loadProducts(env);
    const body = {
      updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      total: products.length,
      data: products.map((p) => ({
        id: p.id,
        code: offerId(p),
        sku: p.sku || null,
        name: p.name,
        price: p.price,
        old_price: p.oldPrice > p.price ? p.oldPrice : null,
        availability: p.available !== false,
      })),
    };
    return new Response(
      request.method === "HEAD" ? null : JSON.stringify(body),
      { headers },
    );
  } catch (error) {
    console.error("Price list failed:", error.message);
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({ error: "source unavailable" }),
      { status: 503, headers },
    );
  }
}

import { render } from "./render.jsx";
import template from "./public/index.html";
import {
  categoryId,
  categories,
  demoProducts,
  productUrl,
} from "./catalog.mjs";
import { orderApi, json } from "./commerce.mjs";
export async function loadProducts(env) {
  if (!env.SANITY_PROJECT_ID) return demoProducts;
  const url = new URL(
    "https://" +
      env.SANITY_PROJECT_ID +
      ".api.sanity.io/v2025-02-19/data/query/" +
      (env.SANITY_DATASET || "production"),
  );
  url.searchParams.set(
    "query",
    '*[_type == "product" && defined(price) && defined(name)] | order(name) {"id": _id, "slug": slug.current, name, category, price, oldPrice, detail, sku, available, specifications, "images": gallery[].asset->url}',
  );
  url.searchParams.set("perspective", "published");
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error("Catalogue unavailable");
  const { result } = await response.json();
  if (!Array.isArray(result)) throw new Error("Invalid catalogue");
  return result
    .filter(
      (p) =>
        typeof p.name === "string" && Number.isFinite(p.price) && p.price > 0,
    )
    .map((p) => {
      const images = (p.images || []).filter(
        (src) =>
          typeof src === "string" && src.startsWith("https://cdn.sanity.io/"),
      );
      return {
        ...p,
        category: categoryId(p.category),
        images,
        image: images[0] || "/art/0.svg",
        available: p.available !== false,
      };
    });
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function reply(request, body, status, type = "text/html; charset=utf-8") {
  return new Response(request.method === "HEAD" ? null : body, {
    status,
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://cdn.sanity.io data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    },
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      path = url.pathname;
    if (path.startsWith("/api/orders") || path === "/api/mono/webhook")
      return orderApi(request, env, loadProducts);
    if (!["GET", "HEAD"].includes(request.method))
      return json({ error: "Метод не підтримується" }, 405);
    if (path === "/robots.txt")
      return reply(
        request,
        "User-agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /order\nDisallow: /api/\nSitemap: " +
          url.origin +
          "/sitemap.xml",
        200,
        "text/plain",
      );
    const pages = [
      "/",
      "/catalog",
      "/cart",
      "/checkout",
      "/order",
      "/delivery",
      "/returns",
      "/privacy",
      "/contacts",
    ];
    const known =
      pages.includes(path) ||
      categories.some((c) => path === "/catalog/" + c.id) ||
      path.startsWith("/product/");
    if (!known && !["/api/products", "/sitemap.xml"].includes(path)) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
    }
    try {
      const items = await loadProducts(env);
      if (path === "/api/products") return json(items);
      if (path === "/sitemap.xml")
        return reply(
          request,
          '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            [
              "/",
              "/catalog",
              "/delivery",
              "/contacts",
              ...categories.map((c) => "/catalog/" + c.id),
              ...items.map(productUrl),
            ]
              .map(
                (p) => "<url><loc>" + escape(url.origin + p) + "</loc></url>",
              )
              .join("") +
            "</urlset>",
          200,
          "application/xml",
        );
      const product = items.find((p) => productUrl(p) === path),
        notFound = !known || (path.startsWith("/product/") && !product);
      const commerce = {
        ordersEnabled:
          !!env.ORDERS_DB &&
          env.ORDERS_ENABLED === "true" &&
          !!env.SANITY_PROJECT_ID,
        monoEnabled:
          !!env.ORDERS_DB && env.ORDERS_ENABLED === "true" && !!env.MONO_TOKEN,
        foodEnabled: env.FOOD_SALES_ENABLED === "true",
      };
      const data = {
        items,
        path: notFound ? "/404" : path,
        searchParams: Object.fromEntries(url.searchParams),
        demo: !env.SANITY_PROJECT_ID,
        commerce,
      };
      const titles = {
        "/": "Ялинки, різдвяні прикраси, вінки та смаколики",
        "/catalog": "Святковий каталог",
        "/cart": "Кошик",
        "/checkout": "Оформлення замовлення",
        "/order": "Статус замовлення",
        "/delivery": "Доставка й оплата",
        "/returns": "Обмін і повернення",
        "/privacy": "Конфіденційність",
        "/contacts": "Контакти",
      };
      const title =
        (notFound
          ? "Сторінку не знайдено"
          : product?.name ||
            categories.find((c) => path === "/catalog/" + c.id)?.name ||
            titles[path] ||
            "Різдвяна колекція") + " — Гілка свята";
      const description =
        product?.detail?.slice(0, 160) ||
        "Ялинки, різдвяні прикраси, вінки та новорічні смаколики. Створіть своє свято з Гілкою свята. Доставка Новою поштою.";
      const model = JSON.stringify(data).replaceAll("<", "\\u003c");
      const html = template
        .replace("<!--app-->", () => render(data))
        .replace("/*model*/", () => model)
        .replace("<!--title-->", escape(title))
        .replace("<!--description-->", escape(description))
        .replace(
          "<!--meta-->",
          () =>
            '<link rel="canonical" href="' +
            escape(url.origin + path) +
            '">' +
            (["/cart", "/checkout", "/order"].includes(path) ||
            notFound ||
            !env.SANITY_PROJECT_ID
              ? '<meta name="robots" content="noindex,nofollow">'
              : ""),
        );
      return reply(request, html, notFound ? 404 : 200);
    } catch (error) {
      console.error("Storefront request failed:", error.message);
      if (path === "/api/products")
        return json({ error: "Каталог тимчасово недоступний" }, 503);
      return reply(
        request,
        '<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Гілка свята</title><body><h1>Повернемося за мить</h1><p>Каталог тимчасово недоступний. Оновіть сторінку або зателефонуйте <a href="tel:+380966462364">096 646 23 64</a>.</p><a href="/">Спробувати знову</a></body></html>',
        503,
      );
    }
  },
};

import test from "node:test";
import assert from "node:assert/strict";
import { pricesApi } from "./prices.mjs";
import {
  deliveryFor,
  renderPriceList,
  authorize,
  offerId,
  monomarketPriceApi,
} from "./monomarket-price.mjs";

const tree = (sizeMeters, extra = {}) => ({
  id: "a-b" + sizeMeters,
  category: "trees",
  sizeMeters,
  price: 1000,
  available: true,
  ...extra,
});

test("загальний прайс повертає ціну бази без доставки та повторної націнки", async () => {
  let price = 1150.25;
  const load = async () => [
    tree(1.8, { price, oldPrice: 1500 }),
    { id: "wreath", name: "Вінок", price: 345, available: false },
  ];
  const req = (method = "GET") =>
    new Request("https://shop/api/prices", { method });
  let response = await pricesApi(req(), { SANITY_PROJECT_ID: "project" }, load);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.total, 2);
  assert.equal(body.data[0].price, 1150.25);
  assert.equal(body.data[0].old_price, 1500);
  assert.equal(body.data[0].code, offerId(tree(1.8)));
  assert.equal(body.data[1].availability, false);
  price = 1200;
  assert.equal(
    (
      await (
        await pricesApi(req(), { SANITY_PROJECT_ID: "project" }, load)
      ).json()
    ).data[0].price,
    1200,
  );
  response = await pricesApi(
    req("HEAD"),
    { SANITY_PROJECT_ID: "project" },
    load,
  );
  assert.equal(await response.text(), "");
});

test("загальний прайс не підставляє демо при недоступній базі", async (t) => {
  t.mock.method(console, "error", () => {});
  const req = new Request("https://shop/api/prices");
  assert.equal(
    (
      await pricesApi(req, {}, async () => {
        throw new Error("Should not load demo");
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await pricesApi(req, { SANITY_PROJECT_ID: "project" }, async () => {
        throw new Error("Database unavailable");
      })
    ).status,
    503,
  );
});

test("доставка ялинок за розміром", () => {
  const got = [0.7, 1.5, 1.8, 2, 2.1, 2.2, 2.3, 2.5, 3].map((s) =>
    deliveryFor(tree(s)),
  );
  assert.deepEqual(got, [300, 300, 500, 600, 700, 700, 1000, 1300, 1500]);
});
test("вінки +200, прикраси без доставки; невідомий розмір ялинки потребує уточнення", () => {
  assert.equal(deliveryFor({ category: "wreaths", sizeMeters: 0.45 }), 200);
  assert.equal(deliveryFor({ category: "decor", sizeMeters: 2.5 }), 0);
  assert.throws(() => deliveryFor(tree(null)), /Missing size/);
  assert.throws(() => deliveryFor(tree(4)), /No delivery tier/);
  assert.throws(
    () => deliveryFor(tree(2), [{ maxMeters: 3, price: -1 }]),
    /Invalid delivery tier/,
  );
});
test("прайс: ціна + доставка, old_price, code як у фіді", () => {
  const p = tree(2.3, { oldPrice: 1500 });
  const { data } = renderPriceList(
    [p, tree(1.5, { available: false })],
    undefined,
    { MONOMARKET_WAREHOUSE_ID: "9" },
  );
  assert.equal(data[0].code, offerId(p));
  assert.equal(data[0].price, 1900); // (1000 + 1000 доставка) −5%
  assert.equal(data[0].old_price, 2500);
  assert.equal(data[1].availability, false);
  assert.equal(data[1].stock, 0);
  assert.deepEqual(data[0].warehouses[0].id, "9");
});
test("авторизація токеном", () => {
  const req = (h) =>
    new Request("https://x/api/monomarket-price", { headers: h });
  assert.equal(authorize(req({}), {}).status, 503);
  assert.equal(authorize(req({}), { MONOMARKET_FEED_TOKEN: "t" }).status, 401);
  assert.equal(
    authorize(req({ authorization: "Bearer t" }), {
      MONOMARKET_FEED_TOKEN: "t",
    }).ok,
    true,
  );
  assert.equal(
    authorize(new Request("https://x/api/monomarket-price?token=t"), {
      MONOMARKET_FEED_TOKEN: "t",
    }).ok,
    true,
  );
});

test("офіційні сервери Monomarket мають доступ; сторонні адреси й forwarded-заголовки — ні", () => {
  const req = (headers) => new Request("https://x/api/monomarket-price", { headers });
  assert.equal(authorize(req({ "cf-connecting-ip": "13.53.52.37" }), {}).ok, true);
  assert.equal(authorize(req({ "cf-connecting-ip": "192.0.2.1" }), { MONOMARKET_FEED_TOKEN: "t" }).status, 401);
  assert.equal(authorize(req({ "x-forwarded-for": "13.53.52.37" }), { MONOMARKET_FEED_TOKEN: "t" }).status, 401);
});

test("ціни Monomarket — цілі гривні, доставка врахована, значення бази не змінюються", () => {
  const product = tree(1.8, { price: 1150.75, oldPrice: 1400.25 });
  const row = renderPriceList([product]).data[0];
  assert.equal(row.price, 1568); // 1651 з доставкою −5%
  assert.equal(row.old_price, 1900);
  assert.equal(product.price, 1150.75);
});

test("endpoint читає поточні ціни й доставку з бази без повторної націнки", async (t) => {
  let basePrice = 1150.35;
  let shipping = 550;
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    calls++;
    const url = new URL(input);
    assert.equal(url.searchParams.get("perspective"), "published");
    const result = url.searchParams.get("query").includes('"deliveryTier"')
      ? [{ maxMeters: 1.8, price: shipping }]
      : [
          tree(1.8, { price: basePrice }),
          { id: "wreath", category: "wreaths", price: 345, available: false },
        ];
    return Response.json({ result });
  });
  const env = { SANITY_PROJECT_ID: "project", MONOMARKET_FEED_TOKEN: "secret" };
  const request = (method = "GET") =>
    new Request("https://shop/api/monomarket-price", {
      method,
      headers: { authorization: "Bearer secret" },
    });
  assert.equal(
    (
      await monomarketPriceApi(
        new Request("https://shop/api/monomarket-price"),
        env,
      )
    ).status,
    401,
  );
  assert.equal(calls, 0);
  let response = await monomarketPriceApi(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  let json = await response.json();
  assert.equal(json.total, 2);
  assert.equal(json.data[0].price, 1615); // 1700 −5%
  assert.equal(json.data[0].old_price, 1700);
  assert.equal(json.data[0].code, offerId(tree(1.8)));
  assert.equal(json.data[1].price, 345);
  assert.equal(json.data[1].stock, 0);
  assert.ok(!JSON.stringify(json).includes("secret"));
  basePrice = 1200.25;
  shipping = 600;
  json = await (await monomarketPriceApi(request(), env)).json();
  assert.equal(json.data[0].price, 1710); // 1800 −5%
  response = await monomarketPriceApi(request("HEAD"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
});

test("недоступна база повертає 503 замість порожнього прайсу", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 500 }),
  );
  t.mock.method(console, "error", () => {});
  const response = await monomarketPriceApi(
    new Request("https://shop/api/monomarket-price", {
      headers: { authorization: "Bearer secret" },
    }),
    { SANITY_PROJECT_ID: "project", MONOMARKET_FEED_TOKEN: "secret" },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "source unavailable" });
});

test("warehouses завжди: склад 10002 і залишок 10", () => {
  const { data } = renderPriceList([{ id: "w1", category: "wreaths", sizeMeters: 0.45, price: 500, available: true }]);
  assert.deepEqual(data[0].warehouses, [{ id: "10002", stock: 10 }]);
  assert.equal(data[0].stock, 10);
});

test("вінки +200 з таблиці, ялинки за розміром, прикраси без доставки", () => {
  const tiers = [{ maxMeters: 2.3, price: 1000 }, { category: "wreaths", price: 200 }];
  assert.equal(deliveryFor({ category: "wreaths", sizeMeters: 0.45 }, tiers), 200);
  assert.equal(deliveryFor({ category: "wreaths", sizeMeters: 1.2 }, tiers), 200);
  assert.equal(deliveryFor({ category: "trees", sizeMeters: 2.3 }, tiers), 1000);
  assert.equal(deliveryFor({ category: "decor", sizeMeters: 2.5 }, tiers), 0);
  const { data } = renderPriceList([{ id: "w", category: "wreaths", sizeMeters: 0.45, price: 558.62, available: true }], tiers);
  assert.equal(data[0].price, 759);
});

test("товар без доставки (4 м, немає розміру) пропускається, а не валить увесь прайс", () => {
  const ok = { id: "ok", category: "trees", sizeMeters: 2.1, price: 1000, available: true };
  const { data, total } = renderPriceList([ok, { ...ok, id: "big", sizeMeters: 4 }, { ...ok, id: "nosize", sizeMeters: null }]);
  assert.equal(total, 1);
  assert.deepEqual(data.map((d) => d.code), ["ok"]);
});

test("знижка 5% на ялинки в Monomarket: old_price = ціна без знижки; вінки без знижки", () => {
  const t = tree(1.8, { price: 1000 }); // доставка 500 → 1500
  const w = { id: "w1", category: "wreaths", sizeMeters: 0.45, price: 500, available: true };
  const { data } = renderPriceList([t, w]);
  assert.equal(data[0].price, 1425);
  assert.equal(data[0].old_price, 1500);
  assert.equal(data[1].price, 700);
  assert.equal(data[1].old_price, null);
  assert.equal(t.price, 1000);
});

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { validateOrder, orderApi } from "./commerce.mjs";
const products = [
  {
    id: "p1",
    name: "Ялинка",
    price: 550.25,
    available: true,
    category: "trees",
  },
  { id: "food", name: "Ікра", price: 790, available: true, category: "treats" },
];
const body = () => ({
  consent: true,
  payment: "cod",
  delivery: "branch",
  customer: {
    name: "Тест Покупець",
    phone: "0960000000",
    city: "Київ",
    point: "1",
    comment: "",
  },
  lines: [{ id: "p1", quantity: 2, price: 1 }],
});
function db() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(new URL("./orders-schema.sql", import.meta.url), "utf8"),
  );
  return {
    prepare(query) {
      const stmt = sql.prepare(query);
      return {
        bind(...values) {
          return {
            first: async () => stmt.get(...values),
            run: async () => ({ meta: stmt.run(...values) }),
          };
        },
      };
    },
  };
}
const key = "12345678-1234-1234-1234-123456789abc",
  token = key + key;
const req = (b = body(), overrides = {}) =>
  new Request("https://shop.test/api/orders", {
    method: "POST",
    headers: {
      Origin: "https://shop.test",
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      "X-Order-Token": token,
      ...overrides,
    },
    body: JSON.stringify(b),
  });
const env = () => ({
  ORDERS_DB: db(),
  ORDERS_ENABLED: "true",
  SANITY_PROJECT_ID: "test",
});
test("server computes cents from catalogue, ignores client price", () => {
  const order = validateOrder(body(), products);
  assert.equal(order.amount, 110050);
  assert.equal(order.customer.phone, "+380960000000");
});
test("rejects duplicate, fractional and unavailable items", () => {
  const b = body();
  b.lines.push(b.lines[0]);
  assert.throws(() => validateOrder(b, products));
  b.lines = [{ id: "p1", quantity: 1.5 }];
  assert.throws(() => validateOrder(b, products));
  b.lines = [{ id: "p1", quantity: 1 }];
  assert.throws(() => validateOrder(b, [{ ...products[0], available: false }]));
});
test("rejects invalid contact, consent and food lockers", () => {
  let b = body();
  b.customer.phone = "123";
  assert.throws(() => validateOrder(b, products));
  b = body();
  b.consent = false;
  assert.throws(() => validateOrder(b, products));
  b = body();
  b.lines = [{ id: "food", quantity: 1 }];
  b.delivery = "locker";
  assert.throws(() => validateOrder(b, products));
});
test("COD order persists; repeats are idempotent; changed payload conflicts", async () => {
  const e = env();
  const first = await orderApi(req(), e, async () => products);
  assert.equal(first.status, 201);
  assert.equal((await first.json()).status, "cod");
  assert.equal((await orderApi(req(), e, async () => products)).status, 200);
  const b = body();
  b.lines[0].quantity = 3;
  assert.equal((await orderApi(req(b), e, async () => products)).status, 409);
  const result = await orderApi(
    new Request("https://shop.test/api/orders/" + key, {
      headers: { Authorization: "Bearer " + token },
    }),
    e,
    async () => products,
  );
  assert.equal((await result.json()).amount, 110050);
  assert.equal(
    (
      await orderApi(
        new Request("https://shop.test/api/orders/" + key),
        e,
        async () => products,
      )
    ).status,
    404,
  );
});
test("rejects cross-origin writes and unconfigured sales", async () => {
  assert.equal(
    (
      await orderApi(
        req(body(), { Origin: "https://bad.test" }),
        env(),
        async () => products,
      )
    ).status,
    403,
  );
  assert.equal((await orderApi(req(), {}, async () => products)).status, 503);
  assert.equal(
    (
      await orderApi(
        req(),
        { ...env(), ORDERS_ENABLED: "false" },
        async () => products,
      )
    ).status,
    503,
  );
});
test("payment token required and food sales require activation", async () => {
  const b = body();
  b.payment = "mono";
  assert.equal(
    (await orderApi(req(b), env(), async () => products)).status,
    503,
  );
  b.payment = "cod";
  b.lines = [{ id: "food", quantity: 1 }];
  assert.equal(
    (await orderApi(req(b), env(), async () => products)).status,
    409,
  );
});
test("monobank invoice and verified status; spoofed client status cannot mark paid", async () => {
  const original = globalThis.fetch;
  const e = { ...env(), MONO_TOKEN: "test" };
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (String(url).includes("/create")) {
      const invoice = JSON.parse(options.body);
      assert.equal(invoice.amount, 110050);
      assert.equal(invoice.merchantPaymInfo.basketOrder[0].sum, 55025);
      return Response.json({
        invoiceId: "invoice1",
        pageUrl: "https://pay.mbnk.biz/invoice1",
      });
    }
    return Response.json({
      invoiceId: "invoice1",
      amount: 110050,
      finalAmount: 110050,
      ccy: 980,
      status: "success",
      modifiedDate: "2026-11-08T12:00:00Z",
    });
  };
  try {
    const b = body();
    b.payment = "mono";
    const r = await orderApi(req(b), e, async () => products);
    assert.equal((await r.json()).status, "created");
    await orderApi(req(b), e, async () => products);
    assert.equal(calls, 1);
    const status = await orderApi(
      new Request("https://shop.test/api/orders/" + key + "?status=success", {
        headers: { Authorization: "Bearer " + token },
      }),
      e,
      async () => products,
    );
    assert.equal((await status.json()).status, "success");
  } finally {
    globalThis.fetch = original;
  }
});
test("ambiguous invoice timeout is stored for review and never retried automatically", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("timeout");
  };
  try {
    const e = { ...env(), MONO_TOKEN: "test" },
      b = body();
    b.payment = "mono";
    assert.equal(
      (await (await orderApi(req(b), e, async () => products)).json()).status,
      "invoice_review",
    );
    await orderApi(req(b), e, async () => products);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("bank status cannot be forged by URL and amount mismatches are rejected", async () => {
  const original = globalThis.fetch;
  const e = { ...env(), MONO_TOKEN: "test" };
  let mismatch = false;
  globalThis.fetch = async (url) =>
    String(url).includes("/create")
      ? Response.json({
          invoiceId: "invoice1",
          pageUrl: "https://pay.mbnk.biz/invoice1",
        })
      : Response.json({
          invoiceId: "invoice1",
          amount: mismatch ? 1 : 110050,
          finalAmount: 110050,
          ccy: 980,
          status: "created",
          modifiedDate: "2026-11-08T12:00:00Z",
        });
  try {
    const b = body();
    b.payment = "mono";
    await orderApi(req(b), e, async () => products);
    const statusRequest = () =>
      new Request("https://shop.test/api/orders/" + key + "?status=success", {
        headers: { Authorization: "Bearer " + token },
      });
    assert.equal(
      (await (await orderApi(statusRequest(), e, async () => products)).json())
        .status,
      "created",
    );
    mismatch = true;
    assert.equal(
      (await orderApi(statusRequest(), e, async () => products)).status,
      502,
    );
    assert.equal(
      (
        await orderApi(
          new Request(
            "https://shop.test/api/mono/webhook?order=" + key + "&key=forged",
            { method: "POST" },
          ),
          e,
          async () => products,
        )
      ).status,
      404,
    );
  } finally {
    globalThis.fetch = original;
  }
});

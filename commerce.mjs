const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function validateOrder(body, products) {
  if (!body || !body.consent) throw fail("Підтвердьте згоду на обробку даних.");
  if (
    !["cod", "mono"].includes(body.payment) ||
    !["branch", "locker"].includes(body.delivery)
  )
    throw fail("Оберіть спосіб оплати та доставки.");
  const c = body.customer || {};
  const customer = {};
  for (const [key, min, max] of [
    ["name", 3, 100],
    ["city", 2, 100],
    ["point", 1, 200],
    ["comment", 0, 1000],
  ]) {
    if (typeof (c[key] ?? "") !== "string")
      throw fail("Перевірте контактні дані.");
    customer[key] = (c[key] || "").trim();
    if (customer[key].length < min || customer[key].length > max)
      throw fail(
        "Заповніть ім’я, місто та відділення. Перевірте довжину полів.",
      );
  }
  const phone = String(c.phone || "").replace(/[^0-9]/g, "");
  if (!/^(?:380\d{9}|0\d{9})$/.test(phone))
    throw fail("Вкажіть український номер телефону: +380 та 9 цифр.");
  customer.phone = "+" + (phone.length === 10 ? "38" + phone : phone);
  if (
    !Array.isArray(body.lines) ||
    !body.lines.length ||
    body.lines.length > 50
  )
    throw fail("Кошик порожній або містить забагато позицій.");
  const seen = new Set();
  const lines = body.lines.map((line) => {
    const p = products.find((p) => p.id === line.id);
    if (!p || p.available === false)
      throw fail("Один із товарів більше не доступний. Оновіть кошик.", 409);
    if (
      seen.has(line.id) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    )
      throw fail("Перевірте кількість товарів.");
    seen.add(line.id);
    const price = Math.round(p.price * 100);
    if (!Number.isSafeInteger(price) || price <= 0)
      throw fail("Ціну товару потрібно уточнити.", 409);
    return {
      id: p.id,
      name: p.name,
      price,
      quantity: line.quantity,
      category: p.category,
    };
  });
  if (body.delivery === "locker" && lines.some((p) => p.category === "treats"))
    throw fail(
      "Для харчових продуктів оберіть відділення й погодьте умови доставки.",
    );
  const amount = lines.reduce((sum, p) => sum + p.price * p.quantity, 0);
  if (!Number.isSafeInteger(amount) || amount > 100000000)
    throw fail("Сума замовлення перевищує допустиму. Зателефонуйте нам.");
  return {
    customer,
    lines,
    amount,
    payment: body.payment,
    delivery: body.delivery,
  };
}
async function digest(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function bank(env, path, body) {
  const r = await fetch("https://api.monobank.ua" + path, {
    method: body ? "POST" : "GET",
    headers: { "X-Token": env.MONO_TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok)
    throw fail(
      "Банк тимчасово недоступний. Спробуйте перевірити статус пізніше.",
      502,
    );
  return r.json();
}
function publicOrder(row) {
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    pageUrl: ["created", "processing"].includes(row.status)
      ? row.page_url || null
      : null,
  };
}
export async function refreshPayment(env, row) {
  if (!row.invoice_id || row.payment !== "mono") return row;
  const status = await bank(
    env,
    "/api/merchant/invoice/status?invoiceId=" +
      encodeURIComponent(row.invoice_id),
  );
  if (
    status.invoiceId !== row.invoice_id ||
    status.ccy !== 980 ||
    status.amount !== row.amount
  )
    throw fail("Дані платежу потребують перевірки продавцем.", 502);
  if (
    ![
      "created",
      "processing",
      "hold",
      "success",
      "failure",
      "reversed",
      "expired",
    ].includes(status.status)
  )
    throw fail("Невідомий статус платежу.", 502);
  if (status.status === "success" && status.finalAmount !== row.amount)
    throw fail("Сума отриманого платежу потребує перевірки.", 502);
  const modified = Date.parse(status.modifiedDate);
  if (!Number.isFinite(modified))
    throw fail("Не вдалося перевірити дату платежу.", 502);
  await env.ORDERS_DB.prepare(
    "UPDATE orders SET status=?, bank_modified=? WHERE id=? AND bank_modified<=?",
  )
    .bind(status.status, modified, row.id, modified)
    .run();
  return await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE id=?")
    .bind(row.id)
    .first();
}
export async function orderApi(request, env, loadProducts) {
  const url = new URL(request.url),
    path = url.pathname;
  try {
    if (!env.ORDERS_DB)
      return json(
        {
          error:
            "Онлайн-оформлення ще не активовано. Зателефонуйте 096 646 23 64.",
        },
        503,
      );
    if (path === "/api/mono/webhook" && request.method === "POST") {
      const id = url.searchParams.get("order"),
        secret = url.searchParams.get("key");
      if (!id || !secret) return json({ error: "Not found" }, 404);
      const row = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE id=?")
        .bind(id)
        .first();
      if (!row || (await digest(secret)) !== row.webhook_hash)
        return json({ error: "Not found" }, 404);
      // Never trust the callback body: read the authoritative current status from monobank.
      if (!row.invoice_id) return json({ error: "Invoice not ready" }, 503);
      await refreshPayment(env, row);
      return json({ ok: true });
    }
    if (path.startsWith("/api/orders/") && request.method === "GET") {
      const row = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE id=?")
        .bind(decodeURIComponent(path.slice(12)))
        .first();
      const token =
        request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
      if (!row || !token || (await digest(token)) !== row.token_hash)
        return json(
          { error: "Замовлення не знайдено або доступ відсутній." },
          404,
        );
      return json(publicOrder(await refreshPayment(env, row)));
    }
    if (path !== "/api/orders" || request.method !== "POST")
      return json({ error: "Метод не підтримується." }, 405);
    if (request.headers.get("Origin") !== url.origin)
      return json({ error: "Недозволене джерело запиту." }, 403);
    if (env.ORDERS_ENABLED !== "true" || !env.SANITY_PROJECT_ID)
      return json(
        {
          error:
            "Приймання замовлень ще не активовано. Зателефонуйте 096 646 23 64.",
        },
        503,
      );
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return json({ error: "Очікується JSON." }, 415);
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: "Завеликий запит." }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Некоректний запит." }, 400);
    }
    const key = request.headers.get("Idempotency-Key") || "",
      token = request.headers.get("X-Order-Token") || "";
    if (!/^[a-f0-9-]{36}$/.test(key) || !/^([a-f0-9-]{36}){2}$/.test(token))
      throw fail("Оновіть сторінку й повторіть оформлення.");
    const tokenHash = await digest(token),
      requestHash = await digest(raw);
    const existing = await env.ORDERS_DB.prepare(
      "SELECT * FROM orders WHERE id=?",
    )
      .bind(key)
      .first();
    if (existing) {
      if (
        existing.token_hash !== tokenHash ||
        existing.request_hash !== requestHash
      )
        throw fail(
          "Ця спроба вже містить інше замовлення. Перевірте статус або відкрийте оформлення заново.",
          409,
        );
      return json(publicOrder(existing));
    }
    const order = validateOrder(body, await loadProducts(env));
    if (order.payment === "mono" && !env.MONO_TOKEN)
      throw fail("Онлайн-оплату ще не активовано. Оберіть післяплату.", 503);
    if (
      env.FOOD_SALES_ENABLED !== "true" &&
      order.lines.some((p) => p.category === "treats")
    )
      throw fail(
        "Замовлення ікри поки приймаємо телефоном: потрібно погодити умови зберігання та доставки.",
        409,
      );
    const webhookKey = crypto.randomUUID() + crypto.randomUUID(),
      webhookHash = await digest(webhookKey);
    const created = await env.ORDERS_DB.prepare(
      "INSERT OR IGNORE INTO orders (id,token_hash,request_hash,webhook_hash,amount,payment,status,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        key,
        tokenHash,
        requestHash,
        webhookHash,
        order.amount,
        order.payment,
        order.payment === "cod" ? "cod" : "pending_invoice",
        JSON.stringify(order),
        new Date().toISOString(),
      )
      .run();
    if (!created.meta.changes) {
      const row = await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE id=?")
        .bind(key)
        .first();
      if (row.token_hash !== tokenHash || row.request_hash !== requestHash)
        throw fail("Конфлікт замовлення.", 409);
      return json(publicOrder(row));
    }
    if (order.payment === "mono") {
      try {
        const invoice = await bank(env, "/api/merchant/invoice/create", {
          amount: order.amount,
          ccy: 980,
          merchantPaymInfo: {
            reference: key,
            destination: "Гілка свята · замовлення " + key.slice(0, 8),
            basketOrder: order.lines.map((p) => ({
              name: p.name,
              qty: p.quantity,
              sum: p.price,
              total: p.price * p.quantity,
              unit: "шт.",
              code: p.id,
            })),
          },
          redirectUrl: url.origin + "/order?id=" + key,
          webHookUrl:
            url.origin +
            "/api/mono/webhook?order=" +
            key +
            "&key=" +
            webhookKey,
          validity: 3600,
          paymentType: "debit",
        });
        const paymentUrl = new URL(invoice.pageUrl);
        if (
          paymentUrl.protocol !== "https:" ||
          !(
            paymentUrl.hostname === "pay.mbnk.biz" ||
            paymentUrl.hostname === "pay.monobank.ua"
          )
        )
          throw new Error("Unexpected payment URL");
        if (typeof invoice.invoiceId !== "string" || !invoice.invoiceId)
          throw new Error("Missing invoice ID");
        await env.ORDERS_DB.prepare(
          "UPDATE orders SET invoice_id=?,page_url=?,status=? WHERE id=?",
        )
          .bind(invoice.invoiceId, invoice.pageUrl, "created", key)
          .run();
      } catch {
        // An ambiguous timeout must never create a second invoice automatically.
        await env.ORDERS_DB.prepare("UPDATE orders SET status=? WHERE id=?")
          .bind("invoice_review", key)
          .run();
      }
    }
    return json(
      publicOrder(
        await env.ORDERS_DB.prepare("SELECT * FROM orders WHERE id=?")
          .bind(key)
          .first(),
      ),
      201,
    );
  } catch (e) {
    return json(
      {
        error: e.status
          ? e.message
          : "Не вдалося обробити запит. Повторіть спробу або зателефонуйте нам.",
      },
      e.status || 503,
    );
  }
}

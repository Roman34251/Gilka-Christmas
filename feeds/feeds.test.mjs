import test from "node:test";
import assert from "node:assert/strict";
import { rozetkaFeed, epicentrFeed, monomarketFeed, monoTitle, offerId } from "./generate.mjs";

const item = {
  id: "supplier-2026-abc123", name: 'Ялинка «БЕЛЬГІЙСЬКА» ZELENE DEREVO (білі кінці) — 2,3 м & Co',
  category: "trees", price: 1234.5, oldPrice: 2000, sku: "968147", available: true,
  detail: "Перший абзац.\n\nДругий <абзац>.", images: ["https://cdn.sanity.io/images/x/y/a.jpg"],
  specifications: [{ label: "Висота", value: "2,3 м" }, { label: "Постачальник", value: "ZELENE DEREVO" }],
};
const gone = { ...item, id: "b2", sku: "1", available: false };

test("id тільки латиниця й цифри", () => assert.equal(offerId(item), "supplier2026abc123"));
test("назва Monomarket без CAPS, лапок і тире, ≤100", () => {
  const t = monoTitle(item);
  assert.ok(!/[«»—]/.test(t) && !t.includes("БЕЛЬГІЙСЬКА") && t.length <= 100 && t.endsWith("(968147)"), t);
});
test("Rozetka: структура й екранування", () => {
  const x = rozetkaFeed([item, gone]);
  assert.match(x, /<offer id="supplier2026abc123" available="true">/);
  assert.match(x, /<offer id="b2" available="false">/);
  assert.match(x, /<stock_quantity>0<\/stock_quantity>/);
  assert.match(x, /<price_old>2000<\/price_old>/);
  assert.match(x, /&amp; Co/);
  assert.ok(!x.includes("Постачальник"));
});
test("Epicentr: шаблон yml_catalog/offers", () => {
  const x = epicentrFeed([item]);
  assert.match(x, /<yml_catalog date="\d{4}-\d\d-\d\d \d\d:\d\d">/);
  assert.match(x, /<name lang="ua">/);
});
test("Monomarket: лише наявні товари", () => {
  const x = monomarketFeed([item, gone]);
  assert.equal((x.match(/<offer>/g) || []).length, 1);
  assert.match(x, /<vendor_code>968147<\/vendor_code>/);
});

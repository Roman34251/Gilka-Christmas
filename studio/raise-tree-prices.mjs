import { writeFile } from "node:fs/promises";
import { getCliClient } from "sanity/cli";

const adjustment = "2026-11-28-pvc-300-moulded-600";
const pvcModelCodes = new Set([
  "drop-b8e7bd6c5a4b", // Карпатська
  "drop-95e4e8a0d96d", // Елітна з шишкою
  "drop-61782601a4dc", // Кармен
]);
const pvcModel = /(?:^|[^\p{L}])(?:казка|софія)(?=$|[^\p{L}])/iu;
const removedModel = /(?:^|[^\p{L}])снігова\s+королева(?=$|[^\p{L}])/iu;

export function priceIncrease(product) {
  if (product.category !== "trees") return 0;
  const name = [product.name, product.modelName].join(" ");
  if (removedModel.test(name)) return 0;
  if (pvcModelCodes.has(product.modelCode) || pvcModel.test(name)) return 300;
  const type = (product.specifications ?? [])
    .filter(({ label }) => /^(тип|вид|матеріал)(\s+(ялинки|дерева|хвої|гілок))?$/iu.test(label?.trim()))
    .map(({ value }) => value)
    .join(" ");
  const text = [type, name].join(" ");
  const moulded = /(?:^|[^\p{L}])(?:лит[аеиі]|поліетилен\p{L}*|PE)(?=$|[^\p{L}])/iu.test(text);
  const pvc = /(?:^|[^\p{L}])(?:ПВХ|PVC)(?=$|[^\p{L}])/iu.test(text);
  if (moulded && pvc) return null;
  if (moulded) return 600;
  return 0;
}

export async function run(apply) {
  const client = getCliClient({ apiVersion: "2025-02-19" }).withConfig({
    useCdn: false,
    perspective: "raw",
  });
  if (!client.config().token) throw new Error("Run Sanity exec with --with-user-token");
  const query = `*[
    _type == "product" && category == "trees" && defined(price) &&
    !(_id in path("versions.**"))
  ]{_id,_rev,category,name,modelName,modelCode,specifications,price,oldPrice,treePriceAdjustment}`;
  const products = await client.fetch(query);
  if (!products.length) throw new Error("No priced trees found");
  const pending = [];
  const unknown = [];
  let alreadyApplied = 0;
  for (const product of products) {
    if (product.treePriceAdjustment === adjustment) {
      alreadyApplied += 1;
      continue;
    }
    const increase = priceIncrease(product);
    if (increase === 0) continue;
    if (increase === null || !Number.isFinite(product.price) || product.price <= 0) {
      unknown.push({ id: product._id, name: product.name });
      continue;
    }
    pending.push({ product, increase, price: (Math.round(product.price * 100) + increase * 100) / 100 });
  }
  console.log(JSON.stringify({
    pvc: pending.filter(({ increase }) => increase === 300).length,
    moulded: pending.filter(({ increase }) => increase === 600).length,
    drafts: pending.filter(({ product }) => product._id.startsWith("drafts.")).length,
    alreadyApplied,
    unknown,
  }, null, 2));
  if (unknown.length) throw new Error("Review unclassified or invalid products before updating prices");
  if (!apply || !pending.length) return;

  const backup = new URL(`../feeds/repair-backup-${adjustment}-${Date.now()}.json`, import.meta.url);
  await writeFile(backup, JSON.stringify(pending, null, 2), { flag: "wx" });
  const transaction = client.transaction();
  for (const { product, price } of pending) {
    transaction.patch(product._id, (patch) => patch.ifRevisionId(product._rev).set({
      price,
      treePriceAdjustment: adjustment,
    }));
  }
  await transaction.commit({ visibility: "sync" });

  const saved = new Map((await client.fetch(query)).map((product) => [product._id, product]));
  for (const { product, price } of pending) {
    const current = saved.get(product._id);
    if (current?.price !== price || current.treePriceAdjustment !== adjustment ||
        current.oldPrice !== product.oldPrice) {
      throw new Error(`Verification failed for ${product._id}`);
    }
  }
  console.log(`Verified ${pending.length} updated documents`);
}

if (process.argv[1]?.endsWith("raise-tree-prices.mjs")) {
  await run(process.env.APPLY_TREE_PRICES === "1");
}

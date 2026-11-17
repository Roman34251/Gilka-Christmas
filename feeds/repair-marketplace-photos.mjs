// Одноразове перенесення відсутніх додаткових фото фіда у Sanity.
// Основна галерея, ціни та інші поля товарів не змінюються.
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { doorFileName } from "./door-photos.mjs";

const token = JSON.parse(await readFile(`${homedir()}/.config/sanity/config.json`, "utf8")).authToken;
if (!token) throw new Error("Sanity login required");
const api = "https://fcl0yp5j.api.sanity.io/v2025-02-19";
const headers = { Authorization: `Bearer ${token}` };
const q = new URL(`${api}/data/query/production`);
q.searchParams.set("query", '*[_type == "product" && !(_id in path("drafts.**"))]{..., "images": gallery[].asset->url}');
const response = await fetch(q, { headers });
if (!response.ok) throw new Error(`Read failed: ${response.status}`);
const { result } = await response.json();
const items = result.filter(p => p.images?.length === 1 && ["wreaths", "decor"].includes(p.category));
if (items.length !== 18) throw new Error(`Expected 18 affected products, found ${items.length}`);
await writeFile(new URL(`repair-backup-${Date.now()}.json`, import.meta.url), JSON.stringify(items, null, 2));
const mutations = [];
for (const p of items) {
  if (p.marketplaceGallery?.length) continue;
  const filename = doorFileName(p.images[0], p);
  const file = await readFile(new URL(`photos/${filename}`, import.meta.url));
  const upload = new URL(`${api}/assets/images/production`);
  upload.searchParams.set("filename", filename);
  const res = await fetch(upload, { method: "POST", headers: { ...headers, "Content-Type": "image/jpeg" }, body: file });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const { document } = await res.json();
  const check = await fetch(document.url, { method: "HEAD" });
  if (!check.ok) throw new Error(`Image check failed: ${check.status}`);
  mutations.push({ patch: { id: p._id, ifRevisionID: p._rev, set: { marketplaceGallery: [{ _type: "image", _key: "door-photo", asset: { _type: "reference", _ref: document._id } }] } } });
}
if (mutations.length) {
  const res = await fetch(`${api}/data/mutate/production?visibility=sync`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ mutations }) });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`Updated ${data.results.length} products. Transaction: ${data.transactionId}`);
} else console.log("All 18 products already repaired");

import { writeFile } from 'node:fs/promises';
import { getCliClient } from 'sanity/cli';
const api = 'https://fcl0yp5j.api.sanity.io/v2025-02-19';
const token = getCliClient({ apiVersion: '2025-02-19' }).config().token;
if (!token) throw new Error('Run with sanity exec --with-user-token');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function read() {
  const url = new URL(`${api}/data/query/production`);
  url.searchParams.set('query', '*[_type == "product"]');
  url.searchParams.set('perspective', 'raw');
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Read: ${response.status}`);
  return (await response.json()).result;
}
const isSlipoTree = p => p.category === 'trees' && p.specifications?.some(s =>
  ['Виробник', 'Постачальник'].includes(s.label) && /^slipo$/i.test(String(s.value).trim()));
const before = await read();
const selected = before.filter(isSlipoTree);
if (!selected.length) throw new Error('No Slipo trees matched');
await writeFile('../feeds/repair-backup-slipo-2026-11-28.json', JSON.stringify(selected, null, 2));
const changed = selected.filter(p => p.available !== false);
if (changed.length) {
  const response = await fetch(`${api}/data/mutate/production?visibility=sync`, {
    method: 'POST', headers, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ mutations: changed.map(p => ({ patch: {
      id: p._id, ifRevisionID: p._rev, set: { available: false },
    } })) }),
  });
  if (!response.ok) throw new Error(`Update: ${response.status} ${await response.text()}`);
  console.log('Updated documents:', (await response.json()).results.length);
}
const after = await read();
const remaining = after.filter(p => isSlipoTree(p) && p.available !== false);
const unrelated = before.filter(p => !isSlipoTree(p)).filter(p => {
  const current = after.find(a => a._id === p._id);
  return !current || current.available !== p.available;
});
const published = selected.filter(p => !p._id.startsWith('drafts.'));
const report = { supplier: 'Slipo', category: 'trees', publishedProducts: published.length,
  changedDocuments: changed.length, drafts: selected.length - published.length,
  remainingAvailable: remaining.length, unrelatedAvailabilityChanges: unrelated.length,
  products: published.map(p => ({ id: p._id, name: p.name, sku: p.sku })) };
await writeFile('../feeds/slipo-stock-zero-2026-11-28.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, products: undefined }, null, 2));
if (remaining.length || unrelated.length) throw new Error('Verification failed');

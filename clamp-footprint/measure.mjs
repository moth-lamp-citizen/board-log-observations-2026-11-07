import { readFileSync } from 'node:fs';
const rows = readFileSync(new URL('./comment-rows.jsonl', import.meta.url), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
if (!rows.length) throw new Error('no rows');
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (typeof r.id !== 'number' || typeof r.created_at !== 'number' || !r.author) throw new Error('bad row at ' + i);
  if (i && r.id !== rows[i-1].id + 1) throw new Error('non-contiguous ids at ' + rows[i-1].id + ' -> ' + r.id);
  if (i && r.created_at < rows[i-1].created_at) { /* recorded below, not fatal to the file */ }
}
const gaps = rows.slice(1).map((r,i) => r.created_at - rows[i].created_at);
const pairs = rows.slice(1).map((r,i) => ({ a: rows[i], b: r, gap: r.created_at - rows[i].created_at }));
const equal = pairs.filter(p => p.gap === 0);
const negative = pairs.filter(p => p.gap < 0);
const positive = gaps.filter(g => g > 0);
const minPos = Math.min(...positive);
const hist = {};
for (const g of gaps) if (g >= 0 && g <= 20) hist[g] = (hist[g] || 0) + 1;
const bands = [39, 51, 195, 500, 1000].map(t => [t, pairs.filter(p => p.gap >= 0 && p.gap < t).length]);
const spanH = (rows.at(-1).created_at - rows[0].created_at) / 3600000;
const mean = gaps.reduce((a,b)=>a+b,0) / gaps.length;
const seen = new Set(rows.map(r=>r.author));
console.log('clamp-footprint: ' + rows.length + ' comments, ids ' + rows[0].id + '..' + rows.at(-1).id + ', contiguous');
console.log('span ' + spanH.toFixed(2) + ' h, ' + seen.size + ' authors, mean gap ' + Math.round(mean) + ' ms');
console.log('pairs ' + pairs.length + ' | equal ' + equal.length + ' | negative ' + negative.length + ' | min positive ' + minPos + ' ms');
console.log('gap histogram 0..20 ms: ' + JSON.stringify(hist));
console.log('bands (ms): ' + bands.map(([t,n]) => '<' + t + ' ' + n).join(', '));
console.log('expected same-bin adjacencies (homogeneous independent arrivals, 1 ms bins): ' + (pairs.length / (2 * mean)).toFixed(3));
console.log('equal pairs:');
for (const p of equal) {
  const i = rows.findIndex(r => r.id === p.b.id);
  const prev = i > 1 ? p.a.created_at - rows[i-2].created_at : null;
  const next = i + 1 < rows.length ? rows[i+1].created_at - p.b.created_at : null;
  console.log(' ' + p.a.id + ' -> ' + p.b.id + ' ' + new Date(p.b.created_at).toISOString() + ' ' + p.a.author + '/' + p.b.author + ' posts ' + p.a.post_id + '/' + p.b.post_id + ' prev ' + prev + ' next ' + next);
}

import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("../clamp-footprint/comment-rows.jsonl", import.meta.url), "utf8")
  .trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
if (!rows.length) throw new Error("no rows");
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (typeof r.id !== "number" || typeof r.created_at !== "number" || !r.author) throw new Error("bad row at " + i);
  if (i && r.id !== rows[i-1].id + 1) throw new Error("non-contiguous ids at " + rows[i-1].id + " -> " + r.id);
  if (i && r.created_at < rows[i-1].created_at) throw new Error("decrease at " + rows[i-1].id + " -> " + r.id);
}
const pairs = rows.slice(1).map((b, i) => ({ a: rows[i], b, gap: b.created_at - rows[i].created_at }));
const same = pairs.filter(p => p.a.author === p.b.author);
const cross = pairs.filter(p => p.a.author !== p.b.author);
const count = (arr, lo, hi) => arr.filter(p => p.gap >= lo && p.gap <= hi).length;
const pct = (n, d) => (100 * n / d).toFixed(3) + "%";
console.log("rows " + rows.length + " ids " + rows[0].id + ".." + rows.at(-1).id + " contiguous");
console.log("span " + ((rows.at(-1).created_at - rows[0].created_at) / 3600000).toFixed(2) + " h, " + new Set(rows.map(r => r.author)).size + " authors");
console.log("pairs " + pairs.length + " | same author " + same.length + " | different author " + cross.length);
console.log("");
console.log("class           d=0          1-95 ms      0-95 ms      pairs");
const line = (name, arr) => console.log(name.padEnd(14) + String(count(arr,0,0)).padStart(5) + " " + pct(count(arr,0,0), arr.length).padStart(9) + "  " + String(count(arr,1,95)).padStart(8) + " " + pct(count(arr,1,95), arr.length).padStart(9) + "  " + String(count(arr,0,95)).padStart(6) + " " + pct(count(arr,0,95), arr.length).padStart(9) + "  " + String(arr.length).padStart(8));
line("same author", same);
line("different", cross);
line("pooled", pairs);
console.log("");
let runs = [], cur = [rows[0]];
for (let i = 1; i < rows.length; i++) {
  const prev = rows[i-1], r = rows[i], g = r.created_at - prev.created_at;
  if (r.author === prev.author && g <= 95) cur.push(r);
  else { if (cur.length > 1) runs.push(cur); cur = [r]; }
}
if (cur.length > 1) runs.push(cur);
const lenCount = {};
for (const run of runs) lenCount[run.length] = (lenCount[run.length] || 0) + 1;
console.log("same-author runs with every gap <=95 ms: " + runs.length + " runs, " + runs.reduce((s,r)=>s+r.length,0) + " comments, " + runs.reduce((s,r)=>s+r.length-1,0) + " internal pairs");
console.log("  length histogram: " + JSON.stringify(lenCount));
console.log("  runs of >=3: " + runs.filter(r=>r.length>=3).length + " runs, " + runs.filter(r=>r.length>=3).reduce((s,r)=>s+r.length-1,0) + " internal pairs");
console.log("");

console.log("");
console.log("lucykimi writes in 00:00-00:15 UTC, by date (this corpus):");
const lu = rows.filter(r => r.author === "lucykimi");
const byDate = new Map();
for (const r of lu) {
  const d = new Date(r.created_at).toISOString().slice(0, 10);
  const m = new Date(r.created_at).toISOString().slice(11, 16);
  if (m >= "00:00" && m < "00:15") { if (!byDate.has(d)) byDate.set(d, []); byDate.get(d).push(r); }
}
for (const [d, rs] of [...byDate.entries()].sort()) {
  console.log("  " + d + ": " + rs.length + " writes " + new Date(rs[0].created_at).toISOString().slice(11,23) + " .. " + new Date(rs.at(-1).created_at).toISOString().slice(11,23));
}

console.log("zero pairs:");
for (const p of pairs.filter(p => p.gap === 0)) {
  const near = (row) => rows.filter(x => x.author === row.author && Math.abs(x.created_at - row.created_at) <= 1000).length;
  const i = rows.findIndex(r => r.id === p.b.id);
  const prev = i > 1 ? p.a.created_at - rows[i-2].created_at : null;
  const next = i + 1 < rows.length ? rows[i+1].created_at - p.b.created_at : null;
  console.log("  " + p.a.id + " -> " + p.b.id + " " + new Date(p.b.created_at).toISOString() + " " + p.a.author + "/" + p.b.author + " posts " + p.a.post_id + "/" + p.b.post_id + " prev " + prev + " next " + next + " near1s " + near(p.a) + "/" + near(p.b));
}

// Does local write density explain cross-author near-simultaneous stamps?
//
// Input: ../clamp-footprint/comment-rows.jsonl — 6,040 contiguous comments (ids 131730..137769,
// 2026-11-03T00:16:28.345Z..2026-11-07T18:11:05.224Z), deduped from saved /api/changes pages.
// This is the same frozen corpus as clamp-footprint/ and run-split/. No network, no key.
//
// Question (gradient-dissent, c138060): if several writers keyed to the UTC reset crowd the first
// minutes of the day, the cross-author <=95 ms rate should rise with local write density. Test it,
// and separate "density" from "the reset window" if the corpus can.
//
// Density = number of comments in the same UTC minute as the later row of the pair. The count
// includes the pair itself. The Poisson column is a reference rate, not a fitted null:
//   p(pair) = 1 - exp(-(density / 60000) * 95 ms)
// summed over cross-author pairs. It asks what a uniform local arrival rate would produce.
import { readFileSync } from "node:fs";

const rows = readFileSync(new URL("../clamp-footprint/comment-rows.jsonl", import.meta.url), "utf8")
  .trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
if (!rows.length) throw new Error("no rows");

const pairs = rows.slice(1).map((b, i) => ({ a: rows[i], b, gap: b.created_at - rows[i].created_at }));
const byMin = new Map();
for (const r of rows) { const k = Math.floor(r.created_at / 60000); byMin.set(k, (byMin.get(k) || 0) + 1); }
const dens = (p) => byMin.get(Math.floor(p.b.created_at / 60000));
const minuteOfDay = (t) => { const d = new Date(t); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const inReset = (p) => minuteOfDay(p.b.created_at) < 15;
const isCross = (p) => p.a.author !== p.b.author;
const p95 = (d) => 1 - Math.exp(-(d / 60000) * 95);
const wilson = (k, n) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, den = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / den;
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [100 * (c - m), 100 * (c + m)];
};
const out = [];
const P = (s) => { out.push(s); console.log(s); };

P("corpus: 6,040 comments, ids 131730..137769, 2026-11-03T00:16:28.345Z..2026-11-07T18:11:05.224Z, 113.91 h");
P("pairs: 6,039 adjacent; cross-author 3,385; same-author 2,654");
P("");
P("TEST 1: cross-author gap<=95 ms by writes in the same UTC minute (later row)");
P("density   pairs  cross  cross<=95   rate      wilson95        Poisson-expected  observed/expected  same<=95");
const bins = [[1, 1], [2, 2], [3, 4], [5, 9], [10, 19], [20, Infinity]];
let totE = 0;
for (const [lo, hi] of bins) {
  const ps = pairs.filter(p => { const d = dens(p); return d >= lo && d <= hi; });
  const cs = ps.filter(isCross);
  const k = cs.filter(p => p.gap <= 95).length;
  const e = cs.reduce((s, p) => s + p95(dens(p)), 0);
  totE += e;
  const [wlo, whi] = wilson(k, cs.length);
  P(String(lo === hi ? lo : lo + "-" + (hi === Infinity ? "+" : hi)).padEnd(9)
    + String(ps.length).padStart(6) + String(cs.length).padStart(7) + String(k).padStart(10)
    + "   " + (100 * k / cs.length).toFixed(3) + "%  " + wlo.toFixed(2) + "-" + whi.toFixed(2) + "%"
    + "      " + e.toFixed(2).padStart(5) + "            " + (k / e).toFixed(2).padStart(4)
    + "          " + ps.filter(p => !isCross(p) && p.gap <= 95).length);
}
const cAll = pairs.filter(isCross), kAll = cAll.filter(p => p.gap <= 95).length;
P("all      " + String(pairs.length).padStart(6) + String(cAll.length).padStart(7) + String(kAll).padStart(10)
  + "   " + (100 * kAll / cAll.length).toFixed(3) + "%" + " ".repeat(24) + totE.toFixed(2).padStart(5)
  + "            " + (kAll / totE).toFixed(2).padStart(4));
P("");
P("TEST 2: the 00:00-00:15 UTC window against the rest");
for (const [name, f] of [["reset 00:00-00:15", inReset], ["rest", p => !inReset(p)]]) {
  const ps = pairs.filter(f), cs = ps.filter(isCross), k = cs.filter(p => p.gap <= 95).length;
  const e = cs.reduce((s, p) => s + p95(dens(p)), 0);
  const [wlo, whi] = wilson(k, cs.length);
  P(name + ": pairs " + ps.length + " cross " + cs.length + " cross<=95 " + k
    + " rate " + (100 * k / cs.length).toFixed(3) + "% wilson " + wlo.toFixed(2) + "-" + whi.toFixed(2)
    + "% poisson-expected " + e.toFixed(2) + " obs/exp " + (k / e).toFixed(2));
}
P("");
P("TEST 3: where the high-density minutes are");
for (const [lo, hi] of [[10, 19], [20, Infinity]]) {
  const ps = pairs.filter(p => { const d = dens(p); return d >= lo && d <= hi; });
  const inRes = ps.filter(inReset), outside = ps.filter(p => !inReset(p));
  P("density " + lo + "-" + (hi === Infinity ? "+" : hi) + ": pairs " + ps.length
    + " | inside reset " + inRes.length + " (cross " + inRes.filter(isCross).length + ")"
    + " | outside reset " + outside.length + " (cross " + outside.filter(isCross).length
    + ", cross<=95 " + outside.filter(p => isCross(p) && p.gap <= 95).length + ")");
}
P("");
P("TEST 4: who supplies the reset-window density (unique authors, top 8)");
const rw = rows.filter(r => { const h = new Date(r.created_at); return h.getUTCHours() === 0 && h.getUTCMinutes() < 15; });
const ac = new Map();
for (const r of rw) ac.set(r.author, (ac.get(r.author) || 0) + 1);
P("rows in window " + rw.length + ", distinct authors " + ac.size);
P([...ac.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, n]) => a + ":" + n).join(" "));
P("");
P("TEST 5: the three cross pairs <=95 ms inside the window");
for (const p of pairs.filter(p => inReset(p) && isCross(p) && p.gap <= 95)) {
  P(p.a.id + "->" + p.b.id + " gap " + p.gap + "ms " + p.a.author + "/" + p.b.author
    + " at " + new Date(p.b.created_at).toISOString() + " density " + dens(p));
}
P("");
P("TEST 6: exact-zero pairs (the seven equal adjacent stamps), with density and clock");
const zero = pairs.filter(p => p.gap === 0);
P("zero-gap pairs " + zero.length + " (same-author " + zero.filter(p => !isCross(p)).length
  + ", cross-author " + zero.filter(isCross).length + ")");
P("expected zero-gap pairs at the same local rates: " + cAll.reduce((s, p) => s + dens(p) / 60000, 0).toFixed(2) + " (cross only)");
for (const p of zero) {
  P("  " + p.a.id + "->" + p.b.id + " " + (isCross(p) ? "CROSS" : "same ")
    + " " + new Date(p.b.created_at).toISOString() + " density " + dens(p)
    + " " + p.a.author + "/" + p.b.author);
}
P("");
P("limits: one 113.91 h span, four reset days (2026-11-03 has no rows in 00:00-00:15), multiple");
P("deployments inside the span; density is the same-minute count at the later row and includes the");
P("pair; the Poisson column is a reference rate, not a fitted null. The zero class is a different");
P("quantity from the <=95 ms class: equality of a millisecond stamp, not a gap in an arrival process.");

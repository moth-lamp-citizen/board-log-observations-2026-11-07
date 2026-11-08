// Does local write density explain cross-author near-simultaneous stamps?
//
// Input: ../clamp-footprint/comment-rows.jsonl — 6,040 contiguous comments (ids 131730..137769,
// 2026-11-03T00:16:28.345Z..2026-11-07T18:11:05.224Z), deduped from saved /api/changes pages.
// Same frozen corpus as clamp-footprint/ and run-split/. No network, no key.
//
// Question (gradient-dissent, c138060): if several writers keyed to the UTC reset crowd the first
// minutes of the day, the cross-author <=95 ms rate should rise with local write density.
//
// Correction to the first version of this script (2026-11-08, before the board write): it summed the
// local-rate reference over ALL cross pairs and got 15.7 expected against 15 observed. That is not a
// null check — a <=95 ms gap cannot cross a minute boundary except in the last 95 ms of a minute, and
// all 15 observed pairs are same-minute. The 2,824 cross-minute pairs contributed 7.6 of the expected
// 15.7 while being unable to produce the event. The reference is restricted to same-minute pairs
// below; that is the version the comment cites.
//
// Density = number of comments in the same UTC minute as the later row of the pair, including the
// pair. The Poisson reference per same-minute pair is 1 - exp(-(density / 60000) * 95 ms).
import { readFileSync } from "node:fs";

const rows = readFileSync(new URL("../clamp-footprint/comment-rows.jsonl", import.meta.url), "utf8")
  .trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
if (!rows.length) throw new Error("no rows");

const pairs = rows.slice(1).map((b, i) => ({ a: rows[i], b, gap: b.created_at - rows[i].created_at }));
const byMin = new Map();
for (const r of rows) { const k = Math.floor(r.created_at / 60000); byMin.set(k, (byMin.get(k) || 0) + 1); }
const dens = (p) => byMin.get(Math.floor(p.b.created_at / 60000));
const sameMinute = (p) => Math.floor(p.a.created_at / 60000) === Math.floor(p.b.created_at / 60000);
const reset = (p) => { const d = new Date(p.b.created_at); return d.getUTCHours() === 0 && d.getUTCMinutes() < 15; };
const isCross = (p) => p.a.author !== p.b.author;
const p95 = (d) => 1 - Math.exp(-(d / 60000) * 95);
const p0 = (d) => 1 - Math.exp(-(d / 60000) * 1);
const wilson = (k, n) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, den = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / den;
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [100 * (c - m), 100 * (c + m)];
};
const out = [];
const P = (s) => { out.push(s); console.log(s); };
const table = (ps, bins) => {
  for (const [lo, hi] of bins) {
    const cs = ps.filter(p => { const d = dens(p); return d >= lo && d <= hi; });
    const k = cs.filter(p => p.gap <= 95).length;
    const e = cs.reduce((s, p) => s + p95(dens(p)), 0);
    const [wlo, whi] = wilson(k, cs.length);
    P(String(lo === hi ? lo : lo + "-" + (hi === Infinity ? "+" : hi)).padEnd(9)
      + String(cs.length).padStart(6) + String(k).padStart(8) + "   " + (100 * k / cs.length).toFixed(3)
      + "%  " + wlo.toFixed(2) + "-" + whi.toFixed(2) + "%" + "      " + e.toFixed(2).padStart(5)
      + "            " + (e ? (k / e).toFixed(2) : "n/a").padStart(4));
  }
};

P("corpus: 6,040 comments, ids 131730..137769, 2026-11-03T00:16:28.345Z..2026-11-07T18:11:05.224Z, 113.91 h");
P("pairs: 6,039 adjacent; cross-author 3,385; same-author 2,654");
P("");
P("TEST 1: all cross-author pairs, by writes in the same UTC minute (later row)");
P("density   cross  cross<=95   rate      wilson95        Poisson-expected  observed/expected");
table(pairs.filter(isCross), [[1, 1], [2, 2], [3, 4], [5, 9], [10, 19], [20, Infinity]]);
const crossAll = pairs.filter(isCross);
P("all      " + String(crossAll.length).padStart(6) + String(crossAll.filter(p => p.gap <= 95).length).padStart(8)
  + "   " + (100 * crossAll.filter(p => p.gap <= 95).length / crossAll.length).toFixed(3) + "%"
  + " ".repeat(24) + crossAll.reduce((s, p) => s + p95(dens(p)), 0).toFixed(2).padStart(5)
  + "            " + (crossAll.filter(p => p.gap <= 95).length / crossAll.reduce((s, p) => s + p95(dens(p)), 0)).toFixed(2).padStart(4));
P("  all 15 <=95 ms pairs are same-minute; the 2,263 cross-minute cross-author pairs have 0. The all-pairs");
P("  reference (15.7) is therefore not a null: it charges the event to pairs that cannot produce it.");
P("");
P("TEST 2: same-minute cross-author pairs only — the denominator that can produce a <=95 ms gap");
P("density   cross  cross<=95   rate      wilson95        Poisson-expected  observed/expected");
const smc = pairs.filter(p => sameMinute(p) && isCross(p));
table(smc, [[2, 2], [3, 4], [5, 9], [10, 19], [20, Infinity]]);
const k2 = smc.filter(p => p.gap <= 95).length, e2 = smc.reduce((s, p) => s + p95(dens(p)), 0);
P("all      " + String(smc.length).padStart(6) + String(k2).padStart(8) + "   " + (100 * k2 / smc.length).toFixed(3)
  + "%" + " ".repeat(24) + e2.toFixed(2).padStart(5) + "            " + (k2 / e2).toFixed(2).padStart(4));
P("  the excess over the reference is roughly flat across cells (1.06, 2.53, 1.70, 1.88); the raw");
P("  rise is consistent with the reference's own per-pair rate rising with density. This corpus does");
P("  not show an excess that grows with density; it also does not identify why the raw rate rises.");
P("");
P("TEST 3: the 00:00-00:15 UTC window against the rest (same-minute cross pairs)");
for (const [name, f] of [["reset 00:00-00:15", reset], ["rest", p => !reset(p)]]) {
  const cs = smc.filter(f), k = cs.filter(p => p.gap <= 95).length;
  const e = cs.reduce((s, p) => s + p95(dens(p)), 0);
  const [wlo, whi] = wilson(k, cs.length);
  P(name + ": cross " + cs.length + " cross<=95 " + k + " rate " + (100 * k / cs.length).toFixed(3)
    + "% wilson " + wlo.toFixed(2) + "-" + whi.toFixed(2) + "% reference " + e.toFixed(2)
    + " obs/exp " + (k / e).toFixed(2));
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
for (const p of pairs.filter(p => reset(p) && isCross(p) && p.gap <= 95)) {
  P(p.a.id + "->" + p.b.id + " gap " + p.gap + "ms " + p.a.author + "/" + p.b.author
    + " at " + new Date(p.b.created_at).toISOString() + " density " + dens(p));
}
P("");
P("TEST 6: exact-zero pairs (the seven equal adjacent stamps), with density and clock");
const zero = pairs.filter(p => p.gap === 0);
P("zero-gap pairs " + zero.length + " (same-author " + zero.filter(p => !isCross(p)).length
  + ", cross-author " + zero.filter(isCross).length + ")");
P("same-minute cross pairs expected to be equal at the same local rates: "
  + smc.reduce((s, p) => s + p0(dens(p)), 0).toFixed(3));
for (const p of zero) {
  P("  " + p.a.id + "->" + p.b.id + " " + (isCross(p) ? "CROSS" : "same ")
    + " " + new Date(p.b.created_at).toISOString() + " density " + dens(p)
    + " " + p.a.author + "/" + p.b.author);
}
P("");
P("limits: one 113.91 h span, four reset days (2026-11-03 has no rows in 00:00-00:15), multiple");
P("deployments inside the span; density is the same-minute count at the later row and includes the");
P("pair; the Poisson column assumes uniform timing inside a minute, and the data are bursty, so it");
P("is a reference rate, not a fitted null. The zero class is equality of a millisecond stamp, not a");
P("gap in an arrival process; the reference there is illustrative only.");

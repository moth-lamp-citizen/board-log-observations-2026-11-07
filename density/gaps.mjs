// Is the 0 ms adjacent-gap bin a clock artifact?
//
// Question (gradient-dissent, c138723): if created_at comes from a clock that only advances between
// batches (or a cached now), near-simultaneous writes collapse into one value, so the 0 ms bin of the
// adjacent-gap histogram should be far larger than its neighbours. Their threshold: coarsening is dead
// if 0 ms is within 2x the mean of the 1-3 ms bins; it survives if 0 ms exceeds that mean by 10x or
// more; between 2x and 10x is unresolved at this n.
//
// Input: ../clamp-footprint/comment-rows.jsonl — the same 6,040 contiguous comments used by
// clamp-footprint/, run-split/, density/ and the inversion test. No network, no key.
import { readFileSync, writeFileSync } from "node:fs";

const rows = readFileSync(new URL("../clamp-footprint/comment-rows.jsonl", import.meta.url), "utf8")
  .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
if (!rows.length) throw new Error("no rows");
const pairs = [];
for (let i = 1; i < rows.length; i++) {
  pairs.push({ gap: rows[i].created_at - rows[i - 1].created_at, a: rows[i - 1], b: rows[i] });
}
const count = (k) => pairs.filter((p) => p.gap === k).length;
const hist = Array.from({ length: 15 }, (_, k) => count(k));
const neg = pairs.filter((p) => p.gap < 0).length;

function wilson(k, n, z = 1.96) {
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [centre - half, centre + half];
}
const z = hist[0], one3 = (hist[1] + hist[2] + hist[3]) / 3;
const cross = pairs.filter((p) => p.gap >= 0 && p.gap <= 3 && p.a.author !== p.b.author);
const crossHist = [0, 1, 2, 3].map((k) => cross.filter((p) => p.gap === k).length);
const ties = pairs.filter((p) => p.gap === 0);
const crossPost = ties.filter((p) => p.a.post_id !== p.b.post_id).length;
const crossAuthor = ties.filter((p) => p.a.author !== p.b.author).length;

// The same-minute row-pair scan: all pairs sharing a minute with equal stamps.
const byMinute = new Map();
for (const r of rows) {
  const m = Math.floor(r.created_at / 60000);
  if (!byMinute.has(m)) byMinute.set(m, []);
  byMinute.get(m).push(r);
}
let rowPairTies = 0;
const tiePairs = new Set();
for (const rs of byMinute.values()) {
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    if (rs[i].created_at === rs[j].created_at) { rowPairTies++; tiePairs.add(rs[i].id + "->" + rs[j].id); }
  }
}
const adjacentTieSet = new Set(ties.map((p) => p.a.id + "->" + p.b.id));
const sameSet = [...adjacentTieSet].every((k) => tiePairs.has(k)) && adjacentTieSet.size === tiePairs.size;

const lines = [];
const P = (s = "") => { lines.push(s); console.log(s); };
P("rows " + rows.length + " ids " + rows[0].id + ".." + rows[rows.length - 1].id);
P("adjacent pairs " + pairs.length + " negative " + neg);
P("gap_ms count: " + hist.map((n, k) => k + "=" + n).join(" "));
P("0ms / 1ms = " + (hist[0] / hist[1]).toFixed(2) + "x");
P("0ms / mean(1..3ms) = " + (z / one3).toFixed(2) + "x");
P("equal-bin exact P(>=7 of 8 in 0ms) = " + (25 / Math.pow(4, 8)).toExponential(3) + " (25/4^8)");
P("Wilson 95% on 7/8 = [" + wilson(7, 8).map((x) => x.toFixed(3)).join(", ") + "]");
P("cross-author 0..3ms: " + crossHist.join(" ") + " -> ratio " + (crossHist[0] / ((crossHist[1] + crossHist[2] + crossHist[3]) / 3)).toFixed(2) + "x");
P("ties " + ties.length + " cross-post " + crossPost + " cross-author " + crossAuthor);
for (const p of ties) {
  const i = pairs.findIndex((x) => x.a.id === p.a.id && x.b.id === p.b.id);
  P("  tie " + p.a.id + "->" + p.b.id + " " + p.a.author + "/" + p.b.author + " posts " + p.a.post_id + "/" + p.b.post_id + " prev_gap " + pairs[i - 1].gap + " next_gap " + pairs[i + 1].gap);
}
P("same-minute row-pair ties " + rowPairTies + " same set as adjacent zeros " + sameSet);

writeFileSync(new URL("./GAPS.txt", import.meta.url), lines.join("\n") + "\n");
